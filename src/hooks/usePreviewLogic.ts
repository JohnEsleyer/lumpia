
import { type Node, type Edge } from '@xyflow/react';
import { getConnectedSequence } from '../utils/graphUtils';
import { useMemo } from 'react';

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
}

export interface PreviewState {
    previewType: 'sequence' | 'clip' | 'empty';
    clips: PreviewClip[];
    audioClips: PreviewClip[];
    totalDuration: number;
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
            audioClips: [],
            totalDuration: 0,
            activeNodeId,
            activeNodeType: null
        };

        if (!activeNodeId) return defaultState;

        const activeNode = nodes.find(n => n.id === activeNodeId);
        if (!activeNode) return defaultState;

        const processSequence = (rawItems: any[]): PreviewClip[] => {
            let currentTimePointer = 0;
            return rawItems.map(item => {
                const sourceDuration = item.end - item.start;
                const speed = item.playbackRate || 1.0;
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

        // --- SCENARIO A: RENDER NODE ---
        if (activeNode.type === 'render') {
            // 1. Traverse Video Chain (connected to 'video-in')
            const rawClips = getConnectedSequence(nodes, edges, activeNodeId, 'video-in');

            // 2. Traverse Audio Chain (connected to 'audio-in')
            const rawAudioClips = getConnectedSequence(nodes, edges, activeNodeId, 'audio-in');

            const clips = processSequence(rawClips);
            const audioClips = processSequence(rawAudioClips);

            const videoDuration = clips.reduce((acc, c) => acc + c.timelineDuration, 0);
            const audioDuration = audioClips.reduce((acc, c) => acc + c.timelineDuration, 0);

            const totalDuration = videoDuration > 0 ? videoDuration : audioDuration;

            return {
                previewType: 'sequence',
                clips,
                audioClips,
                totalDuration,
                activeNodeId,
                activeNodeType: 'render'
            };
        }

        // --- SCENARIO B: CLIP NODE ---
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
                audioClips: [],
                totalDuration: timelineDuration,
                activeNodeId,
                activeNodeType: 'clip'
            };
        }

        // --- SCENARIO C: AUDIO NODE ---
        if (activeNode.type === 'audio') {
            const data = activeNode.data as any;
            const sourceDuration = data.endOffset - data.startOffset;

            const clip: PreviewClip = {
                id: activeNode.id,
                url: data.url,
                start: data.startOffset,
                end: data.endOffset,
                volume: data.volume ?? 1.0,
                playbackRate: 1.0,
                label: data.label,
                timelineStart: 0,
                timelineDuration: sourceDuration
            };

            return {
                previewType: 'clip',
                clips: [],
                audioClips: [clip],
                totalDuration: sourceDuration,
                activeNodeId,
                activeNodeType: 'audio'
            };
        }

        return defaultState;

    }, [nodes, edges, activeNodeId]);
};