// server/types.ts

export interface ProjectOperation {
    // Add 'subtitle' and any other types you might use like 'overlay'
    type: 'trim' | 'text' | 'stitch' | 'subtitle' | 'overlay';
    params: any;
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
    editorState?: {
        nodes: any[];
        edges: any[];
    };
}

export interface CreateProjectDTO {
    name: string;
    width?: string | number;
    height?: string | number;
    fps?: string | number;
}