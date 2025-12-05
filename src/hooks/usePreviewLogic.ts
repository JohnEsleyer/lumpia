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

    // Calculated Timeline Props
    timelineStart: number;
    timelineDuration: number;
}

export interface PreviewState {
    previewType: 'sequence' | 'clip' | 'empty';
    clips: PreviewClip[];
    audioClips: PreviewClip[];
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
            audioClips: [],
            totalDuration: 0,
            mix: { videoGain: 1, audioGain: 1 },
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
            const rawClips = getSequenceFromHandle(nodes, edges, activeNodeId, 'video-in', 'clip');
            const rawAudioClips = getSequenceFromHandle(nodes, edges, activeNodeId, 'audio-in', 'audio');

            const clips = processSequence(rawClips);
            const audioClips = processSequence(rawAudioClips);

            const videoDuration = clips.reduce((acc, c) => acc + c.timelineDuration, 0);
            const audioDuration = audioClips.reduce((acc, c) => acc + c.timelineDuration, 0);

            // If we have video, it dictates the length. If only audio, use audio length.
            const totalDuration = videoDuration > 0 ? videoDuration : audioDuration;

            return {
                previewType: 'sequence',
                clips,
                audioClips,
                totalDuration,
                mix: {
                    videoGain: (activeNode.data as any)?.videoMixGain ?? 1.0,
                    audioGain: (activeNode.data as any)?.audioMixGain ?? 1.0
                },
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
                mix: { videoGain: 1, audioGain: 1 },
                activeNodeId,
                activeNodeType: 'clip'
            };
        }

        // --- SCENARIO C: AUDIO NODE (Direct Preview) ---
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
                clips: [], // No video
                audioClips: [clip],
                totalDuration: sourceDuration,
                mix: { videoGain: 1, audioGain: 1 },
                activeNodeId,
                activeNodeType: 'audio'
            };
        }

        return defaultState;

    }, [nodes, edges, activeNodeId]);
};