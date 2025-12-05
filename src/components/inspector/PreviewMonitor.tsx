import React, { useRef, useEffect, useState } from 'react';
import { Player, type PlayerRef, type CallbackListener } from '@remotion/player';
import { MonitorPlay, ChevronDown, ChevronUp, RotateCcw, Pause, Play, Scissors, Minimize2, Maximize2 } from 'lucide-react';
import { PreviewComposition } from '../../remotion/PreviewComposition';
import type { PreviewState } from '../../hooks/usePreviewLogic';

interface PreviewMonitorProps {
    videoRef: React.RefObject<HTMLVideoElement | null>; // Kept for interface compatibility
    previewState: PreviewState;
    isPlaying: boolean;
    currentTime: number;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onTimeUpdate: (time: number) => void;
    onSplit?: () => void;
    viewMode?: 'preview' | 'result';
    processedUrl?: string;
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
    const playerRef = useRef<PlayerRef>(null);
    const [showControls, setShowControls] = useState(true);

    // Hardcoded for now, but should ideally come from project settings
    const FPS = 30;

    // Calculate total frames. Ensure at least 1 frame to prevent Player crash.
    const durationInFrames = Math.max(1, Math.ceil((previewState.totalDuration || 1) * FPS));

    // --- SYNC: React State -> Player ---
    // When the user clicks Play/Pause in the inspector
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        if (isPlaying && !player.isPlaying()) {
            player.play();
        } else if (!isPlaying && player.isPlaying()) {
            player.pause();
        }
    }, [isPlaying]);

    // --- SYNC: React Time -> Player ---
    // When user drags the scrubber
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        const playerFrame = player.getCurrentFrame();
        const targetFrame = Math.round(currentTime * FPS);

        // Allow a small drift (2 frames) before forcing a seek to avoid fighting the update loop
        if (Math.abs(playerFrame - targetFrame) > 2) {
            player.seekTo(targetFrame);
        }
    }, [currentTime, FPS]);


    // --- SYNC: Player -> React State ---
    // Listen to the player updating frames naturally
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        const onFrame: CallbackListener<'frameupdate'> = (e) => {
            const time = e.detail.frame / FPS;

            // Only update parent if we are playing to avoid loop with the seek effect above
            if (isPlaying) {
                onTimeUpdate(time);
            }

            // Handle End of Video
            if (e.detail.frame >= durationInFrames - 1 && isPlaying) {
                onPlayPause(); // Pause parent
            }
        };

        player.addEventListener('frameupdate', onFrame);
        return () => {
            player.removeEventListener('frameupdate', onFrame);
        };
    }, [isPlaying, durationInFrames, onTimeUpdate, onPlayPause, FPS]);


    // --- Helpers ---
    const formatTime = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // --- Render: Result View ---
    if (viewMode === 'result' && processedUrl) {
        return (
            <div className="flex flex-col h-full bg-black relative overflow-hidden">
                <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
                    <video src={`http://localhost:3001${processedUrl}`} className="w-full h-full object-cover blur-3xl scale-125" muted loop autoPlay />
                    <div className="absolute inset-0 bg-black/50" />
                </div>
                <div className="flex-1 flex items-center justify-center relative z-10 p-4">
                    <video src={`http://localhost:3001${processedUrl}`} className="w-full h-full object-contain shadow-2xl drop-shadow-2xl rounded-lg" controls autoPlay />
                </div>
                <div className="bg-[#0a0a0a]/80 backdrop-blur-md border-t border-white/5 p-2 text-center text-xs text-green-500 font-bold uppercase tracking-widest z-20">Playing Rendered Output</div>
            </div>
        );
    }

    const hasContent = previewState.clips.length > 0 || previewState.audioClips.length > 0;

    // --- Render: Preview View ---
    return (
        <div className={`flex flex-col h-full bg-black select-none group relative ${isExpanded ? 'rounded-2xl overflow-hidden' : ''}`}>

            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#050505]">
                {hasContent ? (
                    <Player
                        ref={playerRef}
                        component={PreviewComposition}
                        inputProps={{
                            clips: previewState.clips,
                            audioClips: previewState.audioClips,
                            mix: previewState.mix,
                            fps: FPS
                        }}
                        durationInFrames={durationInFrames}
                        fps={FPS}
                        compositionWidth={1920}
                        compositionHeight={1080}
                        style={{
                            width: '100%',
                            height: '100%',
                        }}
                        controls={false} // We use our own inspector controls
                        autoPlay={false}
                        loop={false}
                        doubleClickToFullscreen
                    />
                ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-2">
                        <MonitorPlay size={48} className="opacity-20" />
                        <span className="text-xs font-mono opacity-50">NO SIGNAL</span>
                    </div>
                )}

                {!showControls && (
                    <button onClick={() => setShowControls(true)} className="absolute bottom-3 right-3 z-50 bg-black/60 hover:bg-black/90 text-white/50 hover:text-white p-2 rounded-lg backdrop-blur-md border border-white/10 transition-all shadow-lg animate-in fade-in zoom-in duration-200"><ChevronUp size={16} /></button>
                )}
            </div>

            {/* Transport Controls */}
            {showControls && (
                <div className="h-12 bg-[#0a0a0a] border-t border-white/5 flex items-center px-4 gap-4 shrink-0 z-30 animate-in slide-in-from-bottom-2 duration-200">
                    <button
                        onClick={() => {
                            if (currentTime >= previewState.totalDuration - 0.1) {
                                onSeek(0);
                                setTimeout(onPlayPause, 50);
                            } else {
                                onPlayPause();
                            }
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all"
                    >
                        {currentTime >= previewState.totalDuration - 0.1 ? <RotateCcw size={14} strokeWidth={2.5} /> : isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                    </button>

                    <div className="flex-1 flex flex-col justify-center gap-1 group/timeline">
                        <input
                            type="range"
                            min={0}
                            max={previewState.totalDuration || 10}
                            step={0.05}
                            value={currentTime}
                            onChange={(e) => onSeek(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                        />
                        <div className="flex justify-between text-[9px] font-mono text-slate-500">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(previewState.totalDuration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                        {onSplit && <button onClick={onSplit} className="p-1.5 hover:bg-white/10 rounded-md hover:text-white transition-colors" title="Split Clip"><Scissors size={14} /></button>}
                        <div className="w-px h-4 bg-white/10 mx-1"></div>
                        <button onClick={() => setShowControls(false)} className="p-1.5 hover:bg-white/10 rounded-md hover:text-white transition-colors" title="Hide Controls"><ChevronDown size={14} /></button>
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