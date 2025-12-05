import React, { useRef, useState } from 'react';

interface VideoTimelineSliderProps {
    duration: number; // Source duration in seconds
    startOffset: number;
    endOffset: number;
    filmstrip?: string[];
    onRangeChange: (start: number, end: number) => void;
    onSeek?: (time: number) => void;
}

export const VideoTimelineSlider: React.FC<VideoTimelineSliderProps> = ({
    duration,
    startOffset,
    endOffset,
    filmstrip = [],
    onRangeChange,
    onSeek
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragMode, setDragMode] = useState<'start' | 'end' | 'slip' | null>(null);
    const dragStartX = useRef<number>(0);
    const initialDragState = useRef({ start: 0, end: 0 });

    const toPercent = (time: number) => Math.max(0, Math.min(100, (time / duration) * 100));

    const handlePointerDown = (e: React.PointerEvent, mode: 'start' | 'end' | 'slip') => {
        e.preventDefault();
        e.stopPropagation();
        setDragMode(mode);
        dragStartX.current = e.clientX;
        initialDragState.current = { start: startOffset, end: endOffset };
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragMode || !containerRef.current) return;
        e.preventDefault();

        const rect = containerRef.current.getBoundingClientRect();
        const deltaPixels = e.clientX - dragStartX.current;
        const deltaSeconds = (deltaPixels / rect.width) * duration;

        let newStart = initialDragState.current.start;
        let newEnd = initialDragState.current.end;
        const minDuration = 0.5; // Minimum 0.5s clip

        if (dragMode === 'start') {
            newStart = Math.max(0, Math.min(initialDragState.current.start + deltaSeconds, newEnd - minDuration));
            if (onSeek) onSeek(newStart);
        } else if (dragMode === 'end') {
            newEnd = Math.min(duration, Math.max(initialDragState.current.end + deltaSeconds, newStart + minDuration));
            if (onSeek) onSeek(newEnd);
        } else if (dragMode === 'slip') {
            // "Slip" edit: move the window without changing duration
            const span = newEnd - newStart;
            newStart = initialDragState.current.start + deltaSeconds;

            // Clamp to bounds
            if (newStart < 0) newStart = 0;
            if (newStart + span > duration) newStart = duration - span;

            newEnd = newStart + span;
        }

        onRangeChange(newStart, newEnd);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragMode) {
            setDragMode(null);
            (e.target as Element).releasePointerCapture(e.pointerId);
        }
    };

    const leftPercent = toPercent(startOffset);
    const rightPercent = toPercent(endOffset);

    return (
        <div
            ref={containerRef}
            className="relative h-16 bg-[#1a1a1a] rounded-lg overflow-hidden select-none border border-white/10 group"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            {/* 1. Filmstrip Background */}
            <div className="absolute inset-0 flex opacity-50 pointer-events-none grayscale group-hover:grayscale-0 transition-all">
                {filmstrip.length > 0 ? filmstrip.map((frame, i) => (
                    <div key={i} className="flex-1 h-full relative overflow-hidden border-r border-white/5 last:border-0">
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
        </div>
    );
};