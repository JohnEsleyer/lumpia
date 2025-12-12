import React, { useRef, useEffect, useMemo } from 'react';
import { Player, type PlayerRef, type CallbackListener } from '@remotion/player';
import { MonitorPlay, RotateCcw, Pause, Play, Scissors, Minimize2, Maximize2 } from 'lucide-react';
import { PreviewComposition } from '../../remotion/PreviewComposition';
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
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    projectDimensions?: { width: number; height: number };
    trimRange?: { start: number; end: number };
    showControls?: boolean;
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
    onToggleExpand,
    projectDimensions,
    // @ts-ignore
    trimRange,
    showControls = true
}) => {

    const playerRef = useRef<PlayerRef>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const isPlayerDriving = useRef(false);
    const lastAudioSrc = useRef<string | null>(null);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onPlayPauseRef = useRef(onPlayPause);

    // Dimensions
    const width = projectDimensions?.width || 1920;
    const height = projectDimensions?.height || 1080;
    const FPS = 30;
    const durationInFrames = Math.max(1, Math.ceil((previewState.totalDuration || 1) * FPS));

    // Update Refs
    useEffect(() => {
        onTimeUpdateRef.current = onTimeUpdate;
        onPlayPauseRef.current = onPlayPause;
    }, [onTimeUpdate, onPlayPause]);

    // Input Props
    const inputProps = useMemo(() => ({
        clips: previewState.clips,
        audioClips: previewState.audioClips,
        fps: FPS
    }), [previewState.clips, previewState.audioClips, FPS]);

    // --- AUDIO SYNC ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const activeAudioClip = previewState.audioClips.find(clip => {
            const end = clip.timelineStart + clip.timelineDuration;
            return currentTime >= clip.timelineStart && currentTime < end;
        });

        if (activeAudioClip) {
            if (lastAudioSrc.current !== activeAudioClip.url) {
                audio.src = activeAudioClip.url;
                lastAudioSrc.current = activeAudioClip.url;
            }
            const timeInFile = (currentTime - activeAudioClip.timelineStart) + activeAudioClip.start;
            audio.volume = activeAudioClip.volume ?? 1.0;
            if (Math.abs(audio.currentTime - timeInFile) > 0.25) audio.currentTime = timeInFile;

            if (isPlaying) {
                if (audio.paused) audio.play().catch(console.warn);
            } else {
                if (!audio.paused) audio.pause();
            }
        } else {
            if (!audio.paused) audio.pause();
        }
    }, [currentTime, isPlaying, previewState.audioClips]);

    // --- PLAYER SYNC ---
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;
        if (isPlaying && !player.isPlaying()) player.play();
        else if (!isPlaying && player.isPlaying()) player.pause();
    }, [isPlaying]);

    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;
        if (isPlayerDriving.current) { isPlayerDriving.current = false; return; }

        const playerFrame = player.getCurrentFrame();
        const targetFrame = Math.round(currentTime * FPS);
        const threshold = isPlaying ? 5 : 0.5;
        if (Math.abs(playerFrame - targetFrame) > threshold) player.seekTo(targetFrame);
    }, [currentTime, FPS, isPlaying]);

    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;
        const onFrame: CallbackListener<'frameupdate'> = (e) => {
            const time = e.detail.frame / FPS;
            if (isPlaying) {
                isPlayerDriving.current = true;
                onTimeUpdateRef.current(time);
            }
            if (e.detail.frame >= durationInFrames - 1 && isPlaying) {
                onPlayPauseRef.current();
            }
        };
        player.addEventListener('frameupdate', onFrame);
        return () => { player.removeEventListener('frameupdate', onFrame); };
    }, [isPlaying, durationInFrames, FPS]);

    const formatTime = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const hasContent = previewState.clips.length > 0 || previewState.audioClips.length > 0;

    // --- RENDER ---
    return (
        <div className={`relative w-full h-full bg-black overflow-hidden group select-none ${isExpanded ? 'rounded-none' : 'rounded-lg'}`}>
            <audio ref={audioRef} className="hidden" />

            {/* Content Layer */}
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
                {viewMode === 'result' && processedUrl ? (
                    <video
                        src={`http://localhost:3001${processedUrl}`}
                        className="w-full h-full object-contain"
                        controls={false} // Custom controls
                        autoPlay
                    />
                ) : hasContent ? (
                    <Player
                        ref={playerRef}
                        component={PreviewComposition}
                        inputProps={inputProps}
                        durationInFrames={durationInFrames}
                        fps={FPS}
                        compositionWidth={width}
                        compositionHeight={height}
                        style={{ width: '100%', height: '100%' }}
                        controls={false}
                        autoPlay={false}
                        loop={false}
                        doubleClickToFullscreen
                    />
                ) : (
                    <div className="text-zinc-700 flex flex-col items-center gap-2">
                        <MonitorPlay size={48} className="opacity-20" />
                        <span className="text-xs font-mono opacity-50">NO SIGNAL</span>
                    </div>
                )}
            </div>

            {/* Click to Play/Pause Overlay (Invisible) */}
            <div
                className="absolute inset-0 z-10"
                onClick={onPlayPause}
                onDoubleClick={onToggleExpand}
            />

            {/* Controls Overlay - Appears on Hover */}
            {showControls && (
                <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out translate-y-2 group-hover:translate-y-0">

                    <div className="flex flex-col gap-2">

                        {/* Scrubber */}
                        <input
                            type="range"
                            min={0}
                            max={previewState.totalDuration || 10}
                            step={0.05}
                            value={currentTime}
                            onChange={(e) => onSeek(parseFloat(e.target.value))}
                            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-indigo-400 transition-all"
                        />

                        {/* Bottom Row */}
                        <div className="flex items-center justify-between mt-1">

                            {/* Left: Playback Controls */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (currentTime >= previewState.totalDuration - 0.1) {
                                            onSeek(0);
                                            setTimeout(onPlayPause, 50);
                                        } else {
                                            onPlayPause();
                                        }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 active:scale-95 transition-all shadow-lg"
                                >
                                    {currentTime >= previewState.totalDuration - 0.1 ?
                                        <RotateCcw size={14} strokeWidth={2.5} /> :
                                        isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />
                                    }
                                </button>

                                <div className="flex items-baseline gap-1.5 font-mono text-xs font-medium text-zinc-400 select-none">
                                    <span className="text-white">{formatTime(currentTime)}</span>
                                    <span className="opacity-50">/</span>
                                    <span>{formatTime(previewState.totalDuration || 0)}</span>
                                </div>
                            </div>

                            {/* Right: Tools & Toggles */}
                            <div className="flex items-center gap-2">
                                {onSplit && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onSplit(); }}
                                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95"
                                        title="Split Clip (S)"
                                    >
                                        <Scissors size={16} />
                                    </button>
                                )}

                                {onToggleExpand && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95"
                                        title={isExpanded ? "Exit Fullscreen" : "Fullscreen"}
                                    >
                                        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};