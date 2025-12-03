import React, { type RefObject } from 'react';
import { Play, Pause, Scissors, MonitorPlay, Volume2, Gauge, Settings2, Loader2, RotateCcw, Download, Zap } from 'lucide-react';
import { Button } from '../ui/Button';

interface VideoInspectorProps {
    // FIX: Allow the ref to hold null
    videoRef: RefObject<HTMLVideoElement | null>;
    src: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    activeNodeId: string | null;
    activeNodeType?: 'clip' | 'output' | 'audio' | 'default'; // Added type
    data?: any; // Node data for persistence
    onUpdateNode?: (id: string, data: any) => void;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onSplit: () => void;
    onTimeUpdate: () => void;
    onLoadedMetadata: () => void;
    // Output specific props
    isProcessing?: boolean;
    processedUrl?: string;
    onProcess?: () => void;
    onFastPreview?: () => void;
}

export const VideoInspector: React.FC<VideoInspectorProps> = ({
    videoRef,
    src,
    isPlaying,
    currentTime,
    duration,
    activeNodeId,
    activeNodeType = 'default',
    data,
    onUpdateNode,
    onPlayPause,
    onSeek,
    onSplit,
    onTimeUpdate,
    onLoadedMetadata,
    isProcessing,
    processedUrl,
    onProcess,
    onFastPreview
}) => {

    const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (duration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        onSeek(percentage * duration);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeNodeId && onUpdateNode) {
            const vol = parseFloat(e.target.value);
            onUpdateNode(activeNodeId, { volume: vol });
            if (videoRef.current && activeNodeType === 'clip') videoRef.current.volume = vol;
        }
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeNodeId && onUpdateNode) {
            const rate = parseFloat(e.target.value);
            onUpdateNode(activeNodeId, { playbackRate: rate });
            if (videoRef.current && activeNodeType === 'clip') videoRef.current.playbackRate = rate;
        }
    };

    // Output Node Handlers
    const handleVideoGainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeNodeId && onUpdateNode) {
            onUpdateNode(activeNodeId, { videoMixGain: parseFloat(e.target.value) });
        }
    };

    const handleAudioGainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeNodeId && onUpdateNode) {
            onUpdateNode(activeNodeId, { audioMixGain: parseFloat(e.target.value) });
        }
    };

    const handleDownload = () => {
        if (!processedUrl || !activeNodeId) return;
        const a = document.createElement('a');
        a.href = `http://localhost:3001${processedUrl}`;
        a.download = `render_${activeNodeId.slice(0, 8)}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
                        <span className="text-sm">Select a clip or output to preview</span>
                    </div>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-30">
                        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                        <span className="text-sm font-bold text-slate-200">Processing Sequence...</span>
                    </div>
                )}

                {/* Overlay Play Button if Paused and Active */}
                {src && !isPlaying && !isProcessing && (
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
            <div className="bg-[#0a0a0a] border-t border-white/5 flex flex-col justify-center shrink-0 relative z-20">
                {/* Progress Bar */}
                <div
                    className="h-1 bg-white/10 cursor-pointer group hover:h-2 transition-all z-30 w-full"
                    onClick={handleProgressBarClick}
                >
                    <div
                        className="h-full bg-yellow-500 relative"
                        style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Main Transport */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={onPlayPause}
                                disabled={!src || isProcessing}
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
                            {activeNodeType === 'clip' && (
                                <Button
                                    onClick={onSplit}
                                    disabled={!activeNodeId || !src}
                                    className="h-8 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-bold border border-white/5"
                                    title="Split Clip at Current Time"
                                >
                                    <Scissors size={14} /> Split
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Clip Properties */}
                    {activeNodeType === 'clip' && activeNodeId && data && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                            {/* Volume */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                                    <span className="flex items-center gap-1"><Volume2 size={10} /> Volume</span>
                                    <span>{Math.round((data.volume ?? 1) * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={data.volume ?? 1}
                                    onChange={handleVolumeChange}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400"
                                />
                            </div>

                            {/* Speed */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                                    <span className="flex items-center gap-1"><Gauge size={10} /> Speed</span>
                                    <span>{data.playbackRate ?? 1}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.25"
                                    value={data.playbackRate ?? 1}
                                    onChange={handleSpeedChange}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400"
                                />
                            </div>
                        </div>
                    )}

                    {/* Output Properties */}
                    {activeNodeType === 'output' && activeNodeId && data && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Settings2 size={12} /> Global Mix Settings
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Video Master Gain */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                                        <span>Video Vol</span>
                                        <span>{Math.round((data.videoMixGain ?? 1) * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1.5"
                                        step="0.1"
                                        value={data.videoMixGain ?? 1}
                                        onChange={handleVideoGainChange}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                                    />
                                </div>

                                {/* Audio Master Gain */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                                        <span>Audio Vol</span>
                                        <span>{Math.round((data.audioMixGain ?? 1) * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1.5"
                                        step="0.1"
                                        value={data.audioMixGain ?? 1}
                                        onChange={handleAudioGainChange}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <Button
                                    onClick={onFastPreview}
                                    className="h-9 bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-2 text-xs font-bold border border-white/5"
                                >
                                    <Zap size={14} className="text-yellow-500" /> Fast Preview
                                </Button>

                                <Button
                                    onClick={onProcess}
                                    className={`h-9 font-bold flex items-center justify-center gap-2 text-xs
                                        ${processedUrl
                                            ? 'bg-slate-700 hover:bg-slate-600'
                                            : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                                        }`}
                                >
                                    {processedUrl ? <RotateCcw size={14} /> : <Play size={14} fill="currentColor" />}
                                    {processedUrl ? 'Re-Process' : 'Process'}
                                </Button>
                            </div>

                            {processedUrl && (
                                <Button
                                    onClick={handleDownload}
                                    className="w-full h-9 bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 flex items-center justify-center gap-2 text-xs"
                                >
                                    <Download size={14} /> Download Rendered MP4
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};