import React from 'react';

interface TimelineRulerProps {
    duration: number;
    pixelsPerSecond: number;
    currentTime: number;
    onSeek: (time: number) => void;
}

interface TimelineRulerProps {
    duration: number;
    pixelsPerSecond: number;
    currentTime: number;
    onSeek: (time: number) => void;
    width: number;
}

export const TimelineRuler = React.forwardRef<HTMLDivElement, TimelineRulerProps>(({
    pixelsPerSecond,
    currentTime,
    onSeek,
    width
}, ref) => {
    // Combine refs if we need both local and forwarded, 
    // but for now let's just use the forwarded ref for the outer div.


    const handleMouseDown = (e: React.MouseEvent) => {
        // We need to use the ref that is attached to the element. 
        // If it's forwarded, we might not have direct access unless we use an object ref or callback ref.
        // Simplest is to assume ref is passed as object ref or cast it.
        // For safety/simplicity let's use a local ref pointing to the actual element, and use useImperativeHandle if needed,
        // OR just require the parent to pass a RefObject.
        // But `forwardRef` receives `ref`.

        // Let's rely on event target closest logic or just expect the parent to manage scrolling.
        // Actually, for clicking, we need the rect of the VISIBLE area or the SCROLLED area.

        // If we click on the wide container, clientX - rect.left gives x relative to the start of the timeline (since rect.left moves with scroll? No.)
        // If we scroll, the content moves left. rect.left of the CONTAINER is fixed.
        // We need the click position relative to the CONTENT.

        // If we click on the container:
        //  offsetX is relative to the target node.
        //  e.nativeEvent.offsetX is useful.

        // Let's use e.nativeEvent.offsetX which accounts for scrolling if target is the scrolled content.

        // Alternatively, use rect and add scrollLeft.
        // We need access to scrollLeft.

        const currentTarget = e.currentTarget as HTMLDivElement;
        const rect = currentTarget.getBoundingClientRect();
        const scrollLeft = currentTarget.scrollLeft;

        const x = e.clientX - rect.left + scrollLeft;
        const time = Math.max(0, x / pixelsPerSecond);
        onSeek(time);


        const handleMouseMove = (moveEvent: MouseEvent) => {
            const moveRect = currentTarget.getBoundingClientRect();
            const moveX = moveEvent.clientX - moveRect.left + currentTarget.scrollLeft;
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
            ref={ref}
            className="h-8 bg-[#111] border-b border-white/5 relative cursor-pointer overflow-hidden z-30 flex-shrink-0"
            onMouseDown={handleMouseDown}
        >
            <div className="relative h-full" style={{ width: `${width}px` }}>
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
        </div>
    );
});
