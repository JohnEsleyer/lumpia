import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AudioWaveformTrimmerProps {
    url: string;
    duration: number; // Total duration in seconds
    startOffset: number;
    endOffset: number;
    currentTime?: number; // For the scrubber playhead
    onRangeChange: (start: number, end: number) => void;
    onCommit: (start: number, end: number) => void;
}

export const AudioWaveformTrimmer: React.FC<AudioWaveformTrimmerProps> = ({
    url,
    duration,
    startOffset,
    endOffset,
    currentTime,
    onRangeChange,
    onCommit
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [dragMode, setDragMode] = useState<'start' | 'end' | 'range' | null>(null);
    const dragStartX = useRef<number>(0);
    const initialDragState = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

    // 1. Fetch and Decode Audio for Waveform
    useEffect(() => {
        let active = true;
        const fetchAudio = async () => {
            if (!url) return;
            setIsLoading(true);
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();

                // Use standard AudioContext to decode
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

                if (active) {
                    setAudioBuffer(decodedBuffer);
                    audioCtx.close();
                }
            } catch (err) {
                console.error("Failed to load audio waveform", err);
            } finally {
                if (active) setIsLoading(false);
            }
        };
        fetchAudio();
        return () => { active = false; };
    }, [url]);

    // 2. Draw Waveform
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !audioBuffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        // Draw Logic
        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.fillStyle = '#10b981'; // Emerald-500
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
    }, [audioBuffer]);

    // 3. Helpers for positioning
    const toPercent = (time: number) => Math.max(0, Math.min(100, (time / duration) * 100));

    // 4. Drag Logic
    const handlePointerDown = (e: React.PointerEvent, mode: 'start' | 'end' | 'range') => {
        e.preventDefault();
        e.stopPropagation();
        setDragMode(mode);
        dragStartX.current = e.clientX;
        initialDragState.current = { start: startOffset, end: endOffset };

        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragMode || !containerRef.current) return;
        e.preventDefault();

        const rect = containerRef.current.getBoundingClientRect();
        const deltaPixels = e.clientX - dragStartX.current;
        const deltaSeconds = (deltaPixels / rect.width) * duration;

        let newStart = initialDragState.current.start;
        let newEnd = initialDragState.current.end;

        if (dragMode === 'start') {
            newStart = Math.max(0, Math.min(initialDragState.current.start + deltaSeconds, newEnd - 0.1));
        } else if (dragMode === 'end') {
            newEnd = Math.min(duration, Math.max(initialDragState.current.end + deltaSeconds, newStart + 0.1));
        } else if (dragMode === 'range') {
            const span = newEnd - newStart;
            newStart = Math.max(0, Math.min(initialDragState.current.start + deltaSeconds, duration - span));
            newEnd = newStart + span;
        }

        onRangeChange(newStart, newEnd);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragMode) {
            setDragMode(null);
            onCommit(startOffset, endOffset);
            (e.target as Element).releasePointerCapture(e.pointerId);
        }
    };

    const leftPercent = toPercent(startOffset);
    const rightPercent = toPercent(endOffset);
    const widthPercent = rightPercent - leftPercent;

    // Playhead calculation
    const playheadPercent = currentTime !== undefined ? toPercent(currentTime) : null;

    return (
        <div
            className="relative h-24 bg-black/40 rounded-lg select-none group border border-white/5"
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            {/* Loading State */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/20 backdrop-blur-[1px]">
                    <Loader2 size={20} className="text-emerald-500 animate-spin" />
                </div>
            )}

            {/* Waveform Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />

            {/* Dimmers */}
            <div className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none backdrop-grayscale" style={{ width: `${leftPercent}%` }} />
            <div className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none backdrop-grayscale" style={{ left: `${rightPercent}%` }} />

            {/* Range Selector */}
            <div
                className="absolute top-0 bottom-0 border-t-2 border-b-2 border-emerald-500/50 hover:border-emerald-500 transition-colors cursor-grab active:cursor-grabbing z-10"
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                onPointerDown={(e) => handlePointerDown(e, 'range')}
            >
                <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
            </div>

            {/* Left Handle */}
            <div
                className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-20 flex items-center justify-center group/handle"
                style={{ left: `${leftPercent}%` }}
                onPointerDown={(e) => handlePointerDown(e, 'start')}
            >
                <div className="w-0.5 h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                <div className="absolute top-0 w-3 h-3 bg-emerald-400 rounded-b-sm" />
                <div className="absolute bottom-0 w-3 h-3 bg-emerald-400 rounded-t-sm" />
                {/* Timestamp Label on Hover */}
                <div className="absolute -top-6 text-[9px] bg-black text-white px-1 rounded opacity-0 group-hover/handle:opacity-100 transition-opacity font-mono pointer-events-none">
                    IN
                </div>
            </div>

            {/* Right Handle */}
            <div
                className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-20 flex items-center justify-center group/handle"
                style={{ left: `${rightPercent}%` }}
                onPointerDown={(e) => handlePointerDown(e, 'end')}
            >
                <div className="w-0.5 h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                <div className="absolute top-0 w-3 h-3 bg-emerald-400 rounded-b-sm" />
                <div className="absolute bottom-0 w-3 h-3 bg-emerald-400 rounded-t-sm" />
                <div className="absolute -top-6 text-[9px] bg-black text-white px-1 rounded opacity-0 group-hover/handle:opacity-100 transition-opacity font-mono pointer-events-none">
                    OUT
                </div>
            </div>

            {/* Running Playhead (Red Line) */}
            {playheadPercent !== null && (
                <div
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                    style={{ left: `${playheadPercent}%` }}
                >
                    {/* Playhead Knob */}
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                </div>
            )}
        </div>
    );
};