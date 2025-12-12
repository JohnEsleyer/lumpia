import { useMemo } from 'react';
import { type TimelineTrack, type TimelineItem, type ProjectAsset } from '../types';

export interface PreviewClip {
    id: string;
    url: string;
    start: number;
    end: number;
    volume: number;
    playbackRate: number;
    label?: string;
    timelineStart: number;
    timelineDuration: number;
    sourceDuration?: number;
    filmstrip?: string[];
    mediaType: 'video' | 'image';
}

export interface PreviewState {
    previewType: 'sequence' | 'clip' | 'empty';
    clips: PreviewClip[];
    audioClips: PreviewClip[];
    totalDuration: number;
    activeNodeId: string | null;
    activeNodeType: string | null;
}

export const useTimelinePreview = (
    tracks: TimelineTrack[],
    assets: ProjectAsset[],
    activeItemId: string | null
): PreviewState => {
    return useMemo(() => {
        // Flatten video tracks
        const videoItems = tracks
            .filter(t => t.type === 'video' || t.type === 'overlay') // Treat overlay as video for now (simpler z-index logic later)
            .flatMap(t => t.items);

        const audioItems = tracks
            .filter(t => t.type === 'audio')
            .flatMap(t => t.items);

        // Sort items by timeline start time
        const sortedVideoItems = [...videoItems].sort((a, b) => a.start - b.start);
        const sortedAudioItems = [...audioItems].sort((a, b) => a.start - b.start);

        const mapItemToPreviewClip = (item: TimelineItem): PreviewClip => {
            // Find asset
            // Note: item.resourceId might be the name or ID.
            const asset = assets.find(a => a.name === item.resourceId) || {
                name: 'Unknown Asset',
                url: '',
                duration: 10,
                filmstrip: []
            };

            const isImage = item.resourceId.match(/\.(jpg|jpeg|png|webp|gif)$/i);

            return {
                id: item.id,
                url: `http://localhost:3001${asset.url}`, // Ensure URL is absolute
                start: item.startOffset,
                end: item.startOffset + item.duration * (item.playbackRate || 1), // Source end time
                volume: item.volume ?? 1,
                playbackRate: item.playbackRate ?? 1,
                label: asset.name,
                timelineStart: item.start,
                timelineDuration: item.duration,
                sourceDuration: asset.duration,
                filmstrip: asset.filmstrip,
                mediaType: isImage ? 'image' : 'video'
            };
        };

        const clips = sortedVideoItems.map(mapItemToPreviewClip);
        const audioClips = sortedAudioItems.map(mapItemToPreviewClip);

        // Calculate total duration
        const maxVideoEnd = clips.reduce((max, clip) => Math.max(max, clip.timelineStart + clip.timelineDuration), 0);
        const maxAudioEnd = audioClips.reduce((max, clip) => Math.max(max, clip.timelineStart + clip.timelineDuration), 0);

        return {
            previewType: 'sequence',
            clips,
            audioClips,
            totalDuration: Math.max(maxVideoEnd, maxAudioEnd, 10), // Min 10s
            activeNodeId: activeItemId,
            activeNodeType: activeItemId ? 'clip' : null // Simplifying assumption
        };
    }, [tracks, assets, activeItemId]);
};
