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

    isExpanded?: boolean;
    onToggleExpand?: () => void;

    // NEW PROP
    projectDimensions?: { width: number; height: number };
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
    onToggleExpand,
    projectDimensions
}) => {
    const { activeNodeId, activeNodeType, clips } = previewState;
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

    return (
        <div className="flex flex-col h-full bg-[#000] border-l border-white/5 shadow-2xl relative z-20 rounded-inherit overflow-hidden">
            {!isExpanded && (
                <div className="flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10 shrink-0 h-10">
                    <div className="flex h-full">
                        <button
                            onClick={() => setViewMode('preview')}
                            className={`px-4 h-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${viewMode === 'preview' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            <MonitorPlay size={12} /> Graph Preview
                        </button>
                        {processedUrl && (
                            <button
                                onClick={() => setViewMode('result')}
                                className={`px-4 h-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${viewMode === 'result' ? 'border-green-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                <Eye size={12} /> Rendered Result
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Monitor Area - Takes Maximum Space */}
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
                    isExpanded={isExpanded}
                    onToggleExpand={onToggleExpand}
                    projectDimensions={projectDimensions} // Pass down
                />

                {isProcessing && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-50">
                        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                        <span className="text-sm font-bold text-slate-200">Processing Sequence...</span>
                    </div>
                )}
            </div>

            {/* Properties Area */}
            {!isExpanded && (
                <div className="bg-[#0a0a0a] border-t border-white/5 flex flex-col shrink-0 z-20">
                    {activeNodeType && (
                        <div className="p-3 space-y-3">
                            {/* CLIP PROPERTIES */}
                            {activeNodeType === 'clip' && activeClipData && (
                                <div className="space-y-3 animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-white/5">
                                        <Settings2 size={10} /> Clip Properties
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase font-bold">
                                                <span className="flex items-center gap-1"><Volume2 size={9} /> Volume</span>
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
                                            <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase font-bold">
                                                <span className="flex items-center gap-1"><Gauge size={9} /> Speed</span>
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

                            {/* RENDER NODE ACTIONS */}
                            {activeNodeType === 'render' && (
                                <div className="space-y-3 animate-in slide-in-from-bottom-2">
                                    <div className="grid grid-cols-1 gap-2 pt-1">
                                        {viewMode === 'preview' && (
                                            <Button
                                                onClick={onProcess}
                                                className={`h-10 font-bold flex items-center justify-center gap-2 text-xs w-full
                                                    ${processedUrl
                                                        ? 'bg-slate-700 hover:bg-slate-600'
                                                        : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                                                    }`}
                                            >
                                                {processedUrl ? <RotateCcw size={14} /> : <Play size={14} fill="currentColor" />}
                                                {processedUrl ? 'Re-Process Video' : 'Process Full Video'}
                                            </Button>
                                        )}

                                        {processedUrl && (
                                            <Button
                                                onClick={() => {
                                                    const a = document.createElement('a');
                                                    a.href = `http://localhost:3001${processedUrl}`;
                                                    a.download = `render.mp4`;
                                                    a.click();
                                                }}
                                                className="w-full h-10 bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 flex items-center justify-center gap-2 text-xs"
                                            >
                                                <Download size={14} /> Download MP4
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};