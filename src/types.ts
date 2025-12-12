export interface ProjectOperation {
    type: 'trim' | 'text' | 'stitch' | 'subtitle' | 'overlay';
    params: any;
    id: string;
}

export interface TimelineItem {
    id: string;
    resourceId: string; // ID of the asset
    trackId: string;
    start: number; // Start time in seconds on the timeline
    duration: number; // Duration in seconds
    startOffset: number; // Start offset in the media file
    volume?: number;
    playbackRate?: number;
    // ... potentially other properties like filters, etc.
}

export interface TimelineTrack {
    id: string;
    type: 'video' | 'audio' | 'overlay';
    name: string;
    items: TimelineItem[];
    isMuted?: boolean;
    isLocked?: boolean;
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
        timeline?: {
            tracks: TimelineTrack[];
            duration: number; // Total timeline duration
        }
        // Deprecated graph state
        nodes?: any[];
        edges?: any[];
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

export interface SubtitleSettings {
    x: number;
    y: number;
    scale: number;
}

export interface CreateProjectDTO {
    name: string;
    width: number;
    height: number;
    fps: number;
}