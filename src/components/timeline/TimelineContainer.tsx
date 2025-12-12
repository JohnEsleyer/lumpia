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
    getAssetUrl: (resourceId: string) => string;
    activeTool?: 'cursor' | 'split';
    onSplit?: (id: string, time: number) => void;
    onToggleMute?: (trackId: string) => void;
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
    onItemClick,
    getAssetUrl,
    activeTool = 'cursor',
    onSplit,
    onToggleMute
}) => {
    const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const rulerRef = useRef<HTMLDivElement>(null);

    const totalWidth = Math.max(duration + 10, 60) * pixelsPerSecond + 200;


    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const newScale = Math.max(10, Math.min(200, pixelsPerSecond - e.deltaY * 0.1));
            setPixelsPerSecond(newScale);
        }
    };

    // Sync horizontal scroll
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (rulerRef.current) {
            rulerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] select-none text-xs" onWheel={handleWheel}>
            <TimelineRuler
                ref={rulerRef}
                duration={duration}
                pixelsPerSecond={pixelsPerSecond}
                currentTime={currentTime}
                onSeek={onSeek}
                width={totalWidth}
            />

            <div
                ref={containerRef}
                className={`flex-1 overflow-y-auto overflow-x-auto relative custom-scrollbar ${activeTool === 'split' ? 'cursor-crosshair' : ''}`}
                onScroll={handleScroll}
            >
                <div className="relative min-w-full" style={{ width: totalWidth }}>
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
                            getAssetUrl={getAssetUrl}
                            activeTool={activeTool}
                            onSplit={onSplit}
                            onToggleMute={onToggleMute}
                        />
                    ))}

                    {/* Empty space at bottom */}
                    <div className="h-32 w-full" />
                </div>
            </div>
        </div>
    );
};
