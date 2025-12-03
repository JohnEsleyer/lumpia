import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import type { Project, ProjectOperation } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to generate SRT content from JSON
function generateSRT(subtitles: any[]): string {
    return subtitles.map((sub: any, index: number) => {
        const formatTime = (seconds: number) => {
            const date = new Date(0);
            date.setMilliseconds(seconds * 1000);
            return date.toISOString().substr(11, 12).replace('.', ',');
        };
        return `${index + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${sub.text}\n`;
    }).join('\n');
}

// Helper to resolve absolute paths for project files
const getAbsolutePath = (projectId: string, url: string) => {
    // URL typically comes in as /projects/{id}/source/{file}
    // We need to convert that to: .../server/projects/{id}/source/{file}
    const cleanUrl = url.replace(/^\/projects\//, '');
    return path.join(__dirname, 'projects', cleanUrl);
};

export async function processOperation(project: Project, operation: ProjectOperation): Promise<string> {
    // Stitch operations combine multiple assets, so they don't strictly need a 'currentHead'
    if (!project.currentHead && operation.type !== 'stitch') {
        throw new Error("Project has no current video head to process");
    }

    // Prepare Output Directory
    const outputDir = path.join(__dirname, 'projects', project.id, 'artifacts');
    try {
        await fs.mkdir(outputDir, { recursive: true });
    } catch (e) { /* ignore if exists */ }

    // Generate Output Filename
    const outputFileName = `v${project.operations.length + 1}_${operation.type}_${operation.id}.mp4`;
    const absoluteOutputPath = path.join(outputDir, outputFileName);

    // Determine Input Path (for single-file operations like trim/text)
    let absoluteInputPath = '';
    if (project.currentHead) {
        const relativePath = project.currentHead.replace(/^\/projects\//, '');
        absoluteInputPath = path.join(__dirname, 'projects', relativePath);
    }

    console.log(`[Processor] Processing ${operation.type}...`);

    return new Promise(async (resolve, reject) => {
        // Initialize command for single-file operations
        // (Stitch creates its own specific commands inside its block)
        const command = ffmpeg(absoluteInputPath);

        // --- 1. TRIM OPERATION ---
        if (operation.type === 'trim') {
            const { start, end } = operation.params;
            command.setStartTime(start).setDuration(end - start)
                .output(absoluteOutputPath)
                .on('end', () => resolve(`/projects/${project.id}/artifacts/${outputFileName}`))
                .on('error', reject).run();

            // --- 2. TEXT OVERLAY OPERATION ---
        } else if (operation.type === 'text') {
            const { text, x, y, fontSize, color } = operation.params;
            // FFmpeg drawtext filter
            const filterString = `drawtext=text='${text}':fontcolor=${color}:fontsize=${fontSize}:x=(w-text_w)*${x}/100:y=(h-text_h)*${y}/100`;
            command.videoFilters([filterString])
                .output(absoluteOutputPath)
                .on('end', () => resolve(`/projects/${project.id}/artifacts/${outputFileName}`))
                .on('error', reject).run();

            // --- 3. SUBTITLE BURN-IN OPERATION ---
        } else if (operation.type === 'subtitle') {
            const { subtitles } = operation.params;

            // 1. Create temporary SRT file
            const srtContent = generateSRT(subtitles);
            const srtPath = path.join(outputDir, `temp_${Date.now()}.srt`);
            await fs.writeFile(srtPath, srtContent);

            // 2. Burn subtitles
            // Escape path for Windows filter syntax: C:\Path -> C:/Path and : -> \:
            const srtUrl = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            const style = "Fontname=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=20";

            command
                .videoFilters(`subtitles='${srtUrl}':force_style='${style}'`)
                .output(absoluteOutputPath)
                .on('end', async () => {
                    console.log('Subtitle burn-in finished');
                    await fs.unlink(srtPath).catch(() => { });
                    resolve(`/projects/${project.id}/artifacts/${outputFileName}`);
                })
                .on('error', (err) => {
                    console.error('Subtitle error:', err);
                    reject(err);
                })
                .run();

            // --- 4. STITCH / RENDER OPERATION (Video + Audio Mixing) ---
        } else if (operation.type === 'stitch') {
            const clips = operation.params.clips || [];
            const audioClips = operation.params.audioClips || [];
            const globalMix = operation.params.globalMix || { videoMixGain: 1.0, audioMixGain: 1.0 };

            // If no clips, nothing to render
            if (!clips.length) {
                return reject(new Error("No video clips provided for stitching"));
            }

            const tempFiles: string[] = [];

            try {
                // --- STEP 4A: PROCESS VIDEO CLIPS ---
                const processedVideoParts: string[] = [];

                for (let i = 0; i < clips.length; i++) {
                    const clip = clips[i];
                    const inputPath = getAbsolutePath(project.id, clip.url);
                    const tempPath = path.join(outputDir, `temp_v_${i}_${Date.now()}.mp4`);

                    // Verify file exists
                    try { await fs.access(inputPath); }
                    catch { throw new Error(`Video file not found: ${inputPath}`); }

                    let duration = clip.end - clip.start;
                    if (duration < 0.1) duration = 0.1;

                    // Apply Filters: Speed & Volume
                    const speed = clip.playbackRate || 1.0;
                    const volume = clip.volume !== undefined ? clip.volume : 1.0;

                    // FFmpeg setpts filter for speed (inverse relationship: 2x speed = 0.5*PTS)
                    const videoFilter = `setpts=${1 / speed}*PTS`;
                    // FFmpeg atempo filter for audio speed (limited to 0.5 to 2.0 range per pass, chaining needed for more but keeping simple)
                    // Also applying volume filter
                    const audioFilter = `atempo=${speed},volume=${volume}`;

                    // Trim and Normalize (important for concatenation)
                    await new Promise<void>((res, rej) => {
                        ffmpeg(inputPath)
                            .setStartTime(clip.start)
                            .setDuration(duration)
                            .outputOptions([
                                '-c:v libx264', '-preset ultrafast', '-crf 23', // Standardize video
                                '-c:a aac', '-ar 44100', '-ac 2',               // Standardize audio
                                `-filter:v ${videoFilter}`,
                                `-filter:a ${audioFilter}`
                            ])
                            .output(tempPath)
                            .on('end', () => res())
                            .on('error', rej)
                            .run();
                    });

                    processedVideoParts.push(tempPath);
                    tempFiles.push(tempPath);
                }

                // Create Video Concat List
                const videoListFile = path.join(outputDir, `vid_list_${Date.now()}.txt`);
                // Use forward slashes for FFmpeg concat file
                const videoListContent = processedVideoParts.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
                await fs.writeFile(videoListFile, videoListContent);
                tempFiles.push(videoListFile);


                // --- STEP 4B: PROCESS AUDIO CLIPS (If any) ---
                let audioTrackPath: string | null = null;

                if (audioClips.length > 0) {
                    const processedAudioParts: string[] = [];

                    for (let i = 0; i < audioClips.length; i++) {
                        const clip = audioClips[i];
                        const inputPath = getAbsolutePath(project.id, clip.url);
                        const tempPath = path.join(outputDir, `temp_a_${i}_${Date.now()}.mp3`);

                        try { await fs.access(inputPath); }
                        catch { throw new Error(`Audio file not found: ${inputPath}`); }

                        let duration = clip.end - clip.start;
                        if (duration < 0.1) duration = 0.1;

                        const volume = clip.volume !== undefined ? clip.volume : 1.0;

                        // Trim and Normalize Audio
                        await new Promise<void>((res, rej) => {
                            ffmpeg(inputPath)
                                .setStartTime(clip.start)
                                .setDuration(duration)
                                .outputOptions([
                                    '-c:a libmp3lame', '-ar 44100', '-ac 2',
                                    `-filter:a volume=${volume}`
                                ])
                                .output(tempPath)
                                .on('end', () => res())
                                .on('error', rej)
                                .run();
                        });

                        processedAudioParts.push(tempPath);
                        tempFiles.push(tempPath);
                    }

                    // Create Audio Concat List
                    const audioListFile = path.join(outputDir, `aud_list_${Date.now()}.txt`);
                    const audioListContent = processedAudioParts.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
                    await fs.writeFile(audioListFile, audioListContent);
                    tempFiles.push(audioListFile);

                    // Concat all audio clips into one continuous track
                    audioTrackPath = path.join(outputDir, `full_audio_track_${Date.now()}.mp3`);
                    await new Promise<void>((res, rej) => {
                        ffmpeg()
                            .input(audioListFile)
                            .inputOptions(['-f concat', '-safe 0'])
                            .output(audioTrackPath!)
                            .on('end', () => res())
                            .on('error', rej)
                            .run();
                    });
                    tempFiles.push(audioTrackPath);
                }


                // --- STEP 4C: FINAL MIX (Video + Audio) ---

                // Scenario 1: Video only (No audio clips added)
                if (!audioTrackPath) {
                    // Even if no external audio, we might want to apply the global video mix gain
                    // But 'copy' is faster if gain is 1.0. If gain != 1.0, we need to re-encode audio.
                    // For simplicity, let's re-encode if gain is not 1.0, else copy.

                    if (globalMix.videoMixGain !== 1.0) {
                        await new Promise<void>((res, rej) => {
                            ffmpeg()
                                .input(videoListFile)
                                .inputOptions(['-f concat', '-safe 0'])
                                .outputOptions([
                                    '-c:v copy',
                                    '-c:a aac', '-b:a 192k',
                                    `-filter:a volume=${globalMix.videoMixGain}`
                                ])
                                .output(absoluteOutputPath)
                                .on('end', () => res())
                                .on('error', rej)
                                .run();
                        });
                    } else {
                        await new Promise<void>((res, rej) => {
                            ffmpeg()
                                .input(videoListFile)
                                .inputOptions(['-f concat', '-safe 0'])
                                .outputOptions(['-c copy']) // Fast stream copy
                                .output(absoluteOutputPath)
                                .on('end', () => res())
                                .on('error', rej)
                                .run();
                        });
                    }
                }
                // Scenario 2: Video + Audio Mixing
                else {
                    // 1. First, concatenate the video sequence to a single temp file
                    const concatenatedVideoPath = path.join(outputDir, `concat_video_${Date.now()}.mp4`);
                    tempFiles.push(concatenatedVideoPath);

                    await new Promise<void>((res, rej) => {
                        ffmpeg()
                            .input(videoListFile)
                            .inputOptions(['-f concat', '-safe 0'])
                            .outputOptions(['-c copy'])
                            .output(concatenatedVideoPath)
                            .on('end', () => res())
                            .on('error', rej)
                            .run();
                    });

                    // 2. Mix the concatenated video with the concatenated audio
                    // Apply Global Gains here
                    const vGain = globalMix.videoMixGain ?? 1.0;
                    const aGain = globalMix.audioMixGain ?? 1.0;

                    await new Promise<void>((res, rej) => {
                        ffmpeg()
                            .input(concatenatedVideoPath) // Input 0
                            .input(audioTrackPath!)       // Input 1
                            .complexFilter([
                                // Apply volume to each input first, then mix
                                `[0:a]volume=${vGain}[a0]`,
                                `[1:a]volume=${aGain}[a1]`,
                                `[a0][a1]amix=inputs=2:duration=first[aout]`
                            ])
                            .outputOptions([
                                '-c:v copy',       // Copy video stream (no re-encoding)
                                '-map 0:v',        // Map video from input 0
                                '-map [aout]',     // Map the mixed audio
                                '-c:a aac',        // Re-encode audio to AAC
                                '-b:a 192k'
                            ])
                            .output(absoluteOutputPath)
                            .on('end', () => res())
                            .on('error', rej)
                            .run();
                    });
                }

                // --- STEP 4D: CLEANUP ---
                // Attempt to delete all temporary files
                await Promise.allSettled(tempFiles.map(f => fs.unlink(f)));

                resolve(`/projects/${project.id}/artifacts/${outputFileName}`);

            } catch (err) {
                // Cleanup on error
                await Promise.allSettled(tempFiles.map(f => fs.unlink(f)));
                console.error("[Processor] Stitch/Mix failed:", err);
                reject(err);
            }

        } else {
            reject(new Error(`Unknown operation type: ${operation.type}`));
        }
    });
}