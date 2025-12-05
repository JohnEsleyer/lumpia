import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Play, Pause, MonitorPlay, Scissors, RotateCcw, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import type { PreviewState } from '../../hooks/usePreviewLogic';

interface PreviewMonitorProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    previewState: PreviewState;
    isPlaying: boolean;
    currentTime: number;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onTimeUpdate: (time: number) => void;
    onSplit?: () => void;
    viewMode?: 'preview' | 'result';
    processedUrl?: string;

    // Expansion props
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export const PreviewMonitor: React.FC<PreviewMonitorProps> = ({
    previewState,
    isPlaying,
    currentTime,
    onPlayPause,
    onSeek,
    onTimeUpdate,
    onSplit,
    viewMode = 'preview',
    processedUrl,
    isExpanded,
    onToggleExpand
}) => {
    // ... (Hooks and Logic remain identical to previous iteration) ...
    const { clips, totalDuration } = previewState;
    const [showControls, setShowControls] = useState(true);
    const isEnded = totalDuration > 0 && currentTime >= totalDuration - 0.05;
    const videoA = useRef<HTMLVideoElement>(null);
    const videoB = useRef<HTMLVideoElement>(null);

    const activeClipInfo = useMemo(() => {
        if (clips.length === 0) return null;
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const clipEnd = clip.timelineStart + clip.timelineDuration;
            if (currentTime >= clip.timelineStart && currentTime < clipEnd - 0.01) {
                return { index: i, clip, sourceTime: clip.start + (currentTime - clip.timelineStart) * clip.playbackRate, nextClip: clips[i + 1], activeBuffer: i % 2 === 0 ? 'A' : 'B' };
            }
        }
        const last = clips[clips.length - 1];
        return { index: clips.length - 1, clip: last, sourceTime: last.end, nextClip: undefined, activeBuffer: (clips.length - 1) % 2 === 0 ? 'A' : 'B' };
    }, [clips, currentTime]);

    useEffect(() => {
        if (viewMode === 'result') return;
        if (!activeClipInfo) return;
        const { clip, sourceTime, nextClip, activeBuffer } = activeClipInfo;
        const primary = activeBuffer === 'A' ? videoA.current : videoB.current;
        const secondary = activeBuffer === 'A' ? videoB.current : videoA.current;
        if (!primary || !secondary) return;

        if (primary.src !== clip.url) { primary.src = clip.url; primary.load(); }
        primary.volume = (clip.volume ?? 1) * (previewState.mix?.videoGain ?? 1);
        primary.playbackRate = clip.playbackRate ?? 1.0;
        if (Math.abs(primary.currentTime - sourceTime) > 0.3) { primary.currentTime = sourceTime; }
        if (isPlaying && !isEnded) { if (primary.paused) primary.play().catch(() => { }); } else { if (!primary.paused) primary.pause(); }

        if (!secondary.paused) secondary.pause();
        if (nextClip) { if (secondary.src !== nextClip.url) { secondary.src = nextClip.url; secondary.load(); secondary.currentTime = nextClip.start; } }
        else { if (secondary.src) { secondary.removeAttribute('src'); secondary.load(); } }
    }, [activeClipInfo, isPlaying, previewState.mix, viewMode, isEnded]);

    const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        if (viewMode === 'result' || !activeClipInfo) return;
        if (e.currentTarget !== (activeClipInfo.activeBuffer === 'A' ? videoA.current : videoB.current)) return;
        const video = e.currentTarget;
        const progressInClip = video.currentTime - activeClipInfo.clip.start;
        const timelineProgress = progressInClip / activeClipInfo.clip.playbackRate;
        let newGlobalTime = activeClipInfo.clip.timelineStart + timelineProgress;
        if (newGlobalTime >= totalDuration) { newGlobalTime = totalDuration; if (isPlaying) onPlayPause(); }
        onTimeUpdate(newGlobalTime);
    };

    const handleVideoEnded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        if (viewMode === 'result' || !activeClipInfo) return;
        if (e.currentTarget !== (activeClipInfo.activeBuffer === 'A' ? videoA.current : videoB.current)) return;
        const nextTime = activeClipInfo.clip.timelineStart + activeClipInfo.clip.timelineDuration;
        if (nextTime >= totalDuration) { onTimeUpdate(totalDuration); onPlayPause(); } else { onTimeUpdate(nextTime + 0.001); }
    };

    const handleTransportClick = () => {
        if (isEnded) { onSeek(0); setTimeout(() => onPlayPause(), 50); } else { onPlayPause(); }
    };

    const formatTime = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const getBufferClass = (isActive: boolean) => `absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-0 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`;

    if (viewMode === 'result' && processedUrl) {
        return (
            <div className="flex flex-col h-full bg-black">
                <div className="flex-1 flex items-center justify-center relative group">
                    <video src={`http://localhost:3001${processedUrl}`} className="max-h-full max-w-full" controls autoPlay />
                </div>
                <div className="bg-[#0a0a0a] border-t border-white/5 p-2 text-center text-xs text-green-500 font-bold uppercase tracking-widest">Playing Rendered Output</div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-black select-none group relative ${isExpanded ? 'rounded-2xl overflow-hidden' : ''}`}>
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#050505]">
                {/* Grid Overlay */}
                <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                <video ref={videoA} className={getBufferClass(activeClipInfo?.activeBuffer === 'A')} onTimeUpdate={handleVideoTimeUpdate} onEnded={handleVideoEnded} playsInline muted={false} />
                <video ref={videoB} className={getBufferClass(activeClipInfo?.activeBuffer === 'B')} onTimeUpdate={handleVideoTimeUpdate} onEnded={handleVideoEnded} playsInline muted={false} />

                {clips.length === 0 && <div className="text-slate-600 flex flex-col items-center gap-2"><MonitorPlay size={48} className="opacity-20" /><span className="text-xs font-mono opacity-50">NO SIGNAL</span></div>}

                {/* Floating Restore Button (Minimal Mode) */}
                {!showControls && (
                    <button onClick={() => setShowControls(true)} className="absolute bottom-3 right-3 z-50 bg-black/60 hover:bg-black/90 text-white/50 hover:text-white p-2 rounded-lg backdrop-blur-md border border-white/10 transition-all shadow-lg animate-in fade-in zoom-in duration-200">
                        <ChevronUp size={16} />
                    </button>
                )}
            </div>

            {/* Transport Controls */}
            {showControls && (
                <div className="h-12 bg-[#0a0a0a] border-t border-white/5 flex items-center px-4 gap-4 shrink-0 z-30 animate-in slide-in-from-bottom-2 duration-200">
                    <button onClick={handleTransportClick} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all">
                        {isEnded ? <RotateCcw size={14} strokeWidth={2.5} /> : isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <div className="flex-1 flex flex-col justify-center gap-1 group/timeline">
                        <input type="range" min={0} max={totalDuration || 10} step={0.01} value={currentTime} onChange={(e) => onSeek(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400" />
                        <div className="flex justify-between text-[9px] font-mono text-slate-500"><span>{formatTime(currentTime)}</span><span>{formatTime(totalDuration)}</span></div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        {onSplit && <button onClick={onSplit} className="p-1.5 hover:bg-white/10 rounded-md hover:text-white transition-colors" title="Split Clip"><Scissors size={14} /></button>}
                        <div className="w-px h-4 bg-white/10 mx-1"></div>
                        <button onClick={() => setShowControls(false)} className="p-1.5 hover:bg-white/10 rounded-md hover:text-white transition-colors" title="Hide Controls"><ChevronDown size={14} /></button>

                        {/* Expand / Collapse Button */}
                        {onToggleExpand && (
                            <button onClick={onToggleExpand} className="p-1.5 hover:bg-white/10 rounded-md hover:text-white transition-colors ml-1" title={isExpanded ? "Exit Expanded Mode" : "Expand Monitor"}>
                                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};