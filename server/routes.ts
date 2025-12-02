// server/routes.ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    createProject,
    getProject,
    listProjects,
    addOperation,
    deleteProject,
    addAsset,
    getProjectAssets,
    deleteProjectAsset // Import this
} from './projectManager';
import { processOperation } from './processor';
import { transcribeVideo } from './transcriber';
import type { CreateProjectDTO } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRouter = express.Router();

const TEMP_UPLOAD_DIR = path.join(__dirname, 'uploads_temp');
(async () => {
    try { await fs.access(TEMP_UPLOAD_DIR); }
    catch { await fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true }); }
})();

const upload = multer({ dest: TEMP_UPLOAD_DIR });

// ... (Other routes: POST /, GET /, GET /:id, DELETE /:id remain the same) ...
projectRouter.post('/', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const project = await createProject(req.body as CreateProjectDTO, req.file);
        res.json(project);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

projectRouter.get('/', async (_req: Request, res: Response) => {
    try {
        const projects = await listProjects();
        res.json(projects);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

projectRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const project = await getProject(req.params.id);
        if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
        res.json(project);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// NEW: Asset Endpoint that triggers thumbnail generation
projectRouter.get('/:id/assets', async (req: Request, res: Response) => {
    try {
        const assets = await getProjectAssets(req.params.id);
        res.json(assets);
    } catch (error: any) {
        console.error("Asset fetch error:", error);
        res.status(500).json({ error: error.message });
    }
});

projectRouter.post('/:id/assets', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
        await addAsset(req.params.id, req.file);
        // Return the updated list immediately so frontend updates
        const assets = await getProjectAssets(req.params.id);
        res.json(assets);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

projectRouter.delete('/:id/assets/:filename', async (req: Request, res: Response) => {
    try {
        await deleteProjectAsset(req.params.id, req.params.filename);
        res.status(204).send();
    } catch (error: any) {
        console.error("Asset deletion error:", error);
        res.status(500).json({ error: error.message });
    }
});

projectRouter.post('/:id/operations', async (req: Request, res: Response) => {
    try {
        const project = await getProject(req.params.id);
        if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
        const operation = req.body;
        const newHead = await processOperation(project, operation);
        const updatedProject = await addOperation(project.id, operation, newHead);
        res.json(updatedProject);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ... (Transcribe and Delete remain the same)
projectRouter.delete('/:id', async (req: Request, res: Response) => {
    try {
        await deleteProject(req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

projectRouter.post('/:id/transcribe', async (req: Request, res: Response) => {
    try {
        const project = await getProject(req.params.id);
        if (!project || !project.currentHead) {
            res.status(404).json({ error: 'Project or video not found' });
            return;
        }

        const relativePath = project.currentHead.replace(/^\/projects\//, '');
        const videoPath = path.join(__dirname, 'projects', relativePath);
        const projectDir = path.dirname(videoPath);

        const subtitles = await transcribeVideo(videoPath, projectDir);
        res.json({ subtitles });
    } catch (error: any) {
        console.error("Transcription error", error);
        res.status(500).json({ error: error.message });
    }
});