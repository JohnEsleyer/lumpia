export interface ProjectOperation {
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

export interface ProjectAsset {
    name: string;
    url: string;
    filmstrip: string[];
    thumbnailUrl: string;
    duration?: number;
}

export interface SubtitleItem {
    id: string;
    start: number; // Seconds
    end: number;   // Seconds
    text: string;
}

export interface CreateProjectDTO {
    name: string;
    width: number;
    height: number;
    fps: number;
}