// src/components/timeline/TimelineContainer.tsx

import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { TimelineTrack } from './TimelineTrack';
import { TimelineRuler } from './TimelineRuler';
import { type TimelineTrack as TimelineTrackType, type TimelineItem as TimelineItemType } from '../../types';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface LibraryAsset {
    name: string;
    url: string;
    filmstrip: string[];
    thumbnailUrl: string;
    duration?: number;
}

export interface TimelineContainerHandle {
    setPlayheadTime: (time: number) => void;
    scrollToTime: (time: number) => void;
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

export const TimelineContainer = forwardRef<TimelineContainerHandle, TimelineContainerProps>(({
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
}, ref) => {

    // --- Layout Constants ---
    const SIDEBAR_WIDTH = 240; // Fixed width for track headers
    const MIN_ZOOM = 2;
    const MAX_ZOOM = 600;

    // --- State ---
    const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
    const [isPanning, setIsPanning] = useState(false);

    // --- Refs ---
    const scrollContainerRef = useRef<HTMLDivElement>(null); // Main scrollable area
    const playheadRef = useRef<HTMLDivElement>(null);       // The vertical red line
    const rulerRef = useRef<HTMLDivElement>(null);          // The top scrubber bar
    const ppsRef = useRef(pixelsPerSecond);                 // Ref for Imperative updates
    const panStart = useRef<{ scrollLeft: number, clientX: number, pointerId: number }>({ scrollLeft: 0, clientX: 0, pointerId: -1 });

    // Keep ppsRef in sync for imperative handle
    useEffect(() => { ppsRef.current = pixelsPerSecond; }, [pixelsPerSecond]);

    const totalContentWidth = Math.max(duration + 10, 60) * pixelsPerSecond + SIDEBAR_WIDTH + 500;

    // --- Imperative Handle (Performance optimization) ---
    useImperativeHandle(ref, () => ({
        setPlayheadTime: (time: number) => {
            if (playheadRef.current) {
                const x = (time * ppsRef.current) + SIDEBAR_WIDTH;
                playheadRef.current.style.transform = `translateX(${x}px)`;
            }
        },
        scrollToTime: (time: number) => {
            if (scrollContainerRef.current) {
                const x = (time * ppsRef.current) + SIDEBAR_WIDTH;
                const centerOffset = scrollContainerRef.current.clientWidth / 2;
                scrollContainerRef.current.scrollLeft = x - centerOffset;
            }
        }
    }));

    // Initial Sync
    useEffect(() => {
        if (playheadRef.current) {
            const x = (currentTime * pixelsPerSecond) + SIDEBAR_WIDTH;
            playheadRef.current.style.transform = `translateX(${x}px)`;
        }
    }, [pixelsPerSecond, currentTime]);

    // --- Interaction 1: Zooming ---
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const direction = e.deltaY > 0 ? -1 : 1;
            // Adaptive zoom step based on current zoom level
            const multiplier = pixelsPerSecond > 100 ? 50 : (pixelsPerSecond > 20 ? 10 : 2);

            setPixelsPerSecond(prev => {
                const next = prev + (direction * multiplier);
                return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
            });
        }
    };

    // --- Interaction 2: Seeking (Top Ruler Only) ---
    const handleScrubberMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Don't trigger panning

        const updateTime = (clientX: number) => {
            if (!scrollContainerRef.current) return;
            const rect = scrollContainerRef.current.getBoundingClientRect();
            // Calculate X relative to the SCROLLABLE content
            // scrollLeft adds the hidden part, SIDEBAR_WIDTH removes the offset
            const scrollLeft = scrollContainerRef.current.scrollLeft;
            const clickX = clientX - rect.left + scrollLeft;

            const time = Math.max(0, (clickX - SIDEBAR_WIDTH) / pixelsPerSecond);
            onSeek(time);
        };

