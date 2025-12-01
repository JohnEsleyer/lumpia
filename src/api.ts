import type { Project, CreateProjectDTO, ProjectAsset } from './types';

const API_BASE = 'http://localhost:3001/api/projects';

export async function getProjects(): Promise<Project[]> {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
}

export async function getProject(id: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    return res.json();
}

export async function getProjectAssets(id: string): Promise<ProjectAsset[]> {
    const res = await fetch(`${API_BASE}/${id}/assets`);
    if (!res.ok) throw new Error('Failed to fetch assets');
    return res.json();
}

export async function createProject(data: CreateProjectDTO, file: File): Promise<Project> {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('width', data.width.toString());
    formData.append('height', data.height.toString());
    formData.append('fps', data.fps.toString());
    formData.append('file', file);

    const res = await fetch(API_BASE, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) throw new Error('Failed to create project');
    return res.json();
}

export async function addAsset(projectId: string, file: File): Promise<ProjectAsset[]> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/${projectId}/assets`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload asset');
    return res.json();
}

export async function saveProjectOperation(projectId: string, operation: any): Promise<Project> {
    const res = await fetch(`${API_BASE}/${projectId}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation),
    });
    if (!res.ok) throw new Error('Failed to save operation');
    return res.json();
}

export async function deleteProject(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
}

export async function transcribeVideo(projectId: string): Promise<any> {
    const res = await fetch(`http://localhost:3001/api/projects/${projectId}/transcribe`, {
        method: 'POST'
    });
    if (!res.ok) throw new Error("Transcription failed");
    return res.json();
}