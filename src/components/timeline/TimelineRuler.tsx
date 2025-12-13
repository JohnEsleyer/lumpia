import React from 'react';

interface TimelineRulerProps {
    duration: number;
    pixelsPerSecond: number;
    sidebarWidth: number; // New prop for alignment
}

export const TimelineRuler = React.forwardRef<HTMLDivElement, TimelineRulerProps>(({
    pixelsPerSecond,
    duration,
    sidebarWidth
}, ref) => {

    // Generate ticks
    const renderTicks = () => {
        const ticks = [];
        // Dynamic interval based on zoom to prevent clutter
        let interval = 1;
        if (pixelsPerSecond < 20) interval = 5;
        if (pixelsPerSecond < 5) interval = 15;
        if (pixelsPerSecond < 2) interval = 30;

        // Calculate how wide the timeline content is
        const totalSeconds = duration + 10; // padding

        for (let i = 0; i < totalSeconds; i += interval) {
            const left = (i * pixelsPerSecond) + sidebarWidth; // Offset by sidebar
            const isMinute = i % 60 === 0;
            const isMajor = i % 10 === 0;

            ticks.push(
                <div
                    key={i}
                    className={`absolute bottom-0 border-l border-zinc-600/50 ${isMinute ? 'h-full border-zinc-400' : isMajor ? 'h-2.5' : 'h-1.5'}`}
                    style={{ left: `${left}px` }}
                >
                    {(isMajor || isMinute) && (
                        <span className="absolute left-1.5 top-0 text-[9px] text-zinc-500 font-mono font-medium select-none">
                            {formatTime(i)}
                        </span>
                    )}
                </div>
            );
        }
        return ticks;
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div
            ref={ref}
            className="h-8 relative min-w-full pointer-events-none"
            style={{ width: `${(duration * pixelsPerSecond) + sidebarWidth}px` }}
        >
            {renderTicks()}
        </div>
    );
});