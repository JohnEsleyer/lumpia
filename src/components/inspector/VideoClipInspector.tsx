// src/components/inspector/VideoClipInspector.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Video, Settings2, Volume2, Gauge, Scissors } from 'lucide-react';
import { VideoTrimmer } from './VideoTrimmer';
import { Button } from '../ui/Button';

interface LibraryAsset {
    name: string;
    url: string;
    filmstrip: string[];
    thumbnailUrl: string;
    duration?: number;
}

interface VideoClipInspectorProps {
    itemId: string;
    itemData: {
        start: number; // Timeline Start
        duration: number; // Timeline Duration
        startOffset: number; // Source Start
        playbackRate: number;
        volume: number;
    };
    assetData: LibraryAsset;

    // Actions
    onUpdateItemProperties: (id: string, data: { volume?: number; playbackRate?: number | null }) => void;
    // Commits trim: updates timeline start, timeline duration, and source offset
    onUpdateTimelinePosition: (id: string, newStart: number, newDuration: number, newStartOffset: number) => void;
    onSeek: (time: number) => void;
}

export const VideoClipInspector: React.FC<VideoClipInspectorProps> = ({
    itemId,
    itemData,
    assetData,
    onUpdateItemProperties,
    onUpdateTimelinePosition,
    onSeek
}) => {
    const sourceDuration = assetData.duration || 60;

    // State for Trimmer UI (Ghost state before commit)
    const [isTrimming, setIsTrimming] = useState(false);

    // Calculate the current source end offset based on timeline duration and playback rate.
    const currentSourceEnd = useMemo(() => {
        // Source End = Source Start + (Timeline Duration * Playback Rate)
        // Ensure we don't exceed the actual source duration
        return Math.min(
            sourceDuration,
            itemData.startOffset + (itemData.duration * itemData.playbackRate)
        );
    }, [itemData.startOffset, itemData.duration, itemData.playbackRate, sourceDuration]);

    // Trimmer Props based on current clip state
    const trimmerProps = useMemo(() => ({
        sourceDuration: sourceDuration,
        initialStart: itemData.startOffset,
        initialEnd: currentSourceEnd,
        filmstrip: assetData.filmstrip,
    }), [sourceDuration, itemData.startOffset, currentSourceEnd, assetData.filmstrip]);

    // Reset trimming mode if a new item is selected
    useEffect(() => {
        setIsTrimming(false);
    }, [itemId]);

    // --- Handlers ---

    // Handles temporary change during trim drag (for preview/seek)
    const handleTrimmerPreviewChange = useCallback((newStartOffset: number, newEndOffset: number) => {
        // Calculate the time on the timeline corresponding to the new source start offset.
        // Timeline Time = (New Start Offset - Original Start Offset) / Playback Rate + Original Timeline Start
        const shiftInSource = newStartOffset - itemData.startOffset;
        const shiftInTimeline = shiftInSource / itemData.playbackRate;
        const newTimelineTime = itemData.start + shiftInTimeline;

        // Use the middle of the new span for a better preview location
        const newSourceCenter = (newStartOffset + newEndOffset) / 2;
        const centerShift = newSourceCenter - (itemData.startOffset + (itemData.duration * itemData.playbackRate) / 2);
        const centerTimelineTime = itemData.start + (itemData.duration / 2) + (centerShift / itemData.playbackRate);

        onSeek(centerTimelineTime);
    }, [itemData.start, itemData.startOffset, itemData.playbackRate, itemData.duration, onSeek]);


    // Handles committed change from trimmer
    const handleTrimmerCommit = useCallback((newStartOffset: number, newEndOffset: number) => {
        const newSourceSpan = newEndOffset - newStartOffset;
        const newTimelineDuration = newSourceSpan / itemData.playbackRate;

        // When committing a trim, we need to shift the start time of the clip on the timeline
        // based on how much the start offset changed.
        const shift = newStartOffset - itemData.startOffset;
        const newTimelineStart = itemData.start + shift;

        onUpdateTimelinePosition(
            itemId,
            newTimelineStart,
            newTimelineDuration,
            newStartOffset
        );

        setIsTrimming(false);
    }, [itemId, itemData.start, itemData.startOffset, itemData.playbackRate, onUpdateTimelinePosition]);


    // --- General Property Handlers ---
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdateItemProperties(itemId, { volume: parseFloat(e.target.value) });
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdateItemProperties(itemId, { playbackRate: parseFloat(e.target.value) });
    };

    // Format time helper
    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 100);
        return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };


    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Video size={14} className="text-yellow-500" /> Clip Inspector
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                {/* File Info */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-200 truncate">{assetData.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                            Source: {formatTime(sourceDuration)} | Clip: {formatTime(itemData.duration)}
                        </div>
                    </div>
                </div>

                {/* Trimmer Activation/Display */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Scissors size={12} /> Trim & Source Selection
                        </label>
                        <Button
                            onClick={() => setIsTrimming(!isTrimming)}
                            variant={isTrimming ? 'danger' : 'secondary'}
                            className="h-7 text-[10px] px-3"
                        >
                            {isTrimming ? 'Exit Trim Mode' : 'Enter Trim Mode'}
                        </Button>
                    </div>

                    {isTrimming ? (
                        <VideoTrimmer
                            {...trimmerProps}
                            onPreviewChange={handleTrimmerPreviewChange}
                            onCommit={handleTrimmerCommit}
                            onCancel={() => setIsTrimming(false)}
                        />
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs font-mono text-slate-400 p-3 bg-zinc-900 rounded-lg border border-white/5">
                                <p>Source IN: <span className="text-yellow-400">{formatTime(itemData.startOffset)}</span></p>
                                <p>Source OUT: <span className="text-yellow-400">{formatTime(currentSourceEnd)}</span></p>
                            </div>
                        </div>
                    )}
                </div>

                {/* General Properties */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Settings2 size={14} /> General Properties
                    </h2>

                    {/* Volume Control */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                            <span className="flex items-center gap-1.5"><Volume2 size={12} /> Volume</span>
                            <span className="text-indigo-400 font-mono">{Math.round((itemData.volume ?? 1) * 100)}%</span>
                        </div>
                        <div className="relative h-6 flex items-center">
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={itemData.volume ?? 1}
                                onChange={handleVolumeChange}
                                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                            />
                        </div>
                    </div>

                    {/* Speed Control */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                            <span className="flex items-center gap-1.5"><Gauge size={12} /> Speed</span>
                            <span className="text-indigo-400 font-mono">{itemData.playbackRate ?? 1}x</span>
                        </div>
                        <div className="relative h-6 flex items-center">
                            <input
                                type="range" min="0.25" max="3" step="0.25"
                                value={itemData.playbackRate ?? 1}
                                onChange={handleSpeedChange}
                                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}