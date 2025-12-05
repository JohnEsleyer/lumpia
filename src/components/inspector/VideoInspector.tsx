import React, { type RefObject, useState, useEffect } from 'react';
import { MonitorPlay, Volume2, Gauge, Settings2, Loader2, RotateCcw, Download, Play, Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { PreviewMonitor } from './PreviewMonitor';
import type { PreviewState } from '../../hooks/usePreviewLogic';

interface VideoInspectorProps {
    videoRef: RefObject<HTMLVideoElement | null>;
    previewState: PreviewState;
    isPlaying: boolean;
    currentTime: number;

    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onTimeUpdate: (time: number) => void;
    onSplit: () => void;
    onUpdateNode?: (id: string, data: any) => void;

    isProcessing?: boolean;
    processedUrl?: string;
    onProcess?: () => void;

    // --- ADDED MISSING PROPS ---
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export const VideoInspector: React.FC<VideoInspectorProps> = ({
    videoRef,
    previewState,
    isPlaying,
    currentTime,
    onPlayPause,
    onSeek,
    onTimeUpdate,
    onSplit,
    onUpdateNode,
    isProcessing,
    processedUrl,
    onProcess,
    isExpanded,
    onToggleExpand
}) => {
    const { activeNodeId, activeNodeType, mix, clips } = previewState;
    const activeClipData = activeNodeType === 'clip' && clips.length === 1 ? clips[0] : null;

    const [viewMode, setViewMode] = useState<'preview' | 'result'>('preview');

    useEffect(() => {
        setViewMode('preview');
    }, [activeNodeId]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeNodeId && onUpdateNode) {
            onUpdateNode(activeNodeId, { volume: parseFloat(e.target.value) });
        }
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeNodeId && onUpdateNode) {
            onUpdateNode(activeNodeId, { playbackRate: parseFloat(e.target.value) });
        }
    };

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

    return (
        <div className="flex flex-col h-full bg-[#000] border-l border-white/5 shadow-2xl relative z-20 rounded-inherit overflow-hidden">
            {/* Header with Tabs (Hide in Expanded Mode) */}
            {!isExpanded && (
                <div className="flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10 shrink-0">
                    <div className="flex">
                        <button
                            onClick={() => setViewMode('preview')}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${viewMode === 'preview' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            <MonitorPlay size={14} /> Graph Preview
                        </button>
                        {processedUrl && (
                            <button
                                onClick={() => setViewMode('result')}
                                className={`px-4 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${viewMode === 'result' ? 'border-green-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                <Eye size={14} /> Rendered Result
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Monitor Area */}
            <div className="flex-1 relative bg-black overflow-hidden min-h-[300px]">
                <PreviewMonitor
                    videoRef={videoRef}
                    previewState={previewState}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    onPlayPause={onPlayPause}
                    onSeek={onSeek}
                    onTimeUpdate={onTimeUpdate}
                    onSplit={onSplit}
                    viewMode={viewMode}
                    processedUrl={processedUrl}
                    // Pass expansion props
                    isExpanded={isExpanded}
                    onToggleExpand={onToggleExpand}
                />

                {isProcessing && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-50">
                        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                        <span className="text-sm font-bold text-slate-200">Processing Sequence...</span>
                    </div>
                )}
            </div>

            {/* Properties Area (HIDDEN IF EXPANDED) */}
            {!isExpanded && (
                <div className="bg-[#0a0a0a] border-t border-white/5 flex flex-col shrink-0 z-20">
                    <div className="p-4 space-y-4">

                        {activeNodeType === 'clip' && activeClipData && (
                            <div className="space-y-4 animate-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-2">
                                    <Settings2 size={12} /> Clip Properties
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                                            <span className="flex items-center gap-1"><Volume2 size={10} /> Volume</span>
                                            <span className="text-yellow-500">{Math.round((activeClipData.volume ?? 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1" step="0.05"
                                            value={activeClipData.volume ?? 1}
                                            onChange={handleVolumeChange}
                                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                                            <span className="flex items-center gap-1"><Gauge size={10} /> Speed</span>
                                            <span className="text-yellow-500">{activeClipData.playbackRate ?? 1}x</span>
                                        </div>
                                        <input
                                            type="range" min="0.25" max="3" step="0.25"
                                            value={activeClipData.playbackRate ?? 1}
                                            onChange={handleSpeedChange}
                                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeNodeType === 'render' && (
                            <div className="space-y-4 animate-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-2">
                                    <Settings2 size={12} /> Global Mix & Output
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                                            <span>Video Vol</span>
                                            <span>{Math.round((mix.videoGain ?? 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1.5" step="0.1"
                                            value={mix.videoGain ?? 1}
                                            onChange={handleVideoGainChange}
                                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                                            <span>Audio Vol</span>
                                            <span>{Math.round((mix.audioGain ?? 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1.5" step="0.1"
                                            value={mix.audioGain ?? 1}
                                            onChange={handleAudioGainChange}
                                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 pt-2">
                                    <Button
                                        onClick={onProcess}
                                        className={`h-9 font-bold flex items-center justify-center gap-2 text-xs
                                            ${processedUrl
                                                ? 'bg-slate-700 hover:bg-slate-600'
                                                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                                            }`}
                                    >
                                        {processedUrl ? <RotateCcw size={14} /> : <Play size={14} fill="currentColor" />}
                                        {processedUrl ? 'Re-Process Full Video' : 'Process Full Video'}
                                    </Button>

                                    {processedUrl && (
                                        <Button
                                            onClick={() => {
                                                const a = document.createElement('a');
                                                a.href = `http://localhost:3001${processedUrl}`;
                                                a.download = `render.mp4`;
                                                a.click();
                                            }}
                                            className="w-full h-9 bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 flex items-center justify-center gap-2 text-xs"
                                        >
                                            <Download size={14} /> Download MP4
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};