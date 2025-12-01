// server/transcriber.ts
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURATION
const WHISPER_BIN = path.join(__dirname, 'whisper-cli');
const WHISPER_MODEL = path.join(__dirname, 'ggml-base.en.bin');

export async function extractAudio(videoPath: string, outputDir: string): Promise<string> {
    const audioPath = path.join(outputDir, `extracted_${crypto.randomUUID()}.wav`);

    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .outputOptions([
                '-ar 16000', // Whisper requires 16kHz
                '-ac 1',     // Mono
                '-c:a pcm_s16le'
            ])
            .output(audioPath)
            .on('end', () => resolve(audioPath))
            .on('error', (err) => {
                console.error("[FFmpeg] Extraction error:", err);
                reject(new Error("Failed to extract audio. Is FFmpeg installed?"));
            })
            .run();
    });
}

export async function transcribeVideo(videoPath: string, projectDir: string): Promise<any[]> {
    console.log(`[Transcriber] 1. Extracting audio from: ${path.basename(videoPath)}`);

    let audioPath: string;
    try {
        audioPath = await extractAudio(videoPath, projectDir);
    } catch (e: any) {
        throw new Error(e.message);
    }

    const jsonPath = audioPath + '.json';

    try {
        console.log(`[Transcriber] 2. Checking Whisper environment...`);

        // Ensure binary and model exist
        try {
            await fs.access(WHISPER_BIN);
            await fs.access(WHISPER_MODEL);
        } catch (e) {
            throw new Error(`Missing 'whisper-cli' or 'ggml-base.en.bin' in server folder: ${__dirname}`);
        }

        // AUTO-FIX: Ensure binary is executable (Linux/Mac)
        if (process.platform !== 'win32') {
            try {
                await execAsync(`chmod +x "${WHISPER_BIN}"`);
            } catch (e) {
                console.warn("[Transcriber] Failed to set +x permission on whisper-cli. Try running 'chmod +x server/whisper-cli' manually.");
            }
        }

        console.log(`[Transcriber] 3. Running Whisper AI...`);
        // Command breakdown:
        // -m: Model path
        // -f: Input file
        // -oj: Output JSON
        // -np: No progress output (clean logs)
        const cmd = `"${WHISPER_BIN}" -m "${WHISPER_MODEL}" -f "${audioPath}" -oj -np`;

        await execAsync(cmd);

        // Verify output exists
        try {
            await fs.access(jsonPath);
        } catch (e) {
            throw new Error("Whisper ran but generated no JSON output. Check server logs.");
        }

        console.log(`[Transcriber] 4. Parsing results...`);
        const fileContent = await fs.readFile(jsonPath, 'utf-8');
        const data = JSON.parse(fileContent);

        // Support various Whisper JSON formats (result vs transcription vs flat array)
        const items = data.transcription || data.result || [];

        return items.map((item: any) => ({
            id: crypto.randomUUID(),
            // Safe timestamp parsing
            start: item.offsets?.from ? item.offsets.from / 1000 : parseTime(item.timestamps?.from),
            end: item.offsets?.to ? item.offsets.to / 1000 : parseTime(item.timestamps?.to),
            text: item.text.trim()
        }));

    } catch (error: any) {
        console.error("[Transcriber] Error:", error.message || error);
        throw error; // Propagate error to frontend
    } finally {
        // Cleanup
        try { await fs.unlink(audioPath); } catch { }
        try { await fs.unlink(jsonPath); } catch { }
    }
}

// Helper: Parse "00:00:01,000" string to seconds
function parseTime(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 3) return 0;

    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const sParts = parts[2].split(/[,\.]/);
    const s = parseInt(sParts[0], 10);
    const ms = sParts[1] ? parseInt(sParts[1], 10) : 0;

    return (h * 3600) + (m * 60) + s + (ms / 1000);
}