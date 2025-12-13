import React from 'react';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Scissors,
    MousePointer2,
    ZoomIn,
    ZoomOut
} from 'lucide-react';

interface TimelineControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    onSkipToStart: () => void;
    onSkipToEnd: () => void;
    currentTime: number;
    duration: number;
    // Tools
    activeTool: 'cursor' | 'split';
    onToolChange: (tool: 'cursor' | 'split') => void;
    onSplit: () => void;
    canSplit: boolean;
    // Zoom
    zoom: number;
    onZoomChange: (newZoom: number) => void;
    minZoom: number;
    maxZoom: number;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
    isPlaying,
    onPlayPause,
    onSkipToStart,
    onSkipToEnd,
    currentTime,
    duration,
    activeTool,
    onToolChange,
    onSplit,
    canSplit,
    zoom,
    onZoomChange,
    minZoom,
    maxZoom
}) => {

    // Helper to format time as HH:MM:SS:FF
    const formatTimecode = (time: number) => {
        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = Math.floor(time % 60);
        const f = Math.floor((time % 1) * 30); // Approx 30 FPS

        const hh = h > 0 ? `${h.toString().padStart(2, '0')}:` : '';
        const mm = m.toString().padStart(2, '0');
        const ss = s.toString().padStart(2, '0');
        const ff = f.toString().padStart(2, '0');

        return `${hh}${mm}:${ss}:${ff}`;
    };

    return (
        <div className="h-12 bg-[#1a1a1a] border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 select-none">

            {/* Left: Transport Controls */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-zinc-900 rounded-md p-1 border border-white/5">
                    <button
                        onClick={onSkipToStart}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Jump to Start"
                    >
                        <SkipBack size={14} fill="currentColor" />
                    </button>

                    <button
                        onClick={onPlayPause}
                        className={`p-1.5 rounded transition-all ${isPlaying
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'text-zinc-200 hover:text-white hover:bg-white/10'
                            }`}
                        title="Play/Pause (Space)"
                    >
                        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>

                    <button
                        onClick={onSkipToEnd}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Jump to End"
                    >
                        <SkipForward size={14} fill="currentColor" />
                    </button>
                </div>

                {/* Timecode Display */}
                <div className="flex items-baseline gap-1.5 font-mono text-sm font-medium bg-black/40 px-3 py-1.5 rounded border border-white/5">
                    <span className="text-indigo-400">{formatTimecode(currentTime)}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-500">{formatTimecode(duration)}</span>
                </div>
            </div>

            {/* Center: Tools */}
            <div className="flex items-center gap-2">
                <div className="flex bg-zinc-900 rounded-lg p-1 border border-white/5 gap-1">
                    <button
                        onClick={() => onToolChange('cursor')}
                        className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold uppercase tracking-wide transition-all ${activeTool === 'cursor'
                                ? 'bg-zinc-700 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }`}
                        title="Selection Tool (V)"
                    >
                        <MousePointer2 size={12} /> Select
                    </button>
                    <button
                        onClick={() => onToolChange('split')}
                        className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold uppercase tracking-wide transition-all ${activeTool === 'split'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }`}
                        title="Razor Tool (C)"
                    >
                        <Scissors size={12} /> Split
                    </button>
                </div>

                <div className="w-px h-6 bg-white/10 mx-2" />

                <button
                    onClick={onSplit}
                    disabled={!canSplit}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    title="Split at Playhead (S)"
                >
                    <Scissors size={12} /> Split at Playhead
                </button>
            </div>

            {/* Right: Zoom & Settings */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 group">
                    <ZoomOut size={14} className="text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                    <input
                        type="range"
                        min={minZoom}
                        max={maxZoom}
                        value={zoom}
                        onChange={(e) => onZoomChange(Number(e.target.value))}
                        className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                    />
                    <ZoomIn size={14} className="text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                </div>
            </div>
        </div>
    );
};