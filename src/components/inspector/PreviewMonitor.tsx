import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Player, type PlayerRef, type CallbackListener } from '@remotion/player';
import { MonitorPlay, ChevronDown, ChevronUp, RotateCcw, Pause, Play, Scissors, Minimize2, Maximize2 } from 'lucide-react';
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
    trimRange,
}) => {
    const playerRef = useRef<PlayerRef>(null);
    const audioRef = useRef<HTMLAudioElement>(null); // Sidecar Audio Ref
    const [showControls, setShowControls] = useState(true);

    // Flags to manage sync loop
    const isPlayerDriving = useRef(false);
    const lastAudioSrc = useRef<string | null>(null);

    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onPlayPauseRef = useRef(onPlayPause);

    // Use passed dimensions or fallback to 1080p
    const width = projectDimensions?.width || 1920;
    const height = projectDimensions?.height || 1080;

    useEffect(() => {
        onTimeUpdateRef.current = onTimeUpdate;
        onPlayPauseRef.current = onPlayPause;
    }, [onTimeUpdate, onPlayPause]);


    // --- TRIM LOOPING LOGIC ---
    // If we are trimming, we want to auto-loop when we hit the end of the trim preview
    useEffect(() => {
        if (!trimRange) return;

        // If current time exceeds the trim duration (plus a tiny buffer)
        // Loop back to 0 (which is the start of the trimmed clip in the ghost state)
        if (isPlaying && currentTime >= trimRange.end - 0.05) {
            onSeek(0);
        }
    }, [currentTime, isPlaying, trimRange, onSeek]);


    const FPS = 30;
    const durationInFrames = Math.max(1, Math.ceil((previewState.totalDuration || 1) * FPS));

    // Memoized input props
    const inputProps = useMemo(() => ({
        clips: previewState.clips,
        audioClips: previewState.audioClips,
        fps: FPS
    }), [previewState.clips, previewState.audioClips, FPS]);

    // --- SIDECAR AUDIO SYNC LOGIC ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // 1. Find which audio clip should be playing at this currentTime
        // We look for a clip where: timelineStart <= currentTime < timelineEnd
        const activeAudioClip = previewState.audioClips.find(clip => {
            const end = clip.timelineStart + clip.timelineDuration;
            return currentTime >= clip.timelineStart && currentTime < end;
        });

        // 2. If valid clip found
        if (activeAudioClip) {
            // A. Handle Source Switching
            if (lastAudioSrc.current !== activeAudioClip.url) {
                audio.src = activeAudioClip.url;
                lastAudioSrc.current = activeAudioClip.url;
            }

            // B. Calculate where we are INSIDE the audio file
            // (Current Global Time - Clip Global Start) + Clip Trim Start
            const timeInFile = (currentTime - activeAudioClip.timelineStart) + activeAudioClip.start;

            // C. Apply Volume
            audio.volume = activeAudioClip.volume ?? 1.0;

            // D. Handle Seek / Drift
            // We only force the audio time if it's way off (> 0.2s) to allow natural playback 
            // without stuttering, OR if we just paused/scrubbed.
            if (Math.abs(audio.currentTime - timeInFile) > 0.25) {
                audio.currentTime = timeInFile;
            }

            // E. Play/Pause State
            if (isPlaying) {
                if (audio.paused) {
                    audio.play().catch(e => console.warn("Audio play failed", e));
                }
            } else {
                if (!audio.paused) audio.pause();
            }

        } else {
            // 3. No audio clip at this time
            if (!audio.paused) {
                audio.pause();
            }
            // Optional: reset src if you want silence to clear buffer
            // audio.removeAttribute('src'); 
        }

    }, [currentTime, isPlaying, previewState.audioClips]);

    // --- PLAYER SYNC LOGIC ---

    // 1. Play/Pause
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;
        if (isPlaying && !player.isPlaying()) player.play();
        else if (!isPlaying && player.isPlaying()) player.pause();
    }, [isPlaying]);

    // 2. Seeking (Scrubbing)
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        if (isPlayerDriving.current) {
            isPlayerDriving.current = false;
            return;
        }

        const playerFrame = player.getCurrentFrame();
        const targetFrame = Math.round(currentTime * FPS);

        // Looser threshold while playing to prevent fighting
        const threshold = isPlaying ? 5 : 0.5;

        if (Math.abs(playerFrame - targetFrame) > threshold) {
            player.seekTo(targetFrame);
        }
    }, [currentTime, FPS, isPlaying]);

    // 3. Time Update Listener
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

    return (
        <div className={`flex flex-col h-full bg-black select-none group relative ${isExpanded ? 'rounded-2xl overflow-hidden' : ''}`}>
            {/* Hidden Audio Element for Graph Preview */}
            <audio ref={audioRef} className="hidden" />

            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#050505]">
                {hasContent ? (
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
                    <div className="text-slate-600 flex flex-col items-center gap-2">
                        <MonitorPlay size={48} className="opacity-20" />
                        <span className="text-xs font-mono opacity-50">NO SIGNAL</span>
                    </div>
                )}
                {!showControls && (
                    <button onClick={() => setShowControls(true)} className="absolute bottom-3 right-3 z-50 bg-black/60 hover:bg-black/90 text-white/50 hover:text-white p-2 rounded-lg backdrop-blur-md border border-white/10 transition-all shadow-lg animate-in fade-in zoom-in duration-200"><ChevronUp size={16} /></button>
                )}
            </div>
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