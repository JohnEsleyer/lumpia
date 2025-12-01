
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { projectRouter } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Global headers for SharedArrayBuffer support (required by Remotion/FFmpeg WASM)
app.use((req, res, next) => {
    res.header("Cross-Origin-Opener-Policy", "same-origin");
    res.header("Cross-Origin-Embedder-Policy", "require-corp");
    next();
});

// Serve static files for projects with explicit CORP headers
// We use a middleware before express.static to ensure headers are present on all responses (including 206 Partial Content)
app.use('/projects', (req, res, next) => {
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Access-Control-Allow-Origin", "*");
    next();
}, express.static(path.join(__dirname, 'projects')));

app.use('/api/projects', projectRouter);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});