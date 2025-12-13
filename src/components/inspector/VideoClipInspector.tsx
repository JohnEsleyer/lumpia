// src/components/inspector/VideoClipInspector.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Video, Settings2, Volume2, Gauge, Scissors, Loader2, Play, Pause } from 'lucide-react';
import { VideoTrimmer } from './VideoTrimmer';
import { Button } from '../ui/Button';

interface LibraryAsset {
    name: string;
    url: string;
    filmstrip: string[];
    thumbnailUrl: string;
    duration?: number;
}

// Snapshot of the committed/saved state of the clip for reference
interface CommittedClipData {
    start: number; // Committed Timeline Start (T_committed_start)
    startOffset: number; // Committed Source Start (S_committed)
    playbackRate: number;
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
    committedItemData: CommittedClipData; // <-- NEW PROP

    // Actions
    onUpdateItemProperties: (id: string, data: { volume?: number; playbackRate?: number | null }) => void;
    // Commits trim: updates timeline start, timeline duration, and source offset
    onUpdateTimelinePosition: (id: string, newStart: number, newDuration: number, newStartOffset: number) => void;
    onSeek: (time: number) => void;

    // NEW Props for live preview
    onUpdateTrimOverride: (startOffset: number, endOffset: number) => void;
    onClearTrimOverride: () => void;

    // NEW PROP for synchronization
    globalTimelineTime: number;
}


