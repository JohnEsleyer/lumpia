import { useMemo } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import { getSequenceFromHandle } from '../utils/graphUtils';

export interface PreviewClip {
    id: string;
    url: string;
    // Source Trimming
    start: number;
    end: number;
    // Playback Props
    volume: number;
    playbackRate: number;
    label?: string;

    // Calculated Timeline Props (The Engine needs these)
    timelineStart: number;
    timelineDuration: number;
}

export interface PreviewState {
    previewType: 'sequence' | 'clip' | 'empty';
    clips: PreviewClip[];
    totalDuration: number;
    mix: { videoGain: number; audioGain: number };
    activeNodeId: string | null;
    activeNodeType: string | null;
}

export const usePreviewLogic = (
    nodes: Node[],
    edges: Edge[],
    activeNodeId: string | null
): PreviewState => {
    return useMemo(() => {
        const defaultState: PreviewState = {
            previewType: 'empty',
            clips: [],
            totalDuration: 0,
            mix: { videoGain: 1, audioGain: 1 },
            activeNodeId,
            activeNodeType: null
        };

        if (!activeNodeId) return defaultState;

        const activeNode = nodes.find(n => n.id === activeNodeId);
        if (!activeNode) return defaultState;

        // Helper: Convert raw graph items into timeline clips
        const processSequence = (rawItems: any[]): PreviewClip[] => {
            let currentTimePointer = 0;
            return rawItems.map(item => {
                const sourceDuration = item.end - item.start;
                const speed = item.playbackRate || 1.0;

                // Effective duration on timeline = (Source Length) / Speed
                const timelineDuration = sourceDuration / speed;

                const clip: PreviewClip = {
                    ...item,
                    timelineStart: currentTimePointer,
                    timelineDuration: timelineDuration,
                };

                currentTimePointer += timelineDuration;
                return clip;
            });
        };

        // --- SCENARIO A: RENDER NODE (The Full Chain) ---
        if (activeNode.type === 'render') {
            // 1. Get the chain of clips feeding into 'video-in'
            const rawClips = getSequenceFromHandle(nodes, edges, activeNodeId, 'video-in');

            // 2. Process them into a timeline
            const clips = processSequence(rawClips);
            const totalDuration = clips.reduce((acc, c) => acc + c.timelineDuration, 0);

            return {
                previewType: 'sequence',
                clips,
                totalDuration,
                mix: {
                    videoGain: (activeNode.data as any)?.videoMixGain ?? 1.0,
                    audioGain: (activeNode.data as any)?.audioMixGain ?? 1.0
                },
                activeNodeId,
                activeNodeType: 'render'
            };
        }

        // --- SCENARIO B: CLIP NODE (Single Item) ---
        if (activeNode.type === 'clip') {
            const data = activeNode.data as any;
            const sourceDuration = data.endOffset - data.startOffset;
            const speed = data.playbackRate ?? 1.0;
            const timelineDuration = sourceDuration / speed;

            const clip: PreviewClip = {
                id: activeNode.id,
                url: data.url,
                start: data.startOffset,
                end: data.endOffset,
                volume: data.volume ?? 1.0,
                playbackRate: speed,
                label: data.label,
                timelineStart: 0,
                timelineDuration: timelineDuration
            };

            return {
                previewType: 'clip',
                clips: [clip],
                totalDuration: timelineDuration,
                mix: { videoGain: 1, audioGain: 1 },
                activeNodeId,
                activeNodeType: 'clip'
            };
        }

        return defaultState;

    }, [nodes, edges, activeNodeId]);
};