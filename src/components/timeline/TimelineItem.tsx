import React, { useRef, useState, useEffect, useMemo } from 'react';
import { type TimelineItem as TimelineItemType } from '../../types';
import { GripVertical } from 'lucide-react';

interface TimelineItemProps {
    item: TimelineItemType;
    pixelsPerSecond: number;
    height: number;
    onDrag: (id: string, newStart: number) => void;
    onTrim: (id: string, newStartOffset: number, newDuration: number, trimStart: boolean) => void;
    onClick: (id: string) => void;
    selected: boolean;
    name: string;
    variant: 'video' | 'audio' | 'overlay';
    assetUrl?: string;
    filmstrip?: string[];
    activeTool: 'cursor' | 'split';
    onSplit?: (id: string, time: number) => void;
}

const getVariantStyles = (variant: 'video' | 'audio' | 'overlay', selected: boolean) => {
    const baseStyles = "absolute rounded-md overflow-hidden border-2";
    const selectedStyle = selected ? "border-yellow-400 z-10 shadow-[0_0_0_1px_rgba(250,204,21,0.5)]" : "border-opacity-50";

    switch (variant) {
        case 'video':
            return `${baseStyles} ${selectedStyle} ${selected ? 'bg-indigo-900/80' : 'bg-indigo-900/40 border-indigo-500/30'}`;
        case 'audio':
            return `${baseStyles} ${selectedStyle} ${selected ? 'bg-emerald-900/80' : 'bg-emerald-900/40 border-emerald-500/30'}`;
        case 'overlay':
            return `${baseStyles} ${selectedStyle} ${selected ? 'bg-purple-900/80' : 'bg-purple-900/40 border-purple-500/30'}`;
        default:
            return `${baseStyles} ${selectedStyle} bg-slate-800 border-slate-600`;
    }
};