        updateTime(e.clientX);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            moveEvent.preventDefault();
            updateTime(moveEvent.clientX);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // --- Interaction 3: Panning (Track Area Only) ---
    const handleTrackAreaMouseDown = (e: React.PointerEvent) => {
        // Allow split/edit tools to work on items
        if (activeTool === 'split' || e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.timeline-item')) return; // Let items handle their own drag

        onItemClick(null); // Deselect on background click

        e.preventDefault();
        setIsPanning(true);
        panStart.current = {
            scrollLeft: scrollContainerRef.current?.scrollLeft || 0,
            clientX: e.clientX,
            pointerId: e.pointerId,
        };
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    useEffect(() => {
        const handlePanMove = (e: PointerEvent) => {
            if (!isPanning || !scrollContainerRef.current || e.pointerId !== panStart.current.pointerId) return;
            e.preventDefault();
            const deltaX = e.clientX - panStart.current.clientX;
            scrollContainerRef.current.scrollLeft = panStart.current.scrollLeft - deltaX;
        };

        const handlePanEnd = (e: PointerEvent) => {
            if (e.pointerId === panStart.current.pointerId) setIsPanning(false);
        };

        window.addEventListener('pointermove', handlePanMove);
        window.addEventListener('pointerup', handlePanEnd);
        return () => {
            window.removeEventListener('pointermove', handlePanMove);
            window.removeEventListener('pointerup', handlePanEnd);
        };
    }, [isPanning]);

    // Helper for props
    const getAssetName = useCallback((resourceId: string): string => {
        const asset = getAssetData(resourceId);
        return asset?.name || resourceId;
    }, [getAssetData]);

    return (
        <div className="flex flex-col h-full bg-[#121212] select-none text-xs" onWheel={handleWheel}>

            {/* 1. Header Toolbar */}
            <div className="h-10 bg-[#1a1a1a] border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 z-40 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Timeline</span>
                </div>
                <div className="flex items-center gap-3">
                    <ZoomOut size={14} className="text-zinc-500" />
                    <input
                        type="range"
                        min={MIN_ZOOM} max={MAX_ZOOM}
                        value={pixelsPerSecond}
                        onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
                        className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                    />
                    <ZoomIn size={14} className="text-zinc-500" />
                </div>
            </div>

            {/* 2. Scrollable Container (Holds Ruler + Tracks) */}
            <div
                ref={scrollContainerRef}
                className={`flex-1 overflow-auto relative custom-scrollbar ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                {/* Width Wrapper */}
                <div className="relative" style={{ width: totalContentWidth, minHeight: '100%' }}>

                    {/* A. Top Preview/Scrubber Area (Sticky Top) */}
                    <div
                        className="sticky top-0 left-0 z-30 h-8 bg-[#1a1a1a]/95 backdrop-blur-sm border-b border-white/5 group cursor-col-resize"
                        onMouseDown={handleScrubberMouseDown}
                    >
                        {/* Ruler Ticks */}
                        <TimelineRuler
                            sidebarWidth={SIDEBAR_WIDTH}
                            pixelsPerSecond={pixelsPerSecond}
                            duration={duration}
                        />

                        {/* Hover Effect */}
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />
                    </div>

                    {/* B. Track Area */}
                    <div
                        className="relative z-10 pt-2 pb-32"
                        onPointerDown={handleTrackAreaMouseDown}
                    >
                        {/* Grid Background */}
                        <div className="absolute inset-0 pointer-events-none z-0" style={{
                            backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px)`,
                            backgroundSize: `${pixelsPerSecond}px 100%`,
                            backgroundPosition: `${SIDEBAR_WIDTH}px 0`, // Align grid with ruler
                            opacity: 0.05
                        }} />

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
                    </div>

                    {/* C. The Playhead (Overlay) */}
                    <div
                        ref={playheadRef}
                        className="absolute top-0 bottom-0 z-50 pointer-events-none will-change-transform"
                        style={{ left: 0, width: '0px' }} // Position controlled via transform
                    >
                        {/* 1. The Handle (In the Ruler) */}
                        <div className="absolute -top-0 -left-[6px] w-[13px] h-[18px] bg-yellow-500 rounded-b-sm shadow-md flex items-center justify-center z-50">
                            <div className="w-0.5 h-2 bg-black/20 rounded-full"></div>
                        </div>

                        {/* 2. The Triangle Connector */}
                        <div className="absolute top-[18px] -left-[6px] w-0 h-0 border-l-[6.5px] border-l-transparent border-r-[6.5px] border-r-transparent border-t-[8px] border-t-yellow-500"></div>

                        {/* 3. The Line (Through tracks) */}
                        <div className="absolute top-[26px] left-0 w-px bottom-0 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]"></div>
                    </div>

                </div>
            </div>
        </div>
    );
});