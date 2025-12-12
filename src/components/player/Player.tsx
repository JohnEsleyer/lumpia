import React, { useRef } from 'react';
import { Play, Volume2, Pause, RotateCcw } from 'lucide-react';
import { PreviewMonitor } from '../inspector/PreviewMonitor';

import type { PreviewState } from '../../hooks/usePreviewLogic';

interface PlayerProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    previewState: PreviewState; // <--- Contains the actual content duration
    isPlaying: boolean;
    currentTime: number;
    // totalDuration?: number; // <-- REMOVE this prop, as it's the padded timeline duration
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onTimeUpdate: (time: number) => void;
    processedUrl?: string;
    projectDimensions?: { width: number; height: number };
}

export const Player: React.FC<PlayerProps> = ({
    videoRef,
    previewState,
    isPlaying,
    currentTime,
    // totalDuration, // Removed from destructuring
    onPlayPause,
    onSeek,
    onTimeUpdate,
    projectDimensions
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Use the actual content duration from previewState
    const contentDuration = previewState.totalDuration || 0;

    // Format time helper
    const formatTime = (s: number) => {
        const minutes = Math.floor(s / 60);
        const seconds = Math.floor(s % 60);
        const frames = Math.floor((s % 1) * 30); // Approx 30fps
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full h-full flex flex-col relative group" ref={containerRef}>

            {/* Main Viewport */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                <PreviewMonitor
                    videoRef={videoRef}
                    previewState={previewState}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    onPlayPause={onPlayPause}
                    onSeek={onSeek}
                    onTimeUpdate={onTimeUpdate}
                    onSplit={() => { }} // Player might not need split directly on overlay anymore?
                    viewMode="preview" // Enforce preview mode in this component
                    isExpanded={false}
                    projectDimensions={projectDimensions}
                    showControls={false}
                />


                {/* Playback Overlay (Big Play Button) */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-2xl scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300">
                            <Play className="fill-white text-white ml-2" size={40} />
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Bar - Floating at bottom of player */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] h-14 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center px-4 gap-4 shadow-xl translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-50">

                {/* Play/Pause Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Use contentDuration for restart logic
                        if (contentDuration > 0 && currentTime >= contentDuration - 0.1) {
                            onSeek(0);
                            setTimeout(onPlayPause, 50);
                        } else {
                            onPlayPause();
                        }
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 active:scale-95 transition-all shadow-lg shrink-0"
                >
                    {(contentDuration > 0 && currentTime >= contentDuration - 0.1) ?
                        <RotateCcw size={14} strokeWidth={2.5} /> :
                        isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />
                    }
                </button>

                {/* Time Display */}
                <div className="font-mono text-xs font-medium text-zinc-400 select-none shrink-0 min-w-[80px]">
                    <span className="text-white">{formatTime(currentTime)}</span>
                    <span className="mx-1 opacity-50">/</span>
                    <span>{formatTime(contentDuration)}</span> {/* <-- Corrected to use contentDuration */}
                </div>

                {/* Scrubber */}
                <div className="flex-1 flex items-center">
                    <input
                        type="range"
                        min={0}
                        max={contentDuration || 10} // Scrubber max should also be content duration
                        step={0.05}
                        value={currentTime}
                        onChange={(e) => onSeek(parseFloat(e.target.value))}
                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-indigo-400 transition-all"
                    />
                </div>

                {/* Volume Mockup */}
                <Volume2 size={16} className="text-zinc-400 hover:text-white cursor-pointer shrink-0" />

                {/* Fullscreen Mockup */}
                {/* <Maximize size={16} className="text-zinc-400 hover:text-white cursor-pointer" /> */}
            </div>
        </div>

    );
};