export const TimelineItem: React.FC<TimelineItemProps> = ({
    item,
    pixelsPerSecond,
    height,
    onDrag,
    onTrim,
    onClick,
    selected,
    name,
    variant,
    assetUrl,
    filmstrip,
    activeTool,
    onSplit
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ clientX: number, start: number, pointerId: number } | null>(null);
    const itemRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [waveform, setWaveform] = useState<number[] | null>(null);

    const width = item.duration * pixelsPerSecond;
    const left = item.start * pixelsPerSecond;

    // P2.5: Determine frames to display for filmstrip (Max 5 for visibility)
    const framesToDisplay = useMemo(() => {
        if (!filmstrip || filmstrip.length === 0 || variant !== 'video') return [];

        const count = 5;
        if (filmstrip.length <= count) return filmstrip;

        // Calculate indices to distribute the frames across the clip duration
        const selectedFrames = [];
        const step = (filmstrip.length - 1) / (count - 1);
        for (let i = 0; i < count; i++) {
            const index = Math.round(i * step);
            selectedFrames.push(filmstrip[Math.min(index, filmstrip.length - 1)]);
        }
        return selectedFrames;
    }, [filmstrip, variant]);


    // --- Waveform Generation Logic (Kept for continuity, relies on assetUrl) ---
    useEffect(() => {
        if (variant !== 'audio' || !assetUrl) {
            setWaveform(null);
            return;
        }
        // ... (Waveform generation logic remains unchanged) ...
        let isActive = true;

        const fetchAudio = async () => {
            try {
                // Fetch using absolute path
                const absoluteUrl = assetUrl;

                const response = await fetch(absoluteUrl);
                if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);

                const arrayBuffer = await response.arrayBuffer();
                if (!isActive) return;

                // Use OfflineAudioContext for data decoding - no user gesture required
                const offlineContext = new OfflineAudioContext(1, 1, 44100);
                const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

                const rawData = audioBuffer.getChannelData(0); // Left channel
                const samples = 100; // Number of bars to draw
                const blockSize = Math.floor(rawData.length / samples);
                const filteredData = [];

                for (let i = 0; i < samples; i++) {
                    let sum = 0;
                    for (let j = 0; j < blockSize; j++) {
                        // Use Root Mean Square for better representation of "energy"
                        const val = rawData[blockSize * i + j];
                        sum += val * val;
                    }
                    const rms = Math.sqrt(sum / blockSize);
                    filteredData.push(rms);
                }

                // Normalize
                const max = Math.max(...filteredData);
                const normalizedData = max > 0 ? filteredData.map(n => n / max) : filteredData;

                if (isActive) {
                    setWaveform(normalizedData);
                }
            } catch (e) {
                console.error("Failed to load waveform for", assetUrl, e);
            }
        };

        fetchAudio();

        return () => {
            isActive = false;
        };
    }, [assetUrl, variant]);

    // Draw waveform
    useEffect(() => {
        if (variant !== 'audio' || !waveform || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            // Make waveform higher contrast
            ctx.fillStyle = selected ? '#ffffff' : '#a7f3d0'; // White when selected, Emerald-200 otherwise

            const barWidth = w / waveform.length;
            const gap = 1;

            waveform.forEach((val, index) => {
                // Min height for visibility
                const barHeight = Math.max(2, val * h * 0.8);
                const x = index * barWidth;
                // Center the waveform vertically
                const y = (h - barHeight) / 2;
                ctx.fillRect(x, y, barWidth - gap, barHeight);
            });
        }
    }, [waveform, width, height, selected, variant]);
    // --- End Waveform Logic ---


    // --- Item Drag Logic ---
    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation(); // CRITICAL: Prevent event from reaching TimelineContainer pan listener

        // Handle Split tool interaction first
        if (activeTool === 'split' && onSplit) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickXInsideItem = e.clientX - rect.left;
            const clickTimeOffset = clickXInsideItem / pixelsPerSecond;
            const splitTime = item.start + clickTimeOffset;
            onSplit(item.id, splitTime);
            return;
        }

        onClick(item.id);

        // Only proceed to drag if cursor tool and left button
        if (activeTool !== 'cursor' || e.button !== 0) {
            return;
        }

        e.preventDefault(); // Prevent text selection/native drag

        setIsDragging(true);
        dragStartRef.current = { clientX: e.clientX, start: item.start, pointerId: e.pointerId };

        // Capture pointer to track movement outside the element bounds
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    // Centralized Pointer Event Drag Logic
    useEffect(() => {
        const itemElement = itemRef.current;
        if (!isDragging || !itemElement || !dragStartRef.current) return;

        const startState = dragStartRef.current;
        const capturedPointerId = startState.pointerId;

        const handlePointerMove = (e: PointerEvent) => {
            if (e.pointerId !== capturedPointerId) return;

            const deltaX = e.clientX - startState.clientX;
            const deltaSeconds = deltaX / pixelsPerSecond;
            const newStart = Math.max(0, startState.start + deltaSeconds);
            onDrag(item.id, newStart);
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (e.pointerId !== capturedPointerId) return;

            setIsDragging(false);
            dragStartRef.current = null;
            itemElement.releasePointerCapture(capturedPointerId);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, item.id, item.start, pixelsPerSecond, onDrag]);


    // --- Trim Handle Logic (Refactored to Pointer Events) ---
    const startTrimDrag = (e: React.PointerEvent, trimStart: boolean) => {
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const originalDuration = item.duration;
        const originalOffset = item.startOffset;
        const pointerId = e.pointerId;

        // Capture pointer
        (e.target as Element).setPointerCapture(pointerId);

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaSeconds = deltaX / pixelsPerSecond;

            if (trimStart) {
                // Trim Start
                // Allow trimming up to duration
                const newDuration = Math.max(0.1, originalDuration - deltaSeconds);
                const newOffset = Math.max(0, originalOffset + deltaSeconds);

                if (newDuration > 0.1) {
                    onTrim(item.id, newOffset, newDuration, true);
                }
            } else {
                // Trim End
                const newDuration = Math.max(0.1, originalDuration + deltaSeconds);
                onTrim(item.id, item.startOffset, newDuration, false);
            }
        };

        const handlePointerUp = (upEvent: PointerEvent) => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            // Release capture
            (e.target as Element).releasePointerCapture(pointerId);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    return (
        <div
            ref={itemRef}
            className={`${getVariantStyles(variant, selected)} timeline-item`}
            style={{
                left: `${left}px`,
                width: `${width}px`,
                height: `${height - 4}px`, // Slight padding
                top: '2px',
                cursor: activeTool === 'split' ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')
            }}
            onPointerDown={handlePointerDown} // Using Pointer Down for item move/select/split
        >
            {/* P2.5: Filmstrip Background for Video */}
            {variant === 'video' && framesToDisplay.length > 0 && (
                <div className="absolute inset-0 flex pointer-events-none opacity-80">
                    {framesToDisplay.map((framePath, i) => (
                        <div key={i} className="flex-1 h-full relative overflow-hidden">
                            <img
                                src={`http://localhost:3001${framePath}`}
                                className="w-full h-full object-cover border-r border-black/20 last:border-none"
                                draggable={false}
                                alt={`Frame ${i}`}
                            />
                        </div>
                    ))}
                </div>
            )}


            {/* Waveform Background for Audio */}
            {variant === 'audio' && (
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
                    // Set width dynamically for waveform redrawing stability
                    width={Math.ceil(width)}
                    height={Math.ceil(height)}
                />
            )}

            <div className={`flex items-center h-full px-2 gap-2 transition-colors pointer-events-none select-none relative z-10 ${variant === 'video' ? 'text-indigo-200' :
                variant === 'audio' ? 'text-emerald-100' :
                    'text-purple-200'
                }`}>
                <GripVertical size={14} className="opacity-50" />
                <span className="text-xs font-medium truncate drop-shadow-md">{name}</span>
            </div>

            {/* Trim Handles (Now using onPointerDown) */}
            <div
                className="absolute left-0 top-0 bottom-0 w-2 hover:bg-yellow-500/50 cursor-ew-resize z-20"
                onPointerDown={(e) => startTrimDrag(e as any, true)}
            />
            <div
                className="absolute right-0 top-0 bottom-0 w-2 hover:bg-yellow-500/50 cursor-ew-resize z-20"
                onPointerDown={(e) => startTrimDrag(e as any, false)}
            />
        </div>
    );
};