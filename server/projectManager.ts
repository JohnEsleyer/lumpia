// server/projectManager.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import { existsSync } from 'fs';

// Note: We use .js extensions for local imports in ESM mode
import type { Project, CreateProjectDTO, ProjectOperation } from './types.js';
import { generateFilmstrip } from './filmstrip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.join(__dirname, 'projects');

// Ensure projects directory exists on startup
(async () => {
    try {
        await fs.access(PROJECTS_DIR);
    } catch {
        await fs.mkdir(PROJECTS_DIR, { recursive: true });
    }
})();

/**
 * Helper: Generates a single thumbnail for the Project Dashboard card.
 * Saves as [filename].jpg in the source folder.
 */
async function ensureThumbnail(projectDir: string, videoFilename: string): Promise<string> {
    const sourceDir = path.join(projectDir, 'source');
    const videoPath = path.join(sourceDir, videoFilename);
    const thumbFilename = `${videoFilename}.jpg`;
    const thumbPath = path.join(sourceDir, thumbFilename);

    // If it exists, return immediately
    if (existsSync(thumbPath)) {
        return thumbFilename;
    }

    console.log(`[Server] Generating node thumbnail for: ${videoFilename}`);

    return new Promise((resolve) => {
        ffmpeg(videoPath)
            .screenshots({
                count: 1,
                timemarks: ['0.1'], // Take frame at 0.1s
                filename: thumbFilename,
                folder: sourceDir,
                size: '640x360' // Slightly larger for the node view
            })
            .on('end', () => resolve(thumbFilename))
            .on('error', (err) => {
                console.error(`[Server] Thumbnail failed for ${videoFilename}:`, err);
                // Return empty string on failure so UI doesn't crash
                resolve('');
            });
    });
}
/**
 * Reads a project's state.json file.
 */
export async function getProject(id: string): Promise<Project | null> {
    try {
        const statePath = path.join(PROJECTS_DIR, id, 'state.json');
        const data = await fs.readFile(statePath, 'utf-8');
        return JSON.parse(data) as Project;
    } catch (e) {
        return null;
    }
}

/**
 * Saves a project's state.json file.
 */
async function saveProjectState(id: string, state: Project): Promise<void> {
    const statePath = path.join(PROJECTS_DIR, id, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

/**
 * Lists all projects by reading directories in projects folder.
 */
export async function listProjects(): Promise<Project[]> {
    try {
        const dirs = await fs.readdir(PROJECTS_DIR);
        const projects: Project[] = [];
        for (const id of dirs) {
            // Skip system files like .DS_Store
            if (id.startsWith('.')) continue;

            const p = await getProject(id);
            if (p) projects.push(p);
        }
        return projects;
    } catch {
        return [];
    }
}

/**
 * Creates a new project, sets up folder structure, and processes the initial file.
 */
export async function createProject(metadata: CreateProjectDTO, file?: Express.Multer.File): Promise<Project> {
    const id = uuidv4();
    const projectDir = path.join(PROJECTS_DIR, id);

    // Create directory structure
    await fs.mkdir(projectDir);
    await fs.mkdir(path.join(projectDir, 'source'));
    await fs.mkdir(path.join(projectDir, 'artifacts'));
    await fs.mkdir(path.join(projectDir, 'filmstrips'));

    let finalSourcePath: string | null = null;
    let thumbnailPath: string | undefined = undefined;
    const assets: string[] = [];

    if (file) {
        // Sanitize filename
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_');
        const finalPath = path.join(projectDir, 'source', safeName);

        // Move uploaded file to project source
        await fs.rename(file.path, finalPath);

        finalSourcePath = `/projects/${id}/source/${safeName}`;
        assets.push(safeName);

        // 1. Generate Single Thumbnail (Foreground - fast) for Dashboard
        const thumbName = await ensureThumbnail(projectDir, safeName);
        if (thumbName) {
            thumbnailPath = `/projects/${id}/source/${thumbName}`;
        }

        // 2. Generate Filmstrip (Background - slower) for Editor
        generateFilmstrip(projectDir, safeName).catch(err =>
            console.error(`[Server] Background filmstrip generation failed for ${safeName}`, err)
        );
    }

    const project: Project = {
        id,
        name: metadata.name || 'Untitled Project',
        width: Number(metadata.width) || 1920,
        height: Number(metadata.height) || 1080,
        fps: Number(metadata.fps) || 30,
        assets,
        operations: [],
        currentHead: finalSourcePath,
        thumbnail: thumbnailPath,
        createdAt: new Date().toISOString(),
    };

    await saveProjectState(id, project);
    return project;
}

/**
 * Helper: Processes uploaded file.
 * Detects if video is H.265 (HEVC) and converts to H.264 if needed.
 * Otherwise, just moves the file.
 */
async function processUploadedFile(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // 1. Probe the file to check codec
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                console.error('[Server] Probe failed:', err);
                return reject(err);
            }

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const codec = videoStream?.codec_name;

            console.log(`[Server] Detected codec: ${codec}`);

            if (codec === 'hevc' || codec === 'h265') {
                console.log('[Server] Converting HEVC to H.264...');
                ffmpeg(inputPath)
                    .outputOptions([
                        '-c:v libx264',   // Convert video to H.264
                        '-c:a aac',       // Ensure audio is AAC
                        '-preset fast',   // Fast encoding
                        '-crf 23'         // Good quality
                    ])
                    .save(outputPath)
                    .on('end', () => {
                        console.log('[Server] Conversion complete.');
                        resolve();
                    })
                    .on('error', (convErr) => {
                        console.error('[Server] Conversion failed:', convErr);
                        reject(convErr);
                    });
            } else {
                // Just move the file
                fs.rename(inputPath, outputPath)
                    .then(() => resolve())
                    .catch(reject);
            }
        });
    });
}

