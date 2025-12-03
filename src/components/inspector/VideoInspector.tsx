import React, { type RefObject } from 'react';
import { Play, Pause, Scissors, MonitorPlay } from 'lucide-react';
import { Button } from '../ui/Button';

interface VideoInspectorProps {
    // FIX: Allow the ref to hold null
    videoRef: RefObject<HTMLVideoElement | null>;
    src: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    activeNodeId: string | null;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onSplit: () => void;
    onTimeUpdate: () => void;
    onLoadedMetadata: () => void;
}

export const VideoInspector: React.FC<VideoInspectorProps> = ({
    videoRef,
    src,
    isPlaying,
    currentTime,
    duration,
    activeNodeId,
    onPlayPause,
    onSeek,
    onSplit,
    onTimeUpdate,
    onLoadedMetadata
}) => {

    const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (duration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        onSeek(percentage * duration);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 10);
        return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
    };

    return (
        <div className="flex flex-col h-full bg-[#000] border-l border-white/5 shadow-2xl relative z-20">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MonitorPlay size={14} /> Preview Monitor
                </h2>
            </div>

            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {src ? (
                    <video
                        ref={videoRef}
                        src={src}
                        className="w-full h-full object-contain"
                        onTimeUpdate={onTimeUpdate}
                        onLoadedMetadata={onLoadedMetadata}
                        onClick={onPlayPause}
                    />
                ) : (
                    <div className="text-slate-700 flex flex-col items-center">
                        <MonitorPlay size={48} className="mb-2 opacity-30" />
                        <span className="text-sm">Select a video clip to preview</span>
                    </div>
                )}

                {/* Overlay Play Button if Paused and Active */}
                {src && !isPlaying && (
                    <div
                        className="absolute inset-0 flex items-center justify-center bg-black/10 cursor-pointer"
                        onClick={onPlayPause}
                    >
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:scale-110 transition-transform">
                            <Play fill="white" className="ml-1 text-white" />
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="h-20 bg-[#0a0a0a] border-t border-white/5 px-4 flex flex-col justify-center shrink-0 relative z-20">
                {/* Progress Bar */}
                <div
                    className="absolute top-0 left-0 right-0 h-1 bg-white/10 cursor-pointer group hover:h-2 transition-all z-30"
                    onClick={handleProgressBarClick}
                >
                    <div
                        className="h-full bg-yellow-500 relative"
                        style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
                    </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={onPlayPause}
                            disabled={!src}
                            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all p-0"
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                        </Button>
                        <div className="flex flex-col">
                            <span className="text-lg font-mono font-bold text-yellow-500 leading-none">{formatTime(currentTime)}</span>
                            <span className="text-[10px] font-mono text-slate-600 leading-none mt-1">{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={onSplit}
                            disabled={!activeNodeId || !src}
                            className="h-8 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-bold border border-white/5"
                            title="Split Clip at Current Time"
                        >
                            <Scissors size={14} /> Split
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};