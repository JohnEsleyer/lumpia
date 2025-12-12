// FILE: src/components/inspector/VideoTimelineSlider.tsx
import React, { useRef, useState, useCallback } from 'react';

interface VideoTimelineSliderProps {
    duration: number; // Source duration in seconds
    startOffset: number; // Current selection start (controlled)
    endOffset: number; // Current selection end (controlled)
    currentTimeSource: number; // Source time (derived from global timeline time)
    filmstrip?: string[];
    onRangeChange: (start: number, end: number) => void;
    onSeekSource: (sourceTime: number) => void; // New: Seeks the preview to a specific source time
}

export const VideoTimelineSlider: React.FC<VideoTimelineSliderProps> = ({
    duration,
    startOffset,
    endOffset,
    currentTimeSource,
    filmstrip = [],
    onRangeChange,
    onSeekSource,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragMode, setDragMode] = useState<'start' | 'end' | 'slip' | null>(null);
    const dragStartX = useRef<number>(0);
    const initialDragState = useRef({ start: 0, end: 0 });

    const toPercent = (time: number) => Math.max(0, Math.min(100, (time / duration) * 100));

    // --- Interaction Handlers ---

    // Handles mouse down on handles or slip region
    const handlePointerDown = (e: React.PointerEvent, mode: 'start' | 'end' | 'slip') => {
        e.preventDefault();
        e.stopPropagation();
        setDragMode(mode);
        dragStartX.current = e.clientX;
        initialDragState.current = { start: startOffset, end: endOffset };
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    // Handles scrubbing/seeking when clicking on the timeline background
    const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current || dragMode) return;

        const rect = containerRef.current.getBoundingClientRect();
        // Calculate position relative to the left of the container
        const clickX = e.clientX - rect.left;
        const width = rect.width;

        const clickPercent = clickX / width;
        const sourceTime = duration * clickPercent;

        // Clamp seek time to the source duration and trigger seek in parent
        onSeekSource(Math.max(0, Math.min(sourceTime, duration)));
    }, [dragMode, duration, onSeekSource]);


    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragMode || !containerRef.current) return;
        e.preventDefault();

        const rect = containerRef.current.getBoundingClientRect();
        const deltaPixels = e.clientX - dragStartX.current;
        const deltaSeconds = (deltaPixels / rect.width) * duration;

        let newStart = initialDragState.current.start;
        let newEnd = initialDragState.current.end;
        const minDuration = 0.5; // Minimum 0.5s clip
        let span = newEnd - newStart; // Initial span before move

        if (dragMode === 'start') {
            newStart = Math.max(0, Math.min(initialDragState.current.start + deltaSeconds, newEnd - minDuration));
        } else if (dragMode === 'end') {
            newEnd = Math.min(duration, Math.max(initialDragState.current.end + deltaSeconds, newStart + minDuration));
        } else if (dragMode === 'slip') {
            newStart = initialDragState.current.start + deltaSeconds;

            // Clamp to bounds
            if (newStart < 0) newStart = 0;
            if (newStart + span > duration) newStart = duration - span;

            newEnd = newStart + span;
        }

        // Pass the new range up to the controlled component
        onRangeChange(newStart, newEnd);

        // Update the source preview immediately during drag
        if (dragMode === 'start') {
            onSeekSource(newStart);
        } else if (dragMode === 'end') {
            onSeekSource(newEnd);
        } else if (dragMode === 'slip') {
            // When slipping, seek to the middle of the new range for context
            onSeekSource(newStart + span / 2);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragMode) {
            setDragMode(null);
            (e.target as Element).releasePointerCapture(e.pointerId);
        }
    };

    const leftPercent = toPercent(startOffset);
    const rightPercent = toPercent(endOffset);
    const playheadPercent = toPercent(currentTimeSource);

    return (
        <div
            ref={containerRef}
            className="relative h-16 bg-[#1a1a1a] rounded-lg overflow-hidden select-none border border-white/10 group"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={handleBackgroundClick} // Handle clicks for seeking
        >
            {/* 1. Filmstrip Background */}
            <div className="absolute inset-0 flex opacity-50 pointer-events-none grayscale group-hover:grayscale-0 transition-all">
                {filmstrip.length > 0 ? filmstrip.map((frame, i) => (
                    <div key={i} className="flex-1 h-full relative overflow-hidden border-r border-black/20 last:border-0">
                        <img src={`http://localhost:3001${frame}`} className="w-full h-full object-cover" draggable={false} />
                    </div>
                )) : (
                    // Fallback pattern if no filmstrip
                    <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#333_10px,#333_20px)] opacity-20" />
                )}
            </div>

            {/* 2. Dimmers (Inactive Areas) */}
            <div className="absolute top-0 bottom-0 left-0 bg-black/70 backdrop-blur-[1px] pointer-events-none" style={{ width: `${leftPercent}%` }} />
            <div className="absolute top-0 bottom-0 right-0 bg-black/70 backdrop-blur-[1px] pointer-events-none" style={{ left: `${rightPercent}%` }} />

            {/* 3. Active Region (Slip Handler) */}
            <div
                className="absolute top-0 bottom-0 border-t-2 border-b-2 border-yellow-500/50 hover:border-yellow-500 cursor-grab active:cursor-grabbing z-10"
                style={{ left: `${leftPercent}%`, width: `${rightPercent - leftPercent}%` }}
                onPointerDown={(e) => handlePointerDown(e, 'slip')}
            >
                {/* Center Grip Indicator */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-0.5 h-3 bg-white/50 rounded-full" />
                    <div className="w-0.5 h-3 bg-white/50 rounded-full" />
                    <div className="w-0.5 h-3 bg-white/50 rounded-full" />
                </div>
            </div>

            {/* 4. Left Handle */}
            <div
                className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-20 flex flex-col justify-between items-center group/handle hover:scale-110 transition-transform"
                style={{ left: `${leftPercent}%` }}
                onPointerDown={(e) => handlePointerDown(e, 'start')}
            >
                <div className="w-0.5 h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                <div className="absolute top-0 w-3 h-4 bg-yellow-500 rounded-b-sm" />
                <div className="absolute bottom-0 w-3 h-4 bg-yellow-500 rounded-t-sm" />
            </div>

            {/* 5. Right Handle */}
            <div
                className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-20 flex flex-col justify-between items-center group/handle hover:scale-110 transition-transform"
                style={{ left: `${rightPercent}%` }}
                onPointerDown={(e) => handlePointerDown(e, 'end')}
            >
                <div className="w-0.5 h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                <div className="absolute top-0 w-3 h-4 bg-yellow-500 rounded-b-sm" />
                <div className="absolute bottom-0 w-3 h-4 bg-yellow-500 rounded-t-sm" />
            </div>

            {/* 6. Source Playhead (Red Line - Only visible if inside selection) */}
            {currentTimeSource >= startOffset && currentTimeSource <= endOffset && (
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                    style={{ left: `${playheadPercent}%` }}
                >
                    {/* Playhead Knob */}
                    <div className="absolute top-0 w-3 h-3 bg-red-500 -ml-1.5 rounded-b-sm shadow-md" />
                </div>
            )}
        </div>
    );
};