
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
                // Optional: Delete original if you want to save space
                // await fs.unlink(inputPath); 
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
    if (!project.currentHead) {
        throw new Error("Project has no current video head to process");
    }

    const relativePath = project.currentHead.replace(/^\/projects\//, '');
    const absoluteInputPath = path.join(__dirname, 'projects', relativePath);

    const outputFileName = `v${project.operations.length + 1}_${operation.type}.mp4`;
    const outputDir = path.join(__dirname, 'projects', project.id, 'artifacts');
    const absoluteOutputPath = path.join(outputDir, outputFileName);

    console.log(`Processing ${operation.type} on ${absoluteInputPath} -> ${absoluteOutputPath}`);

    return new Promise(async (resolve, reject) => {
        const command = ffmpeg(absoluteInputPath);

        if (operation.type === 'trim') {
            // ... (existing trim code)
            const { start, end } = operation.params;
            command.setStartTime(start).setDuration(end - start)
                .output(absoluteOutputPath)
                .on('end', () => resolve(`/projects/${project.id}/artifacts/${outputFileName}`))
                .on('error', reject).run();

        } else if (operation.type === 'text') {
            // ... (existing text code)
            // Simplified for brevity, assume existing code is here
            const { text, x, y, fontSize, color } = operation.params;
            const filterString = `drawtext=text='${text}':fontcolor=${color}:fontsize=${fontSize}:x=(w-text_w)*${x}/100:y=(h-text_h)*${y}/100`;
            command.videoFilters([filterString])
                .output(absoluteOutputPath)
                .on('end', () => resolve(`/projects/${project.id}/artifacts/${outputFileName}`))
                .on('error', reject).run();

        } else if (operation.type === 'stitch') {
            const clips = operation.params.clips as { url: string; start: number; end: number }[];
            const tempFiles: string[] = [];

            try {
                // 1. Create temporary trimmed files for each clip
                for (let i = 0; i < clips.length; i++) {
                    const clip = clips[i];
                    // Extract filename from URL (assuming /projects/:id/source/:filename format)
                    const filename = clip.url.split('/').pop();
                    if (!filename) throw new Error(`Invalid clip URL: ${clip.url}`);

                    const inputPath = path.join(__dirname, 'projects', project.id, 'source', filename);
                    const tempName = `temp_stitch_${i}_${Date.now()}.mp4`;
                    const tempPath = path.join(outputDir, tempName);

                    await new Promise<void>((resolveTrim, rejectTrim) => {
                        ffmpeg(inputPath)
                            .setStartTime(clip.start)
                            .setDuration(clip.end - clip.start)
                            .outputOptions([
                                '-c:v libx264', '-preset ultrafast', '-crf 23',
                                '-c:a aac', '-b:a 128k'
                            ]) // Re-encode to ensure consistent format for concat
                            .output(tempPath)
                            .on('end', () => resolveTrim())
                            .on('error', rejectTrim)
                            .run();
                    });
                    tempFiles.push(tempPath);
                }

                // 2. Create concat list file
                const listFileName = `concat_list_${Date.now()}.txt`;
                const listPath = path.join(outputDir, listFileName);
                const fileContent = tempFiles.map(f => `file '${f}'`).join('\n');
                await fs.writeFile(listPath, fileContent);

                // 3. Concatenate
                await new Promise<void>((resolveConcat, rejectConcat) => {
                    ffmpeg()
                        .input(listPath)
                        .inputOptions(['-f concat', '-safe 0'])
                        .outputOptions(['-c copy']) // Copy since we re-encoded segments to match
                        .output(absoluteOutputPath)
                        .on('end', () => resolveConcat())
                        .on('error', rejectConcat)
                        .run();
                });

                // 4. Cleanup
                await fs.unlink(listPath).catch(console.error);
                for (const f of tempFiles) {
                    await fs.unlink(f).catch(console.error);
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

            // 2. Burn subtitles using FFmpeg
            // Note: 'subtitles' filter is powerful. 
            // force_style allows us to mimic the React design loosely (Font, Size, Outline)
            const style = "Fontname=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=20";

            // For Windows paths, FFmpeg requires escaping in the subtitles filter
            // const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            // Simplified relative path usage often works better to avoid drive letter issues:

            command
                .videoFilters(`subtitles=${srtPath}:force_style='${style}'`)
                .output(absoluteOutputPath)
                .on('end', async () => {
                    console.log('Subtitle burn-in finished');
                    await fs.unlink(srtPath).catch(console.error); // Cleanup
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