/**
 * Adds a new video asset to an existing project.
 */
export async function addAsset(id: string, file: Express.Multer.File): Promise<void> {
    const project = await getProject(id);
    if (!project) throw new Error('Project not found');

    // Sanitize filename but ensure it ends in .mp4 if we might convert it
    // For simplicity, we keep original extension unless we force convert, 
    // but usually browsers play mp4/mov. Let's keep original name for now.
    const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_');
    const targetPath = path.join(PROJECTS_DIR, id, 'source', safeName);
    const projectDir = path.join(PROJECTS_DIR, id);

    // Process (Convert if needed)
    await processUploadedFile(file.path, targetPath);

    // Clean up temp file if it wasn't moved (i.e. if it was converted, the temp file still exists)
    // fs.rename moves it, but ffmpeg conversion reads from it.
    // If processUploadedFile used ffmpeg, we need to delete the temp file manually.
    // If it used fs.rename, the temp file is gone.
    // We can check if temp file exists and delete it.
    try {
        if (existsSync(file.path)) {
            await fs.unlink(file.path);
        }
    } catch (e) { /* ignore */ }

    // Update Project State
    if (!project.assets.includes(safeName)) {
        project.assets.push(safeName);
        await saveProjectState(id, project);
    }

    // Trigger Filmstrip Generation (Background)
    generateFilmstrip(projectDir, safeName).catch((err: unknown) =>
        console.error(`[Server] Background filmstrip failed for ${safeName}:`, err)
    );
}

/**
 * Returns full details of assets including filmstrip URLs.
 * Used by the Editor to populate the library and graph nodes.
 */
export async function getProjectAssets(id: string): Promise<Array<{
    name: string;
    url: string;
    thumbnailUrl: string;
    filmstrip: string[];
    duration?: number; // Added duration
}>> {
    const project = await getProject(id);
    if (!project) throw new Error("Project not found");

    const projectDir = path.join(PROJECTS_DIR, id);
    const results = [];

    for (const assetFilename of project.assets) {
        // 1. Ensure single thumbnail exists (Server processing step)
        const thumbName = await ensureThumbnail(projectDir, assetFilename);

        // 2. Ensure filmstrip exists (Background process)
        // We trigger it but don't strictly wait if we want fast load, 
        // but for this "server processing" requirement, we await to ensure images are ready.
        let frames: string[] = [];
        try {
            frames = await generateFilmstrip(projectDir, assetFilename);
        } catch (err: unknown) {
            console.warn(`[Server] Failed to load filmstrip for ${assetFilename}`, err);
        }

        // 3. Get Duration (Fast probe)
        let duration = 0;
        try {
            const videoPath = path.join(projectDir, 'source', assetFilename);
            await new Promise<void>((resolve) => {
                ffmpeg.ffprobe(videoPath, (err, metadata) => {
                    if (!err && metadata.format.duration) {
                        duration = metadata.format.duration;
                    }
                    resolve();
                });
            });
        } catch (e) { }

        results.push({
            name: assetFilename,
            url: `/projects/${id}/source/${assetFilename}`,
            thumbnailUrl: thumbName ? `/projects/${id}/source/${thumbName}` : '',
            filmstrip: frames,
            duration: duration
        });
    }

    return results;
}
/**
 * Adds an operation (trim, stitch, etc) to the project history.
 */
export async function addOperation(id: string, operation: ProjectOperation, newHead: string): Promise<Project> {
    const project = await getProject(id);
    if (!project) throw new Error('Project not found');

    project.operations.push(operation);
    project.currentHead = newHead;

    // Update main thumbnail if needed
    // (Optional: You could generate a new thumbnail from the newHead here)

    await saveProjectState(id, project);
    return project;
}

/**
 * Deletes a project and all its files.
 */
export async function deleteProject(id: string): Promise<void> {
    const targetDir = path.join(PROJECTS_DIR, id);
    // Force recursive delete
    await fs.rm(targetDir, { recursive: true, force: true });
}