// server/processor.ts
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

export async function processOperation(project: Project, operation: ProjectOperation, onProgress?: (progress: number) => void): Promise<string> {
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

        // Helper for single-pass FFmpeg progress
        const handleSinglePassProgress = (p: any) => {
            if (onProgress && p.percent) {
                onProgress(Math.min(99, Math.round(p.percent)));
            }
        };

        // --- 1. TRIM OPERATION ---
        if (operation.type === 'trim') {
            const { start, end } = operation.params;
            command.setStartTime(start).setDuration(end - start)
                .output(absoluteOutputPath)
                .on('progress', handleSinglePassProgress)
                .on('end', () => {
                    if (onProgress) onProgress(100);
                    resolve(`/projects/${project.id}/artifacts/${outputFileName}`);
                })
                .on('error', reject).run();

            // --- 2. TEXT OVERLAY OPERATION ---
        } else if (operation.type === 'text') {
            const { text, x, y, fontSize, color } = operation.params;
            // FFmpeg drawtext filter
            const filterString = `drawtext=text='${text}':fontcolor=${color}:fontsize=${fontSize}:x=(w-text_w)*${x}/100:y=(h-text_h)*${y}/100`;
            command.videoFilters([filterString])
                .output(absoluteOutputPath)
                .on('progress', handleSinglePassProgress)
                .on('end', () => {
                    if (onProgress) onProgress(100);
                    resolve(`/projects/${project.id}/artifacts/${outputFileName}`);
                })
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
                .on('progress', handleSinglePassProgress)
                .on('end', async () => {
                    console.log('Subtitle burn-in finished');
                    await fs.unlink(srtPath).catch(() => { });
                    if (onProgress) onProgress(100);
                    resolve(`/projects/${project.id}/artifacts/${outputFileName}`);
                })
                .on('error', (err) => {
                    console.error('Subtitle error:', err);
                    reject(err);
                })
                .run();

            // --- 4. STITCH / RENDER OPERATION (Video + Images + Audio Mixing) ---
        } else if (operation.type === 'stitch') {
            const clips = operation.params.clips || [];
            const audioClips = operation.params.audioClips || [];
            const globalMix = operation.params.globalMix || { videoMixGain: 1.0, audioMixGain: 1.0 };

            // If no clips, nothing to render
            if (!clips.length) {
                return reject(new Error("No clips provided for stitching"));
            }

            const tempFiles: string[] = [];

            // Progress Weighting
            // Video Clips: 50%
            // Audio Clips: 10%
            // Final Mix: 40%
            let currentProgress = 0;
            const updateStitchProgress = (stageBase: number, stageWeight: number, percent: number) => {
                if (onProgress) {
                    const p = stageBase + (stageWeight * (percent / 100));
                    if (p > currentProgress) {
                        currentProgress = p;
                        onProgress(Math.min(99, Math.round(currentProgress)));
                    }
                }
            };

            try {
                // --- STEP 4A: PROCESS VIDEO/IMAGE CLIPS ---
                const processedVideoParts: string[] = [];
                const totalVideoClips = clips.length;
                const videoStageWeight = 50;

                for (let i = 0; i < clips.length; i++) {
                    const clip = clips[i];
                    const inputPath = getAbsolutePath(project.id, clip.url);
                    const tempPath = path.join(outputDir, `temp_v_${i}_${Date.now()}.mp4`);

                    // Verify file exists
                    try { await fs.access(inputPath); }
                    catch { throw new Error(`File not found: ${inputPath}`); }

                    // Check if Image (based on type from frontend OR extension)
                    const isImage = clip.type === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(clip.url);

                    await new Promise<void>((res, rej) => {
                        const clipWeight = videoStageWeight / totalVideoClips;
                        const clipBase = (i * clipWeight);

                        if (isImage) {
                            // --- IMAGE PROCESSING PATH ---
                            // 1. Loop image
                            // 2. Generate silent audio (anullsrc)
                            // 3. Scale & Pad to match project dimensions
                            // 4. Set duration explicitly
                            const duration = clip.duration || 3;
                            const width = project.width || 1920;
                            const height = project.height || 1080;

                            ffmpeg()
                                // Input 0: Image
                                .input(inputPath)
                                .inputOptions(['-loop 1'])
                                // Input 1: Silent Audio
                                .input('anullsrc=channel_layout=stereo:sample_rate=44100')
                                .inputFormat('lavfi')
                                .outputOptions([
                                    `-t ${duration}`, // Duration for the whole output
                                    '-c:v libx264',
                                    '-preset ultrafast',
                                    '-pix_fmt yuv420p',
                                    // Scale to fit, Pad to center, Square pixels
                                    `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
                                    '-c:a aac',
                                    '-shortest' // Stop when duration ends (driven by -t)
                                ])
                                .output(tempPath)
                                .on('progress', (p) => {
                                    // Fake progress for image generation usually instant, but good to have
                                    updateStitchProgress(0, 1, clipBase + 50);
                                })
                                .on('end', () => {
                                    updateStitchProgress(0, 1, (i + 1) * clipWeight);
                                    res();
                                })
                                .on('error', (err) => {
                                    console.error(`Error processing image ${clip.url}:`, err);
                                    rej(err);
                                })
                                .run();

                        } else {
                            // --- VIDEO PROCESSING PATH ---
                            let duration = clip.end - clip.start;
                            if (duration < 0.1) duration = 0.1;

                            const speed = clip.playbackRate || 1.0;
                            const volume = clip.volume !== undefined ? clip.volume : 1.0;

                            const videoFilter = `setpts=${1 / speed}*PTS`;

                            let audioFilter = '';
                            if (speed >= 0.5 && speed <= 2.0) {
                                audioFilter = `atempo=${speed},volume=${volume}`;
                            } else if (speed > 2.0) {
                                audioFilter = `atempo=2.0,atempo=${speed / 2},volume=${volume}`;
                            } else {
                                audioFilter = `atempo=0.5,atempo=${speed * 2},volume=${volume}`;
                            }

                            ffmpeg(inputPath)
                                .setStartTime(clip.start)
                                .setDuration(duration)
                                .outputOptions([
                                    '-c:v libx264', '-preset ultrafast', '-crf 23',
                                    '-c:a aac', '-ar 44100', '-ac 2',
                                    `-filter:v ${videoFilter}`,
                                    `-filter:a ${audioFilter}`
                                ])
                                .output(tempPath)
                                .on('progress', (p) => {
                                    const percent = p.percent || 0;
                                    updateStitchProgress(0, 1, clipBase + (clipWeight * (percent / 100)));
                                })
                                .on('end', () => {
                                    updateStitchProgress(0, 1, (i + 1) * clipWeight);
                                    res();
                                })
                                .on('error', rej)
                                .run();
                        }
                    });

                    processedVideoParts.push(tempPath);
                    tempFiles.push(tempPath);
                }

                // Create Video Concat List
                const videoListFile = path.join(outputDir, `vid_list_${Date.now()}.txt`);
                const videoListContent = processedVideoParts.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
                await fs.writeFile(videoListFile, videoListContent);
                tempFiles.push(videoListFile);


                // --- STEP 4B: PROCESS AUDIO CLIPS (If any) ---
                let audioTrackPath: string | null = null;
                const audioStageWeight = 10;
                const currentBase = videoStageWeight;

                if (audioClips.length > 0) {
                    const processedAudioParts: string[] = [];
                    const totalAudioClips = audioClips.length;

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
                                .on('progress', (p) => {
                                    const clipWeight = audioStageWeight / totalAudioClips;
                                    const clipBase = currentBase + (i * clipWeight);
                                    const percent = p.percent || 0;
                                    updateStitchProgress(0, 1, clipBase + (clipWeight * (percent / 100)));
                                })
                                .on('end', () => {
                                    const clipWeight = audioStageWeight / totalAudioClips;
                                    updateStitchProgress(0, 1, currentBase + ((i + 1) * clipWeight));
                                    res();
                                })
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
                } else {
                    // Skip audio stage progress
                    updateStitchProgress(0, 1, currentBase + audioStageWeight);
                }


                // --- STEP 4C: FINAL MIX (Video + Audio) ---
                const mixStageWeight = 40;
                const mixBase = videoStageWeight + audioStageWeight;

                // Scenario 1: Video only (No audio clips added)
                if (!audioTrackPath) {
                    // Even if no external audio, we might want to apply the global video mix gain.
                    // Note: Since we generated silent audio for images, they DO have an audio track now.
                    // So we can safely map audio from the concat list.

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
                                .on('progress', (p) => {
                                    const percent = p.percent || 0;
                                    updateStitchProgress(mixBase, mixStageWeight, percent);
                                })
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
                                .on('progress', (p) => {
                                    // Copy is fast, but we can still track it
                                    const percent = p.percent || 0;
                                    updateStitchProgress(mixBase, mixStageWeight, percent);
                                })
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

                    const concatWeight = 10;
                    const finalMixWeight = 30;

                    await new Promise<void>((res, rej) => {
                        ffmpeg()
                            .input(videoListFile)
                            .inputOptions(['-f concat', '-safe 0'])
                            .outputOptions(['-c copy'])
                            .output(concatenatedVideoPath)
                            .on('progress', (p) => {
                                const percent = p.percent || 0;
                                updateStitchProgress(mixBase, concatWeight, percent);
                            })
                            .on('end', () => res())
                            .on('error', rej)
                            .run();
                    });

                    // 2. Mix the concatenated video with the concatenated audio
                    const vGain = globalMix.videoMixGain ?? 1.0;
                    const aGain = globalMix.audioMixGain ?? 1.0;

                    await new Promise<void>((res, rej) => {
                        ffmpeg()
                            .input(concatenatedVideoPath) // Input 0 (Video + potential silent/original audio)
                            .input(audioTrackPath!)       // Input 1 (Overlay Audio)
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
                            .on('progress', (p) => {
                                const percent = p.percent || 0;
                                updateStitchProgress(mixBase + concatWeight, finalMixWeight, percent);
                            })
                            .on('end', () => res())
                            .on('error', rej)
                            .run();
                    });
                }

                // --- STEP 4D: CLEANUP ---
                // Attempt to delete all temporary files
                await Promise.allSettled(tempFiles.map(f => fs.unlink(f)));

                if (onProgress) onProgress(100);
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