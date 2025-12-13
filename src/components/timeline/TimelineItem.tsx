import React, { useRef, useState, useEffect, useMemo } from 'react';
import { type TimelineItem as TimelineItemType } from '../../types';
import { GripVertical, Trash2, Scissors, Music, AlertCircle } from 'lucide-react';

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
    sourceDuration?: number;
    activeTool: 'cursor' | 'split';
    onSplit?: (id: string, time: number) => void;
    onDelete?: (id: string) => void;
    isTrackMuted?: boolean;
}

// Global Cache for Audio Buffers to prevent re-fetching/decoding on every render/zoom
const audioBufferCache = new Map<string, AudioBuffer>();

const getVariantStyles = (variant: 'video' | 'audio' | 'overlay', selected: boolean, muted: boolean) => {
    let baseStyles = "absolute rounded-md overflow-hidden border-2 transition-opacity duration-200 group/item select-none";
    if (muted) baseStyles += " opacity-50 grayscale";

    const selectedStyle = selected
        ? "border-yellow-400 z-20 shadow-[0_0_0_1px_rgba(250,204,21,0.5)]"
        : "border-opacity-50 hover:border-opacity-80";

    switch (variant) {
        case 'video': return `${baseStyles} ${selectedStyle} ${selected ? 'bg-indigo-900' : 'bg-indigo-900/60 border-indigo-500/30'}`;
        case 'audio': return `${baseStyles} ${selectedStyle} ${selected ? 'bg-emerald-900' : 'bg-emerald-900/60 border-emerald-500/30'}`;
        case 'overlay': return `${baseStyles} ${selectedStyle} ${selected ? 'bg-purple-900' : 'bg-purple-900/60 border-purple-500/30'}`;
        default: return `${baseStyles} ${selectedStyle} bg-slate-800`;
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
    sourceDuration = 10,
    activeTool,
    onSplit,
    onDelete,
    isTrackMuted = false
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [audioError, setAudioError] = useState(false);

    const dragStartRef = useRef<{ clientX: number, start: number, pointerId: number } | null>(null);
    const itemRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Waveform State
    const [waveform, setWaveform] = useState<number[] | null>(null);

    const width = Math.max(10, item.duration * pixelsPerSecond);
    const left = item.start * pixelsPerSecond;

    // --- VIDEO: Filmstrip Logic ---
    const tiles = useMemo(() => {
        if (!filmstrip || filmstrip.length === 0 || variant !== 'video') return [];
        const ITEM_HEIGHT = height - 4;
        const ASPECT_RATIO = 16 / 9;
        const THUMB_WIDTH = ITEM_HEIGHT * ASPECT_RATIO;
        const tileCount = Math.ceil(width / THUMB_WIDTH);

        return Array.from({ length: tileCount }).map((_, i) => {
            const tileStartTime = (i * THUMB_WIDTH) / pixelsPerSecond;
            const rate = item.playbackRate || 1;
            const sourceTime = item.startOffset + (tileStartTime * rate);
            const progress = Math.max(0, Math.min(1, sourceTime / sourceDuration));
            const frameIndex = Math.floor(progress * (filmstrip.length - 1));

            return {
                id: i,
                src: filmstrip[frameIndex] || filmstrip[0],
                width: i === tileCount - 1 ? (width - (i * THUMB_WIDTH)) : THUMB_WIDTH
            };
        });
    }, [filmstrip, variant, width, height, pixelsPerSecond, item.startOffset, item.playbackRate, sourceDuration]);


    // --- AUDIO: Waveform Logic ---
    useEffect(() => {
        if (variant !== 'audio' || !assetUrl) {
            setWaveform(null);
            return;
        }

        let active = true;

        const renderWaveformFromBuffer = (buffer: AudioBuffer) => {
            // 3. Sample: Create a simple peak array for visualization
            const rawData = buffer.getChannelData(0); // Left channel
            // We want roughly 1 sample per pixel of the full duration for decent resolution
            // But for performance, we sample a fixed amount relative to duration
            const samples = 1000;
            const blockSize = Math.floor(rawData.length / samples);
            const sampledData = [];

            for (let i = 0; i < samples; i++) {
                let blockStart = blockSize * i;
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(rawData[blockStart + j]);
                }
                sampledData.push(sum / blockSize);
            }

            // Normalize
            const multiplier = Math.pow(Math.max(...sampledData), -1);
            const normalizedData = sampledData.map(n => n * multiplier);

            if (active) setWaveform(normalizedData);
        }

        const loadAudio = async () => {
            try {
                // 1. Check Cache
                if (audioBufferCache.has(assetUrl)) {
                    renderWaveformFromBuffer(audioBufferCache.get(assetUrl)!);
                    return;
                }

                // 2. Fetch
                const response = await fetch(assetUrl);
                const arrayBuffer = await response.arrayBuffer();

                // 3. Decode
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const decoded = await audioCtx.decodeAudioData(arrayBuffer);

                if (active) {
                    audioBufferCache.set(assetUrl, decoded);
                    renderWaveformFromBuffer(decoded);
                }

                audioCtx.close();
            } catch (err) {
                console.error("Audio Load Error", err);
                if (active) setAudioError(true);
            }
        };

        loadAudio();
        return () => { active = false; };
    }, [assetUrl, variant]);


    // --- DRAW WAVEFORM ON CANVAS ---
    useEffect(() => {
        if (variant !== 'audio' || !waveform || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset canvas
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = width;
        const displayHeight = height - 4;

        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // Styling
        ctx.fillStyle = selected ? '#a7f3d0' : '#34d399';
        if (isTrackMuted) ctx.fillStyle = '#52525b';

        // Mapping Logic: Map timeline view to waveform data
        if (!sourceDuration) return;
        const totalSamples = waveform.length;

        // Calculate which part of the waveform corresponds to the visible clip
        const startRatio = item.startOffset / sourceDuration;
        const endRatio = (item.startOffset + (item.duration * (item.playbackRate || 1))) / sourceDuration;

        const startIndex = Math.floor(startRatio * totalSamples);
        const endIndex = Math.ceil(endRatio * totalSamples);

        // Extract visible samples
        const visibleSamples = waveform.slice(startIndex, endIndex);

        // Draw bars
        const barWidth = displayWidth / visibleSamples.length;
        const gap = 0; // Tightly packed

        ctx.beginPath();
        visibleSamples.forEach((val, index) => {
            const x = index * barWidth;
            const h = Math.max(2, val * displayHeight * 0.8);
            const y = (displayHeight - h) / 2; // Center Vertically
            ctx.rect(x, y, barWidth, h);
        });
        ctx.fill();

    }, [waveform, width, height, selected, variant, item.startOffset, item.duration, item.playbackRate, sourceDuration, isTrackMuted]);


    // --- HANDLERS (Unchanged logic) ---
    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        if (activeTool === 'split' && onSplit) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickOffset = (e.clientX - rect.left) / pixelsPerSecond;
            onSplit(item.id, item.start + clickOffset);
            return;
        }

        onClick(item.id);
        setIsDragging(true);
        dragStartRef.current = { clientX: e.clientX, start: item.start, pointerId: e.pointerId };
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    useEffect(() => {
        if (!isDragging) return;
        const handleMove = (e: PointerEvent) => {
            if (!dragStartRef.current) return;
            const delta = (e.clientX - dragStartRef.current.clientX) / pixelsPerSecond;
            onDrag(item.id, Math.max(0, dragStartRef.current.start + delta));
        };
        const handleUp = (e: PointerEvent) => {
            setIsDragging(false);
            if (itemRef.current && dragStartRef.current) {
                itemRef.current.releasePointerCapture(dragStartRef.current.pointerId);
            }
            dragStartRef.current = null;
        };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [isDragging, pixelsPerSecond, item.id, item.start, onDrag]);

    const startTrim = (e: React.PointerEvent, trimStart: boolean) => {
        e.stopPropagation();
        const startX = e.clientX;
        const initStart = item.start;
        const initDur = item.duration;
        const initOffset = item.startOffset;
        const rate = item.playbackRate || 1;

        const onMove = (mv: PointerEvent) => {
            const delta = (mv.clientX - startX) / pixelsPerSecond;
            if (trimStart) {
                const newStart = initStart + delta;
                const newDur = initDur - delta;
                const newOffset = initOffset + (delta * rate);
                if (newDur > 0.1 && newStart >= 0) onTrim(item.id, newOffset, newDur, true);
            } else {
                const newDur = Math.max(0.1, initDur + delta);
                onTrim(item.id, initOffset, newDur, false);
            }
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    return (
        <div
            ref={itemRef}
            className={getVariantStyles(variant, selected, isTrackMuted)}
            style={{
                left: `${left}px`,
                width: `${width}px`,
                height: `${height - 4}px`,
                top: '2px',
                cursor: activeTool === 'split' ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')
            }}
            onPointerDown={handlePointerDown}
            onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuPos({ x: e.clientX, y: e.clientY });
                setShowContextMenu(true);
            }}
        >
            {/* Visuals */}
            {variant === 'video' && (
                <div className="absolute inset-0 flex overflow-hidden opacity-60 bg-black pointer-events-none">
                    {tiles.map(tile => (
                        <div key={tile.id} style={{ width: tile.width, height: '100%', borderRight: '1px solid #000' }}>
                            <img src={`http://localhost:3001${tile.src}`} className="w-full h-full object-cover" draggable={false} />
                        </div>
                    ))}
                </div>
            )}

            {variant === 'audio' && (
                <div className="absolute inset-0 w-full h-full">
                    {audioError ? (
                        <div className="flex items-center justify-center h-full text-red-400">
                            <AlertCircle size={14} />
                        </div>
                    ) : (
                        <canvas ref={canvasRef} className="w-full h-full block" />
                    )}
                </div>
            )}

            {/* Label */}
            <div className={`absolute top-0 left-0 p-1 flex items-center gap-1.5 text-[10px] font-bold select-none pointer-events-none ${variant === 'audio' ? 'text-emerald-100 bg-emerald-950/40 rounded' : 'text-indigo-100 mix-blend-plus-lighter'}`}>
                {variant === 'audio' ? <Music size={10} /> : <GripVertical size={10} />}
                <span className="truncate max-w-[100px] drop-shadow-md">{name}</span>
            </div>

            {/* Handles */}
            {!isTrackMuted && (
                <>
                    <div className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-white/20 z-10" onPointerDown={(e) => startTrim(e, true)} />
                    <div className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-white/20 z-10" onPointerDown={(e) => startTrim(e, false)} />
                </>
            )}

            {/* Context Menu */}
            {showContextMenu && (
                <div className="fixed bg-zinc-800 border border-zinc-700 shadow-xl rounded-lg py-1 z-50 w-32 animate-in fade-in zoom-in duration-75" style={{ top: contextMenuPos.y, left: contextMenuPos.x }}>
                    <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5 flex gap-2 items-center" onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(item.id);
                        setShowContextMenu(false);
                    }}>
                        <Trash2 size={12} /> Delete
                    </button>
                    {onSplit && (
                        <button className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 flex gap-2 items-center" onClick={(e) => {
                            e.stopPropagation();
                            onSplit(item.id, item.start + item.duration / 2);
                            setShowContextMenu(false);
                        }}>
                            <Scissors size={12} /> Split
                        </button>
                    )}
                </div>
            )}
            {showContextMenu && <div className="fixed inset-0 z-40" onClick={() => setShowContextMenu(false)} />}
        </div>
    );
};