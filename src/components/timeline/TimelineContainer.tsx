// src/components/timeline/TimelineContainer.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TimelineTrack } from './TimelineTrack';
import { TimelineRuler } from './TimelineRuler';
import { type TimelineTrack as TimelineTrackType, type TimelineItem as TimelineItemType } from '../../types';
import { ZoomIn, ZoomOut, Search } from 'lucide-react';

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
    onItemClick: (itemId: string | null) => void;
    getAssetData: (resourceId: string) => LibraryAsset | undefined;
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
    // Default 50px per second. Range: 10px (zoomed out) to 300px (zoomed in)
    const [pixelsPerSecond, setPixelsPerSecond] = useState(50);

    const containerRef = useRef<HTMLDivElement>(null);
    const rulerRef = useRef<HTMLDivElement>(null);

    const MIN_ZOOM = 10;
    const MAX_ZOOM = 300;

    // --- Panning State & Refs ---
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ scrollLeft: number, clientX: number, pointerId: number }>({ scrollLeft: 0, clientX: 0, pointerId: -1 });

    const totalWidth = Math.max(duration + 10, 60) * pixelsPerSecond + 200;

    // --- Zoom Logic ---

    // 1. Mouse Wheel Zoom (Ctrl + Wheel)
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();

            // Determine direction
            const direction = e.deltaY > 0 ? -1 : 1;
            const step = 10; // Pixels to change per scroll tick

            setPixelsPerSecond(prev => {
                const next = prev + (direction * step);
                return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
            });
        }
    };

    // 2. Slider / Button Zoom
    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setPixelsPerSecond(val);
    };

    const stepZoom = (direction: -1 | 1) => {
        setPixelsPerSecond(prev => {
            const step = 20;
            const next = prev + (direction * step);
            return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
        });
    };

    // --- Sync horizontal scroll ---
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (rulerRef.current) {
            rulerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    // --- Panning Logic ---
    const handlePanStart = (e: React.PointerEvent<HTMLDivElement>) => {
        // Prevent panning when using the Split tool or if not the primary button (left click)
        if (activeTool === 'split' || e.button !== 0) return;

        const targetElement = e.target as Element;
        if (targetElement.closest('.timeline-item')) {
            // The click started inside a clip. We must let the clip handle the interaction.
            return;
        }
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

        const handlePanMove = (e: PointerEvent) => {
            if (e.pointerId !== capturedPointerId) return;

            e.preventDefault();
            const deltaX = e.clientX - panStart.current.clientX;
            container.scrollLeft = panStart.current.scrollLeft - deltaX;
        };

        const handlePanEnd = (e: PointerEvent) => {
            if (e.pointerId !== capturedPointerId) return;
            setIsPanning(false);
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

    // Handle background click for deselect
    const handleTrackAreaClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onItemClick(null);
        }
    };

    const cursorClass = activeTool === 'split'
        ? 'cursor-crosshair'
        : (isPanning ? 'cursor-grabbing' : 'cursor-grab');

    const getAssetName = useCallback((resourceId: string): string => {
        const asset = getAssetData(resourceId);
        return asset?.name || resourceId;
    }, [getAssetData]);

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] select-none text-xs" onWheel={handleWheel}>

            {/* --- Zoom Toolbar --- */}
            <div className="h-8 bg-[#111] border-b border-white/5 flex items-center justify-between px-4 sticky top-0 z-40">
                <div className="flex items-center gap-2 text-slate-500">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Timeline Zoom</span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => stepZoom(-1)}
                        className="text-slate-400 hover:text-white disabled:opacity-30"
                        disabled={pixelsPerSecond <= MIN_ZOOM}
                    >
                        <ZoomOut size={14} />
                    </button>

                    <div className="flex items-center gap-2 w-32 group">
                        <input
                            type="range"
                            min={MIN_ZOOM}
                            max={MAX_ZOOM}
                            step={5}
                            value={pixelsPerSecond}
                            onChange={handleZoomChange}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400 hover:accent-indigo-400"
                        />
                    </div>

                    <button
                        onClick={() => stepZoom(1)}
                        className="text-slate-400 hover:text-white disabled:opacity-30"
                        disabled={pixelsPerSecond >= MAX_ZOOM}
                    >
                        <ZoomIn size={14} />
                    </button>

                    <div className="w-12 text-right font-mono text-[10px] text-slate-500">
                        {Math.round((pixelsPerSecond / 50) * 100)}%
                    </div>
                </div>
            </div>

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
                onPointerDown={handlePanStart}
                onClick={handleTrackAreaClick}
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
                            getAssetName={getAssetName}
                            getAssetData={getAssetData}
                            onAssetDrop={onAssetDrop}
                            activeTool={activeTool}
                            onSplit={onSplit}
                            onToggleMute={onToggleMute}
                        />
                    ))}

                    <div className="h-32 w-full" />
                </div>
            </div>
        </div>
    );
};