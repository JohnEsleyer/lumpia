import { useMemo } from 'react';
import { type TimelineTrack, type TimelineItem, type ProjectAsset } from '../types';

export interface PreviewVisual {
    id: string;
    url: string;
    timelineStart: number;
    timelineDuration: number;
    sourceStartOffset: number; // Where in the file to start
    playbackRate: number;
    mediaType: 'video' | 'image';
    zIndex: number;
}

export interface AudioSource {
    id: string;
    url: string;
    timelineStart: number;
    timelineEnd: number;
    sourceStartOffset: number;
    volume: number;
    playbackRate: number;
    isMuted: boolean;
}

export interface PreviewState {
    visuals: PreviewVisual[];
    audioSources: AudioSource[];
    totalDuration: number;
}

export const useTimelinePreview = (
    tracks: TimelineTrack[],
    assets: ProjectAsset[],
    activeItemId: string | null,
    trimOverride: { id: string, startOffset: number, endOffset: number } | null = null
): PreviewState => {
    return useMemo(() => {
        const visuals: PreviewVisual[] = [];
        const audioSources: AudioSource[] = [];

        // Reverse tracks for Visuals (Painter's algorithm: Bottom tracks = Background)
        const visualTracks = [...tracks].reverse();

        // 1. Process Visuals
        visualTracks.forEach((track, zIndex) => {
            if (track.type === 'audio') return;

            track.items.forEach((item) => {
                const asset = assets.find(a => a.name === item.resourceId);
                if (!asset) return;

                let { startOffset, duration, start: timelineStart } = item;
                const playbackRate = item.playbackRate || 1;

                // Apply Live Trim Override (Unchanged)
                if (trimOverride && item.id === activeItemId && item.id === trimOverride.id) {
                    startOffset = trimOverride.startOffset;
                    const sourceDuration = trimOverride.endOffset - startOffset;
                    duration = sourceDuration / playbackRate;
                    const shift = (startOffset - item.startOffset) / playbackRate;
                    timelineStart = item.start + shift;
                }

                visuals.push({
                    id: item.id,
                    url: `http://localhost:3001${asset.url}`,
                    timelineStart,
                    timelineDuration: duration,
                    sourceStartOffset: startOffset,
                    playbackRate,
                    mediaType: track.type === 'overlay' && /\.(png|jpg)$/i.test(asset.name) ? 'image' : 'video',
                    zIndex
                });
            });
        });

        // 2. Process Audio (Unchanged)
        tracks.forEach((track) => {
            if (track.type === 'overlay') return;

            track.items.forEach((item) => {
                const asset = assets.find(a => a.name === item.resourceId);
                if (!asset) return;

                let { startOffset, duration, start: timelineStart } = item;
                const playbackRate = item.playbackRate || 1;

                // Apply Live Trim Override
                if (trimOverride && item.id === activeItemId && item.id === trimOverride.id) {
                    startOffset = trimOverride.startOffset;
                    const sourceDuration = trimOverride.endOffset - startOffset;
                    duration = sourceDuration / playbackRate;
                    const shift = (startOffset - item.startOffset) / playbackRate;
                    timelineStart = item.start + shift;
                }

                audioSources.push({
                    id: item.id,
                    url: `http://localhost:3001${asset.url}`,
                    timelineStart,
                    timelineEnd: timelineStart + duration,
                    sourceStartOffset: startOffset,
                    volume: item.volume ?? 1,
                    playbackRate,
                    isMuted: track.isMuted || false
                });
            });
        });

        // Calculate max duration based strictly on content end, no padding.
        const maxDuration = Math.max(
            ...visuals.map(v => v.timelineStart + v.timelineDuration),
            ...audioSources.map(a => a.timelineEnd),
            1 // Minimum duration for playback engine sanity
        );

        return {
            visuals,
            audioSources,
            totalDuration: maxDuration
        };
    }, [tracks, assets, activeItemId, trimOverride]);
};