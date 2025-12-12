import React, { useState, useRef } from 'react';
import { TimelineTrack } from './TimelineTrack';
import { TimelineRuler } from './TimelineRuler';
import { type TimelineTrack as TimelineTrackType, type TimelineItem as TimelineItemType } from '../../types';

interface TimelineContainerProps {
    tracks: TimelineTrackType[];
    items: TimelineItemType[];
    duration: number;
    currentTime: number;
    onSeek: (time: number) => void;
    onItemMove: (itemId: string, newTrackId: string, newStartTime: number) => void;
    onItemTrim: (trackId: string, itemId: string, newStartTime: number, newDuration: number, trimStart: boolean) => void;
    selectedItemId: string | null;
    onItemClick: (itemId: string) => void;
}

export const TimelineContainer: React.FC<TimelineContainerProps> = ({
    tracks,
    items,
    duration,
    currentTime,
    onSeek,
    onItemMove,
    onItemTrim,
    selectedItemId,
    onItemClick
}) => {
    const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const newScale = Math.max(10, Math.min(200, pixelsPerSecond - e.deltaY * 0.1));
            setPixelsPerSecond(newScale);
        }
    };

    // Placeholder for handleScroll, if it's not defined elsewhere
    const handleScroll = () => {
        // Implement scroll logic if needed
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] select-none text-xs" onWheel={handleWheel}>
            <TimelineRuler
                duration={duration}
                pixelsPerSecond={pixelsPerSecond}
                currentTime={currentTime}
                onSeek={onSeek}
            />

            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar"
                onScroll={handleScroll}
            >
                <div className="relative min-w-full" style={{ width: Math.max(duration + 10, 60) * pixelsPerSecond + 200 }}>
                    {tracks.map(track => (
                        <TimelineTrack
                            key={track.id}
                            track={track}
                            items={items.filter(i => i.trackId === track.id)}
                            pixelsPerSecond={pixelsPerSecond}
                            onItemMove={onItemMove}
                            onItemTrim={(itemId, newStart, newDur, trimStart) => onItemTrim(track.id, itemId, newStart, newDur, trimStart)}
                            selectedItemId={selectedItemId}
                            onItemClick={onItemClick}
                            getAssetName={(id) => id}
                        />
                    ))}

                    {/* Empty space at bottom */}
                    <div className="h-32 w-full" />
                </div>
            </div>
        </div>
    );
};