export const VideoClipInspector: React.FC<VideoClipInspectorProps> = ({
    itemId,
    itemData,
    assetData,
    committedItemData,
    onUpdateItemProperties,
    onUpdateTimelinePosition,
    onSeek,
    onUpdateTrimOverride,
    onClearTrimOverride,
    globalTimelineTime
}) => {
    const sourceDuration = assetData.duration || 60;
    const inspectorVideoRef = useRef<HTMLVideoElement>(null);
    const [previewIsLoading, setPreviewIsLoading] = useState(true);

    // CORRECTED Ref type for stability check
    const lastCommittedRef = useRef<{ id: string, start: number, offset: number, duration: number, rate: number, url: string } | null>(null);

    // NEW STATE for controlling playback inside the inspector
    const [isPlayingSource, setIsPlayingSource] = useState(false);

    // Calculate the current committed source end offset.
    const currentCommittedSourceEnd = useMemo(() => {
        // Source End = Source Start + (Timeline Duration * Playback Rate)
        return Math.min(
            sourceDuration,
            itemData.startOffset + (itemData.duration * itemData.playbackRate)
        );
    }, [itemData.startOffset, itemData.duration, itemData.playbackRate, sourceDuration]);

    // UI State: Controls Trimmer visibility
    const [isTrimming, setIsTrimming] = useState(false);

    // GHOST STATE: Holds the temporary, uncommitted source offsets while trimming
    const [tempStartOffset, setTempStartOffset] = useState(itemData.startOffset);
    const [tempEndOffset, setTempEndOffset] = useState(currentCommittedSourceEnd);

    // --- EFFECT 1: Reset on External Change ---
    useEffect(() => {
        const currentCommitted = {
            id: itemId,
            start: itemData.start,
            offset: itemData.startOffset,
            duration: itemData.duration,
            rate: itemData.playbackRate,
            url: assetData.url // Include URL for external asset change detection
        };

        const lastCommitted = lastCommittedRef.current;

        let shouldReset = false;

        // Condition 1: New clip selected (ID change)
        if (!lastCommitted || lastCommitted.id !== currentCommitted.id) {
            shouldReset = true;
            // console.log('[VCI Debug] RESET TRIGGERED: New Item Selected.');
        }
        // Condition 2: Committed properties changed externally (e.g., timeline trim/move committed)
        else if (
            lastCommitted.start !== currentCommitted.start ||
            lastCommitted.offset !== currentCommitted.offset ||
            lastCommitted.duration !== currentCommitted.duration ||
            lastCommitted.rate !== currentCommitted.rate ||
            lastCommitted.url !== currentCommitted.url
        ) {
            shouldReset = true;
            // console.log('[VCI Debug] RESET TRIGGERED: Committed Properties Changed Externally.');
        }

        if (shouldReset) {
            const committedEnd = Math.min(
                sourceDuration,
                itemData.startOffset + (itemData.duration * itemData.playbackRate)
            );

            setTempStartOffset(itemData.startOffset);
            setTempEndOffset(committedEnd);

            // CRITICAL: Force set trimming to false and stop playback
            setIsTrimming(false);
            setIsPlayingSource(false); // Stop local playback
            onClearTrimOverride();
            setPreviewIsLoading(true);

            lastCommittedRef.current = currentCommitted; // Update reference only after reset
        }

    }, [
        itemId,
        itemData.start,
        itemData.startOffset,
        itemData.duration,
        itemData.playbackRate,
        assetData.url,
        onClearTrimOverride,
        sourceDuration
    ]);

    // --- EFFECT 2: Source Playback Synchronization ---
    const sourceTime = useMemo(() => {
        const timelineStart = itemData.start;
        const playbackRate = itemData.playbackRate;

        const activeStart = isTrimming ? tempStartOffset : itemData.startOffset;
        const activeEnd = isTrimming ? tempEndOffset : currentCommittedSourceEnd;

        // Note: When isPlayingSource is TRUE, we rely on the video element's internal clock, 
        // not the global timeline clock, unless the clip is actively being dragged/trimmed.

        // If not playing locally, calculate time based on global timeline (for scrubbing sync)
        if (!isPlayingSource) {
            const timeInClip = globalTimelineTime - timelineStart;
            const sourceDelta = timeInClip * playbackRate;
            const calculatedSourceTime = activeStart + sourceDelta;

            // Clamp to the current active source trim range
            return Math.max(
                activeStart,
                Math.min(calculatedSourceTime, activeEnd)
            );
        }

        // If playing locally, return the current video element time (fallback logic below handles the element sync)
        return inspectorVideoRef.current?.currentTime ?? activeStart;

    }, [globalTimelineTime, itemData.start, itemData.playbackRate, itemData.startOffset, currentCommittedSourceEnd, isTrimming, tempStartOffset, tempEndOffset, isPlayingSource]);


    // Sync the local video element's time and playback state
    useEffect(() => {
        const video = inspectorVideoRef.current;
        if (!video) return;

        const clipEnd = itemData.start + itemData.duration;
        const activeEndOffset = isTrimming ? tempEndOffset : currentCommittedSourceEnd;
        const activeStartOffset = isTrimming ? tempStartOffset : itemData.startOffset;

        // 1. Playback Control
        if (isPlayingSource) {
            // Ensure video element is playing
            if (video.paused) video.play().catch(console.warn);
            // Apply clip volume when playing
            video.volume = itemData.volume ?? 1.0;
        } else {
            // Ensure video element is paused
            if (!video.paused) video.pause();
            // Mute when paused/inactive to avoid sound interference when scrubbing
            video.volume = 0;
        }

        // 2. Time Synchronization (Only seek if not playing locally, or if playing but outside bounds)
        if (!isPlayingSource) {
            if (!isNaN(sourceTime) && sourceTime >= 0) {
                // Sync video element frame only if playhead is over the clip
                if (globalTimelineTime >= itemData.start && globalTimelineTime < clipEnd) {
                    // Seek only if time delta is significant
                    if (Math.abs(video.currentTime - sourceTime) > 0.05) {
                        video.currentTime = sourceTime;
                    }
                } else {
                    // Hold frame at the committed start
                    video.currentTime = itemData.startOffset;
                }
            }
        }

        // 3. Playback Boundary/Looping Listener (for local playback)
        const checkBoundary = () => {
            if (video.currentTime >= activeEndOffset) {
                video.pause();
                video.currentTime = activeStartOffset;
                setIsPlayingSource(false);
            }
        };

        video.addEventListener('timeupdate', checkBoundary);
        return () => {
            video.removeEventListener('timeupdate', checkBoundary);
        };

    }, [
        isPlayingSource,
        isTrimming,
        globalTimelineTime,
        sourceTime,
        itemData.start,
        itemData.duration,
        itemData.startOffset,
        currentCommittedSourceEnd,
        tempEndOffset,
        tempStartOffset,
        itemData.volume // Added volume dependency for dynamic updates
    ]);


    // --- Core Trimming Handlers ---

    // 1. Cancel Handler (resets state)
    const handleTrimmerCancel = useCallback(() => {
        setIsPlayingSource(false); // Stop playback on cancel
        onClearTrimOverride();
        setTempStartOffset(itemData.startOffset);
        setTempEndOffset(currentCommittedSourceEnd);
        setIsTrimming(false);
    }, [itemData.startOffset, currentCommittedSourceEnd, onClearTrimOverride]);

    // 2. Toggle Handler (enters/exits mode)
    const handleToggleTrimMode = useCallback(() => {
        if (isTrimming) {
            handleTrimmerCancel();
        } else {
            setIsTrimming(true);
            setIsPlayingSource(false); // Ensure playback is stopped when entering trim mode
            // Initialize temp state to committed state
            setTempStartOffset(itemData.startOffset);
            setTempEndOffset(currentCommittedSourceEnd);
            // Set override immediately so main preview syncs with committed clip state
            onUpdateTrimOverride(itemData.startOffset, currentCommittedSourceEnd);
            // Seek to the start of the clip when entering trim mode
            onSeek(itemData.start);
        }
    }, [isTrimming, handleTrimmerCancel, itemData.startOffset, currentCommittedSourceEnd, onUpdateTrimOverride, onSeek, itemData.start]);

    // 3. Play/Pause Source Control
    const toggleSourcePlayback = useCallback(() => {
        const video = inspectorVideoRef.current;
        if (!video) return;

        if (isPlayingSource) {
            setIsPlayingSource(false);
        } else {
            const activeStartOffset = isTrimming ? tempStartOffset : itemData.startOffset;
            const activeEndOffset = isTrimming ? tempEndOffset : currentCommittedSourceEnd;

            // If video is near the end, reset it to the beginning of the selection before playing
            if (video.currentTime >= activeEndOffset || video.currentTime < activeStartOffset) {
                video.currentTime = activeStartOffset;
            }

            setIsPlayingSource(true);
        }
    }, [isPlayingSource, isTrimming, tempStartOffset, tempEndOffset, itemData.startOffset, currentCommittedSourceEnd]);


    // 4. Preview Change (updates GHOST state during drag/nudge)
    const handleTrimmerPreviewChange = useCallback((newStartOffset: number, newEndOffset: number) => {
        // Stop playback while actively dragging handles
        setIsPlayingSource(false);

        // 1. Update local ghost state
        setTempStartOffset(newStartOffset);
        setTempEndOffset(newEndOffset);

        // 2. Update the parent state for PreviewState hook consumption
        onUpdateTrimOverride(newStartOffset, newEndOffset);

        // 3. Recalculate and seek the main timeline to the new effective clip start time
        const sourceShift = newStartOffset - committedItemData.startOffset;
        const playbackRate = committedItemData.playbackRate;
        const timelineShift = sourceShift / playbackRate;
        const newTimelineTime = committedItemData.start + timelineShift;

        onSeek(newTimelineTime);
    }, [committedItemData.start, committedItemData.startOffset, committedItemData.playbackRate, onSeek, onUpdateTrimOverride]);


    // 5. Seek Source (Handles scrubbing the source slider directly)
    const handleSeekSource = useCallback((sourceTime: number) => {
        // Stop playback when seeking manually
        setIsPlayingSource(false);

        const activeStart = isTrimming ? tempStartOffset : itemData.startOffset;
        const sourceDelta = sourceTime - activeStart;
        const timeInClip = sourceDelta / (itemData.playbackRate || 1);
        const newTimelineTime = itemData.start + timeInClip;

        onSeek(newTimelineTime);
    }, [isTrimming, tempStartOffset, itemData.startOffset, itemData.playbackRate, itemData.start, onSeek]);


    // 6. Commit Handler (writes GHOST state to timeline)
    const handleTrimmerCommit = useCallback((newStartOffset: number, newEndOffset: number) => {
        setIsPlayingSource(false); // Stop playback on commit

        const newSourceSpan = newEndOffset - newStartOffset;
        const newTimelineDuration = newSourceSpan / itemData.playbackRate;

        // Calculate new timeline start using the committed baseline
        const shift = newStartOffset - committedItemData.startOffset;
        const newTimelineStart = committedItemData.start + (shift / committedItemData.playbackRate);

        onUpdateTimelinePosition(
            itemId,
            newTimelineStart,
            newTimelineDuration,
            newStartOffset
        );

        // Clear GHOST state and exit trim mode
        onClearTrimOverride();
        setIsTrimming(false);
    }, [itemId, committedItemData.start, committedItemData.startOffset, committedItemData.playbackRate, itemData.playbackRate, onUpdateTimelinePosition, onClearTrimOverride]);


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

                {/* --- DEDICATED PREVIEW SECTION --- */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                        <Video size={12} /> Source Preview
                    </label>
                    <div className="aspect-video w-full bg-black rounded-lg border border-white/10 overflow-hidden relative flex items-center justify-center">

                        {/* 1. Video Element (Source URL) */}
                        <video
                            ref={inspectorVideoRef}
                            src={`http://localhost:3001${assetData.url}`}
                            className={`w-full h-full object-contain ${previewIsLoading ? 'opacity-0' : 'opacity-100'}`}
                            controls={false}
                            autoPlay={false}
                            onLoadedMetadata={() => setPreviewIsLoading(false)}
                            crossOrigin="anonymous"
                        />

                        {/* 2. Loading State */}
                        {previewIsLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                                <Loader2 className="animate-spin text-yellow-500" size={24} />
                            </div>
                        )}

                        {/* 3. Play/Pause Overlay Button */}
                        <button
                            onClick={toggleSourcePlayback}
                            className={`
                                absolute inset-0 flex items-center justify-center z-10 
                                transition-opacity duration-300
                                ${isPlayingSource ? 'opacity-0' : 'opacity-100'}
                                hover:bg-black/20
                            `}
                            title={isPlayingSource ? "Pause Source Preview" : "Play Source Preview"}
                        >
                            {isPlayingSource ? (
                                <Pause size={36} fill="white" className="text-white opacity-80" />
                            ) : (
                                <Play size={36} fill="white" className="text-white opacity-80 ml-1" />
                            )}
                        </button>


                        {/* 4. Source Time overlay */}
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-yellow-400 border border-white/10">
                            SRC: {formatTime(inspectorVideoRef.current?.currentTime ?? itemData.startOffset)}
                        </div>

                        {/* 5. Clip Info Overlay */}
                        <div className="absolute bottom-2 left-2 flex flex-col gap-0.5">
                            <div className="text-[10px] font-mono text-slate-500 bg-black/70 px-1.5 rounded">
                                Clip: {formatTime(isTrimming ? (tempEndOffset - tempStartOffset) / itemData.playbackRate : itemData.duration)}
                            </div>
                        </div>
                    </div>
                </div>

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
                            onClick={handleToggleTrimMode}
                            variant={isTrimming ? 'danger' : 'secondary'}
                            className="h-7 text-[10px] px-3"
                        >
                            {isTrimming ? 'Exit Trim Mode' : 'Enter Trim Mode'}
                        </Button>
                    </div>

                    {isTrimming ? (
                        <VideoTrimmer
                            sourceDuration={sourceDuration}
                            // Pass GHOST state as controlled props
                            startOffset={tempStartOffset}
                            endOffset={tempEndOffset}
                            filmstrip={assetData.filmstrip}
                            onPreviewChange={handleTrimmerPreviewChange}
                            onCommit={handleTrimmerCommit}
                            onCancel={handleTrimmerCancel}
                            // NEW PROPS PASSED DOWN
                            currentTimeSource={inspectorVideoRef.current?.currentTime ?? tempStartOffset}
                            onSeekSource={handleSeekSource}
                        />
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs font-mono text-slate-400 p-3 bg-zinc-900 rounded-lg border border-white/5">
                                <p>Source IN: <span className="text-yellow-400">{formatTime(itemData.startOffset)}</span></p>
                                <p>Source OUT: <span className="text-yellow-400">{formatTime(currentCommittedSourceEnd)}</span></p>
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