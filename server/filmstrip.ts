// server/filmstrip.ts
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export async function generateFilmstrip(
    projectDir: string,
    videoFilename: string,
    count: number = 5
): Promise<string[]> {
    const sourcePath = path.join(projectDir, 'source', videoFilename);
    const filmstripDir = path.join(projectDir, 'filmstrips', videoFilename);

    if (!existsSync(filmstripDir)) {
        await fs.mkdir(filmstripDir, { recursive: true });
    }

    const existing = await fs.readdir(filmstripDir);
    if (existing.length >= count) {
        return existing.sort().map(f => `/projects/${path.basename(projectDir)}/filmstrips/${videoFilename}/${f}`);
    }

    console.log(`[Server] Generating filmstrip for ${videoFilename}...`);

    return new Promise((resolve, reject) => {
        ffmpeg(sourcePath)
            .on('end', async () => {
                const files = await fs.readdir(filmstripDir);
                const urls = files.sort().map(f => `/projects/${path.basename(projectDir)}/filmstrips/${videoFilename}/${f}`);
                resolve(urls);
            })
            .on('error', (err: any) => {
                console.error('[Server] Filmstrip error:', err);
                reject(err);
            })
            .screenshots({
                count: count,
                folder: filmstripDir,
                filename: 'frame_%i.jpg',
                size: '320x180'
            });
    });
}