
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TimelineTrack } from './TimelineTrack';
import { TimelineRuler } from './TimelineRuler';
import { type TimelineTrack as TimelineTrackType, type TimelineItem as TimelineItemType } from '../../types';

interface LibraryAsset {
    name: string;
    url: string;
    filmstrip: string[];
    thumbnailUrl: string;
    duration?: number;
}

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

    // P2.1: Replaced getAssetUrl with getAssetData
    getAssetData: (resourceId: string) => LibraryAsset | undefined;

    // P1.2: New prop for handling asset drops
    onAssetDrop: (trackId: string, payload: LibraryAsset) => void;

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
    getAssetData,
    onAssetDrop,
    activeTool = 'cursor',
    onSplit,
    onToggleMute
}) => {
    const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const rulerRef = useRef<HTMLDivElement>(null);

    // --- Panning State & Refs ---
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ scrollLeft: number, clientX: number, pointerId: number }>({ scrollLeft: 0, clientX: 0, pointerId: -1 });
    // -----------------------------

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

    // --- Panning Logic ---
    const handlePanStart = (e: React.PointerEvent<HTMLDivElement>) => {
        // Prevent panning when using the Split tool or if not the primary button (left click)
        if (activeTool === 'split' || e.button !== 0) return;

        // Prevent browser's native drag selection
        e.preventDefault();

        setIsPanning(true);
        panStart.current = {
            scrollLeft: e.currentTarget.scrollLeft,
            clientX: e.clientX,
            pointerId: e.pointerId,
        };

        // Capture pointer
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    // Global listeners for mouse move/up when panning is active
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isPanning) return;

        const capturedPointerId = panStart.current.pointerId;

        // We use standard DOM PointerEvents here, not React synthetic events
        const handlePanMove = (e: PointerEvent) => {
            if (e.pointerId !== capturedPointerId) return;

            e.preventDefault();
            const deltaX = e.clientX - panStart.current.clientX;
            // Update scroll position: movement is opposite mouse direction (panning)
            container.scrollLeft = panStart.current.scrollLeft - deltaX;
        };

        const handlePanEnd = (e: PointerEvent) => {
            if (e.pointerId !== capturedPointerId) return;

            setIsPanning(false);

            // Release pointer capture (handled by React in modern browsers, but good practice here)
            if (container.hasPointerCapture(e.pointerId)) {
                container.releasePointerCapture(e.pointerId);
            }
        };

        window.addEventListener('pointermove', handlePanMove);
        window.addEventListener('pointerup', handlePanEnd);

        return () => {
            window.removeEventListener('pointermove', handlePanMove);
            window.removeEventListener('pointerup', handlePanEnd);
        };
    }, [isPanning]);
    // -----------------------------

    // Updated Cursor class based on state and tool
    const cursorClass = activeTool === 'split'
        ? 'cursor-crosshair'
        : (isPanning ? 'cursor-grabbing' : 'cursor-grab');

    // FIX 1.1: Since resourceId is the asset name, this is a valid minimal implementation.
    const getAssetName = useCallback((resourceId: string): string => {
        const asset = getAssetData(resourceId);
        return asset?.name || resourceId;
    }, [getAssetData]);


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
                className={`flex-1 overflow-y-auto overflow-x-auto relative custom-scrollbar ${cursorClass}`}
                onScroll={handleScroll}
                onPointerDown={handlePanStart} // Use onPointerDown
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
                            getAssetName={getAssetName} // FIX: Pass the required prop
                            getAssetData={getAssetData}
                            onAssetDrop={onAssetDrop}
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