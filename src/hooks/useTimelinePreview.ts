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
    activeItemId: string | null,
    // NEW PROP: Temporary override for live preview
    trimOverride: { id: string, startOffset: number, endOffset: number } | null = null
): PreviewState => {
    return useMemo(() => {
        // Flatten video tracks
        // Reverse tracks for layering: Bottom tracks first, Top tracks last (Painter's Algorithm)
        // Assuming tracks[0] is at the top of the timeline UI.
        const videoTracks = [...tracks]
            .reverse()
            .filter(t => t.type === 'video' || t.type === 'overlay');

        const videoItems = videoTracks.flatMap(t =>
            t.items.map(item => ({ ...item, isTrackMuted: t.isMuted }))
        );

        const audioTracks = tracks.filter(t => t.type === 'audio');

        const audioItems = audioTracks.flatMap(t =>
            t.items.map(item => ({ ...item, isTrackMuted: t.isMuted }))
        );

        // Sort items by timeline start time
        const sortedVideoItems = [...videoItems].sort((a, b) => a.start - b.start);
        const sortedAudioItems = [...audioItems].sort((a, b) => a.start - b.start);

        const mapItemToPreviewClip = (item: TimelineItem & { isTrackMuted?: boolean }): PreviewClip => {
            // Find asset
            // Note: item.resourceId might be the name or ID.
            const asset = assets.find(a => a.name === item.resourceId) || {
                name: 'Unknown Asset',
                url: '',
                duration: 10,
                filmstrip: []
            };

            const isImage = item.resourceId.match(/\.(jpg|jpeg|png|webp|gif)$/i);

            let finalStartOffset = item.startOffset;
            let finalTimelineDuration = item.duration;
            let finalTimelineStart = item.start;

            // Source end time calculated from committed data
            let finalEndOffset = item.startOffset + item.duration * (item.playbackRate || 1);

            // === APPLY TRIM OVERRIDE ===
            if (trimOverride && item.id === activeItemId && item.id === trimOverride.id) {
                const playbackRate = item.playbackRate ?? 1;

                // 1. Update source offsets based on override
                finalStartOffset = trimOverride.startOffset;
                finalEndOffset = trimOverride.endOffset;

                const sourceSpan = finalEndOffset - finalStartOffset;

                // 2. Calculate the resulting timeline duration and start position based on new source span/offset
                finalTimelineDuration = sourceSpan / playbackRate;

                const offsetShift = trimOverride.startOffset - item.startOffset;
                finalTimelineStart = item.start + (offsetShift / playbackRate);
            }
            // ==========================

            // If track is muted, volume is 0. Otherwise use item volume or default 1.
            const finalVolume = item.isTrackMuted ? 0 : (item.volume ?? 1);

            return {
                id: item.id,
                url: `http://localhost:3001${asset.url}`, // Ensure URL is absolute
                start: finalStartOffset,
                end: finalEndOffset, // Source end time
                volume: finalVolume,
                playbackRate: item.playbackRate ?? 1,
                label: asset.name,
                timelineStart: finalTimelineStart,
                timelineDuration: finalTimelineDuration,
                sourceDuration: asset.duration,
                filmstrip: asset.filmstrip,
                mediaType: isImage ? 'image' : 'video'
            };
        };

        const clips = sortedVideoItems.map(mapItemToPreviewClip);
        const audioClips = sortedAudioItems.map(mapItemToPreviewClip);

        // Calculate total duration (based on potentially overridden clips)
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
    }, [tracks, assets, activeItemId, trimOverride]);
};