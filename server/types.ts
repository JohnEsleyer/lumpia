// server/types.ts

export interface ProjectOperation {
    type: 'trim' | 'text' | 'stitch';
    params: any; // You can make this stricter (e.g. TrimParams | TextParams) later
    id: string;
}

export interface Project {
    id: string;
    name: string;
    width: number;
    height: number;
    fps: number;
    assets: string[];
    operations: ProjectOperation[];
    currentHead: string | null;
    thumbnail?: string;
    createdAt: string;
}

export interface CreateProjectDTO {
    name: string;
    width?: string | number;
    height?: string | number;
    fps?: string | number;
}