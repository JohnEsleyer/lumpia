
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

/**
 * Converts input video to a web-friendly format (H.264/AAC MP4)
 * This ensures playback compatibility in browsers and Remotion.
 */
export async function standardizeVideo(inputPath: string, outputDir: string): Promise<string> {
    const filename = path.basename(inputPath, path.extname(inputPath));
    const outputName = `${filename}_clean.mp4`;
    const outputPath = path.join(outputDir, outputName);

    console.log(`[Processor] Standardizing video: ${inputPath} -> ${outputPath}`);

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',      // Force H.264 codec
                '-preset veryfast',  // Fast encoding
                '-crf 23',           // Good balance of quality/size
                '-c:a aac',          // Force AAC audio
                '-b:a 128k',         // Reasonable audio bitrate
                '-movflags +faststart', // Optimize for web streaming
                '-pix_fmt yuv420p'   // Ensure compatibility with all players
            ])
            .output(outputPath)
            .on('end', async () => {
                console.log('[Processor] Standardization complete');
                resolve(outputName);
            })
            .on('error', (err) => {
                console.error('[Processor] Encoding error:', err);
                reject(err);
            })
            .run();
    });
}


export async function processOperation(project: Project, operation: ProjectOperation): Promise<string> {
    // Stitch operations might not use the currentHead (they might combine multiple assets),
    // so we skip this check for 'stitch'.
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

    // Determine Input Path (for single-file operations)
    let absoluteInputPath = '';
    if (project.currentHead) {
        // Remove the web prefix /projects/ID/... to get relative path
        const relativePath = project.currentHead.replace(/^\/projects\//, '');
        absoluteInputPath = path.join(__dirname, 'projects', relativePath);
    }

    console.log(`[Processor] Processing ${operation.type}...`);

    return new Promise(async (resolve, reject) => {
        const command = ffmpeg(absoluteInputPath);

        if (operation.type === 'trim') {
            const { start, end } = operation.params;
            command.setStartTime(start).setDuration(end - start)
                .output(absoluteOutputPath)
                .on('end', () => resolve(`/projects/${project.id}/artifacts/${outputFileName}`))
                .on('error', reject).run();

        } else if (operation.type === 'text') {
            const { text, x, y, fontSize, color } = operation.params;
            // FFmpeg drawtext filter
            const filterString = `drawtext=text='${text}':fontcolor=${color}:fontsize=${fontSize}:x=(w-text_w)*${x}/100:y=(h-text_h)*${y}/100`;
            command.videoFilters([filterString])
                .output(absoluteOutputPath)
                .on('end', () => resolve(`/projects/${project.id}/artifacts/${outputFileName}`))
                .on('error', reject).run();

        } else if (operation.type === 'stitch') {
            // Params: clips: { url, start, end }[]
            const clips = operation.params.clips as { url: string; start: number; end: number }[];
            const tempFiles: string[] = [];

            try {
                // 1. Process each clip: Trim and Standardize
                for (let i = 0; i < clips.length; i++) {
                    const clip = clips[i];

                    // FIX: Decode URI to handle spaces (%20)
                    const rawFilename = clip.url.split('/').pop() || '';
                    const filename = decodeURIComponent(rawFilename);

                    if (!filename) throw new Error(`Invalid clip URL: ${clip.url}`);

                    // FIX: Determine if file is in 'source' or 'artifacts'
                    const isArtifact = clip.url.includes('/artifacts/');
                    const folder = isArtifact ? 'artifacts' : 'source';
                    const inputPath = path.join(__dirname, 'projects', project.id, folder, filename);

                    // Verify file exists
                    try {
                        await fs.access(inputPath);
                    } catch {
                        throw new Error(`File not found on server: ${inputPath}`);
                    }

                    // Duration safety
                    let duration = clip.end - clip.start;
                    if (duration <= 0.1) duration = 0.1;

                    const tempName = `temp_stitch_${i}_${Date.now()}.mp4`;
                    const tempPath = path.join(outputDir, tempName);

                    // Create a standardized chunk
                    await new Promise<void>((resolveTrim, rejectTrim) => {
                        ffmpeg(inputPath)
                            .setStartTime(clip.start)
                            .setDuration(duration)
                            .outputOptions([
                                '-c:v libx264', '-preset ultrafast', '-crf 23',
                                '-c:a aac', '-b:a 128k', '-ar 44100' // Normalize audio rate
                            ])
                            .output(tempPath)
                            .on('end', () => resolveTrim())
                            .on('error', (err) => {
                                console.error(`[Processor] Clip ${i} failed:`, err);
                                rejectTrim(err);
                            })
                            .run();
                    });
                    tempFiles.push(tempPath);
                }

                // 2. Create concat list file
                const listFileName = `concat_list_${Date.now()}.txt`;
                const listPath = path.join(outputDir, listFileName);

                // Escape paths for FFmpeg concat demuxer
                // Windows paths with backslashes need to be converted to forward slashes or escaped
                const fileContent = tempFiles
                    .map(f => `file '${f.replace(/\\/g, '/')}'`)
                    .join('\n');

                await fs.writeFile(listPath, fileContent);

                // 3. Concatenate
                await new Promise<void>((resolveConcat, rejectConcat) => {
                    ffmpeg()
                        .input(listPath)
                        .inputOptions(['-f concat', '-safe 0'])
                        .outputOptions(['-c copy']) // Stream copy for speed (formats already matched)
                        .output(absoluteOutputPath)
                        .on('end', () => resolveConcat())
                        .on('error', (err) => {
                            console.error("[Processor] Concat failed:", err);
                            rejectConcat(err);
                        })
                        .run();
                });

                // 4. Cleanup
                await fs.unlink(listPath).catch(() => { });
                for (const f of tempFiles) {
                    await fs.unlink(f).catch(() => { });
                }

                resolve(`/projects/${project.id}/artifacts/${outputFileName}`);

            } catch (err) {
                // Cleanup on error
                for (const f of tempFiles) {
                    await fs.unlink(f).catch(() => { });
                }
                reject(err);
            }

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
        } else {
            reject(new Error(`Unknown operation type: ${operation.type}`));
        }
    });
}