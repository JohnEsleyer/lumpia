import React, { useRef } from 'react';

interface TimelineRulerProps {
    duration: number;
    pixelsPerSecond: number;
    currentTime: number;
    onSeek: (time: number) => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ pixelsPerSecond, currentTime, onSeek }) => {
    const rulerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = rulerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const time = Math.max(0, x / pixelsPerSecond);
        onSeek(time);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const moveX = moveEvent.clientX - rect.left;
            const newTime = Math.max(0, moveX / pixelsPerSecond);
            onSeek(newTime);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            ref={rulerRef}
            className="h-8 bg-[#111] border-b border-white/5 relative cursor-pointer sticky top-0 z-30 flex-shrink-0"
            onMouseDown={handleMouseDown}
        >
            {/* Time Markers */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(to right, #333 1px, transparent 1px)',
                backgroundSize: `${pixelsPerSecond}px 100%`
            }} />

            {/* Playhead */}
            <div
                className="absolute top-0 bottom-0 w-px bg-yellow-500 z-40 pointer-events-none"
                style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
                <div className="absolute -top-1 -translate-x-1/2 text-[9px] bg-yellow-500 text-black px-1 rounded font-mono font-bold">
                    {currentTime.toFixed(1)}s
                </div>
            </div>
        </div>
    );
};
