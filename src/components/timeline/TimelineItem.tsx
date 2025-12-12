import React, { useRef, useState, useEffect } from 'react';
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
    activeTool,
    onSplit
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [originalItemStart, setOriginalItemStart] = useState(0);
    const itemRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [waveform, setWaveform] = useState<number[] | null>(null);

    const width = item.duration * pixelsPerSecond;
    const left = item.start * pixelsPerSecond;

    useEffect(() => {
        if (variant === 'audio' && assetUrl) {
            let isActive = true;

            const fetchAudio = async () => {
                try {
                    const response = await fetch(assetUrl);
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
        }
    }, [assetUrl, variant]);

    // Draw waveform
    useEffect(() => {
        if (waveform && canvasRef.current) {
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
        }
    }, [waveform, width, height, selected]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (activeTool === 'split' && onSplit) {
            // Calculate split time
            // e.clientX is relative to viewport.
            // item.left is relative to track.
            // We need text local to item or consistent coordinate system.
            // Item is absolute position left=item.start*pps.
            // Click on item.
            const rect = e.currentTarget.getBoundingClientRect();
            const clickXInsideItem = e.clientX - rect.left;
            const clickTimeOffset = clickXInsideItem / pixelsPerSecond;
            const splitTime = item.start + clickTimeOffset;
            onSplit(item.id, splitTime);
            return;
        }

        onClick(item.id);
        setIsDragging(true);
        setDragStartX(e.clientX);
        setOriginalItemStart(item.start);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const deltaX = e.clientX - dragStartX;
            const deltaSeconds = deltaX / pixelsPerSecond;
            const newStart = Math.max(0, originalItemStart + deltaSeconds);
            onDrag(item.id, newStart);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStartX, originalItemStart, pixelsPerSecond, onDrag, item.id]);

    return (
        <div
            ref={itemRef}
            className={getVariantStyles(variant, selected)}
            style={{
                left: `${left}px`,
                width: `${width}px`,
                height: `${height - 4}px`, // Slight padding
                top: '2px',
                cursor: activeTool === 'split' ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Waveform Background for Audio */}
            {variant === 'audio' && (
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
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

            {/* Simple trim handles - implementation can be expanded later */}
            {/* Trim Handles */}
            <div
                className="absolute left-0 top-0 bottom-0 w-2 hover:bg-yellow-500/50 cursor-ew-resize z-20"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const originalDuration = item.duration;
                    const originalOffset = item.startOffset;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaSeconds = deltaX / pixelsPerSecond;

                        // Limit start trim so we don't exceed duration or go below 0 offset (if applicable)
                        // Allow trimming up to duration
                        const newDuration = Math.max(0.1, originalDuration - deltaSeconds);
                        const newOffset = Math.max(0, originalOffset + deltaSeconds);

                        if (newDuration > 0.1) {
                            onTrim(item.id, newOffset, newDuration, true);
                        }
                    };

                    const handleMouseUp = () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                    };

                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                }}
            />
            <div
                className="absolute right-0 top-0 bottom-0 w-2 hover:bg-yellow-500/50 cursor-ew-resize z-20"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const originalDuration = item.duration;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaSeconds = deltaX / pixelsPerSecond;
                        const newDuration = Math.max(0.1, originalDuration + deltaSeconds);

                        onTrim(item.id, item.startOffset, newDuration, false);
                    };

                    const handleMouseUp = () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                    };

                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                }}
            />
        </div>
    );
};
