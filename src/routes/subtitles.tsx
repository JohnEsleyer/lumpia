import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { Button } from '../components/ui/Button';
import { getProject, saveProjectOperation } from '../api';
import type { Project, SubtitleItem } from '../types';
import { useVideoMeta } from '../hooks/useVideoMeta';
import { SubtitleComposition, type SubtitleSettings } from '../components/SubtitleComposition';
import { SUBTITLE_STYLES, type SubtitleStyleId } from '../components/subtitle-styles';

export const Route = createFileRoute('/subtitles')({
  component: SubtitlesApp,
  validateSearch: (search: Record<string, unknown>): { projectId?: string } => {
    return { projectId: search.projectId as string | undefined };
  },
});

// --- Icons ---
const PlayIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
);
const FullscreenIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
);
const SettingsIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);

// --- Helper: Timecode ---
const formatTimecode = (frame: number, fps: number) => {
  if (!fps) return "00:00";
  const totalSeconds = frame / fps;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

function SubtitlesApp() {
  const { projectId } = Route.useSearch();
  const navigate = useNavigate();

  // Data State
  const [project, setProject] = useState<Project | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [currentStyle, setCurrentStyle] = useState<SubtitleStyleId>('modern');
  const [settings, setSettings] = useState<SubtitleSettings>({ x: 50, y: 80, scale: 1 });

  // Processing State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Player State
  // We use a state to hold the player ref to ensure effects run when it's ready
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationInFrames, setDurationInFrames] = useState(300);
  const [showControls, setShowControls] = useState(true);
  const [hoverFrame, setHoverFrame] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Meta
  const { getMeta } = useVideoMeta();

  useEffect(() => {
    if (projectId) {
      getProject(projectId).then(setProject).catch(console.error);
    }
  }, [projectId]);

  const videoSrc = project?.currentHead ? `http://localhost:3001${project.currentHead}` : '';

  useEffect(() => {
    if (videoSrc) {
      getMeta(videoSrc).then(meta => {
        if (meta) setDurationInFrames(Math.floor(meta.durationInSeconds * (project?.fps || 30)));
      });
    }
  }, [videoSrc, project?.fps]);

  // --- Robust Event Listener Attachment ---
  useEffect(() => {
    if (!player) return;

    const onFrame = (e: any) => {
      // Remotion fires 'frameupdate' with detail containing frame
      setCurrentFrame(Math.round(e.detail.frame));
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onSeeked = (e: any) => setCurrentFrame(Math.round(e.detail.frame));

    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('seeked', onSeeked);

    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('seeked', onSeeked);
    };
  }, [player]);

  const inputProps = useMemo(() => ({
    videoSrc,
    subtitles,
    styleId: currentStyle,
    settings
  }), [videoSrc, subtitles, currentStyle, settings]);

  // Dynamic Controls Visibility
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 2000);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) setShowControls(false);
  };

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    }
  }, [isPlaying]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, player]);

  const togglePlay = useCallback(() => {
    if (!player) return;
    if (isPlaying) player.pause();
    else player.play();
  }, [isPlaying, player]);

  const handleSeek = (frame: number) => {
    if (player) {
      player.seekTo(frame);
      setCurrentFrame(frame);
    }
  };

  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    setHoverFrame(Math.floor(percent * durationInFrames));
    setHoverX(x);
  };

  const handleTranscribe = async () => {
    if (!projectId) return;
    setIsTranscribing(true);
    try {
      const res = await fetch(`http://localhost:3001/api/projects/${projectId}/transcribe`, { method: 'POST' });
      const data = await res.json();
      if (data.subtitles) setSubtitles(data.subtitles);
    } catch (e) {
      console.error(e);
      alert("Transcription failed. Is whisper.cpp configured?");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleUpdateSubtitle = (id: string, text: string) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const handleSave = async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      await saveProjectOperation(project.id, {
        type: 'subtitle',
        params: { subtitles, styleId: currentStyle, settings },
        id: crypto.randomUUID()
      });
      navigate({ to: '/project/$projectId', params: { projectId: project.id } });
    } catch (e) {
      console.error(e);
      alert('Failed to save subtitles');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: keyof SubtitleSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) containerRef.current.requestFullscreen();
      else document.exitFullscreen();
    }
  };

  if (!project) return (
    <div className="flex items-center justify-center h-full bg-slate-950 text-slate-500">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-sm font-medium">Loading Studio...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col lg:flex-row bg-slate-950 text-white overflow-hidden selection:bg-blue-500/30 font-sans">

      {/* --- Left: Dynamic Player Area --- */}
      <div
        ref={containerRef}
        className="flex-[2] flex flex-col min-w-0 bg-black relative group/player overflow-hidden border-r border-white/5 shadow-2xl"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Top Header Fade */}
        <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-20 pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="p-6 pointer-events-auto flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate({ to: '/project/$projectId', params: { projectId: project.id } })} className="text-xs h-8 px-3 rounded-full bg-white/10 border-white/10 hover:bg-white/20 hover:border-white/30 backdrop-blur-md transition-all">
              ← Back
            </Button>
            <div className="h-4 w-px bg-white/20"></div>
            <h1 className="text-sm font-bold text-white/90 drop-shadow-md tracking-wide">Subtitle Studio</h1>
          </div>
        </div>

        {/* Video Surface */}
        <div className="w-full h-full flex items-center justify-center relative bg-[#050505]">
          {/* Click to Toggle Layer */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={togglePlay}
            title={isPlaying ? "Click to Pause" : "Click to Play"}
          ></div>

          <Player
            ref={setPlayer} // Use callback ref to capture instance immediately
            component={SubtitleComposition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            compositionWidth={project.width}
            compositionHeight={project.height}
            fps={project.fps}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            controls={false}
            doubleClickToFullscreen
            autoPlay={false} // Handle autoplay manually if needed
          />
        </div>

        {/* Big Center Play Button - Disappears when playing */}
        {!isPlaying && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none animate-in fade-in zoom-in duration-200">
            <div className="w-24 h-24 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] group-hover/player:scale-105 transition-transform duration-300">
              <div className="ml-2 text-white drop-shadow-lg"><PlayIcon className="w-10 h-10" /></div>
            </div>
          </div>
        )}

        {/* Bottom Control Bar - Floating Glassmorphism */}
        <div className={`absolute bottom-6 left-6 right-6 z-30 transition-all duration-500 ease-out ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl ring-1 ring-black/50">

            {/* Scrubber Container */}
            <div
              className="relative h-5 w-full group/scrubber cursor-pointer flex items-center"
              onMouseMove={handleScrubberMouseMove}
              onMouseLeave={() => setHoverFrame(null)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                handleSeek(Math.floor(percent * durationInFrames));
              }}
            >
              {/* Hover Tooltip */}
              {hoverFrame !== null && (
                <div
                  className="absolute bottom-full mb-2 -translate-x-1/2 bg-black text-white text-[10px] font-mono font-bold px-2 py-1 rounded border border-white/20 shadow-lg pointer-events-none z-40 whitespace-nowrap"
                  style={{ left: hoverX }}
                >
                  {formatTimecode(hoverFrame, project.fps)}
                </div>
              )}

              {/* Track Background */}
              <div className="absolute inset-0 h-1 bg-white/10 rounded-full group-hover/scrubber:bg-white/20 transition-colors my-auto"></div>

              {/* Progress Fill */}
              <div
                className="absolute left-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-75 ease-linear my-auto"
                style={{ width: `${(currentFrame / durationInFrames) * 100}%` }}
              >
                {/* Scrubber Knob */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-0 group-hover/scrubber:scale-100 transition-transform duration-200"></div>
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between mt-1 select-none">
              <div className="flex items-center gap-5">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                  className="text-white hover:text-blue-400 transition-colors hover:scale-110 active:scale-95 outline-none p-1"
                >
                  {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </button>

                <div className="font-mono text-xs font-medium tracking-wide flex items-center gap-1.5 tabular-nums">
                  <span className="text-white">{formatTimecode(currentFrame, project.fps)}</span>
                  <span className="text-white/30">/</span>
                  <span className="text-white/50">{formatTimecode(durationInFrames, project.fps)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-black/30 rounded border border-white/5">
                  <SettingsIcon className="w-3 h-3 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-400">{project.fps} FPS</span>
                </div>
                <div className="h-4 w-px bg-white/10 mx-1"></div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                  className="text-white/70 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg active:scale-95"
                >
                  <FullscreenIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Right: Editor Sidebar --- */}
      <div className="flex-1 bg-slate-950 flex flex-col min-w-[350px] max-w-md border-l border-white/5 z-20 shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/5 to-transparent pointer-events-none" />

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {/* Top Config Section */}
          <div className="p-6 border-b border-white/5 bg-slate-900/40 backdrop-blur-sm sticky top-0 z-10">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Visual Style</h2>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(SUBTITLE_STYLES).map(([id, config]) => (
                  <button
                    key={id}
                    onClick={() => setCurrentStyle(id as SubtitleStyleId)}
                    className={`
                                    aspect-square rounded-xl border transition-all flex flex-col items-center justify-center gap-1 group relative overflow-hidden outline-none
                                    ${currentStyle === id
                        ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105 z-10'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800'
                      }
                                `}
                    title={config.label}
                  >
                    <span className={`text-xl font-black z-10 transition-colors ${currentStyle === id ? 'text-white' : 'text-slate-600 group-hover:text-slate-400'}`}>
                      {config.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 bg-slate-900/60 rounded-xl p-4 border border-white/5">
              {[
                { label: 'Scale', key: 'scale', min: 0.5, max: 3, step: 0.1, val: settings.scale.toFixed(1) + 'x' },
                { label: 'Position Y', key: 'y', min: 0, max: 100, step: 1, val: settings.y + '%' },
              ].map((control) => (
                <div key={control.key} className="space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                    <span>{control.label}</span>
                    <span className="text-white bg-white/10 px-1.5 rounded">{control.val}</span>
                  </div>
                  <input
                    type="range"
                    min={control.min} max={control.max} step={control.step}
                    value={settings[control.key as keyof SubtitleSettings]}
                    onChange={(e) => updateSetting(control.key as keyof SubtitleSettings, parseFloat(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer hover:bg-slate-700 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Transcript List Section */}
          <div className="flex-1 p-4 pb-20">
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Transcript</h2>
              <span className="text-[10px] font-mono text-slate-600 bg-slate-900 px-2 py-1 rounded-full border border-slate-800">{subtitles.length} lines</span>
            </div>

            {subtitles.length === 0 ? (
              <div className="text-center py-12 px-6 rounded-2xl border-2 border-dashed border-slate-800/50 bg-slate-900/20">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </div>
                <h3 className="text-white font-bold mb-2">No captions yet</h3>
                <p className="text-slate-500 text-xs mb-6 max-w-[200px] mx-auto">Generate captions automatically using our Whisper AI model or type them manually.</p>
                <Button
                  onClick={handleTranscribe}
                  isLoading={isTranscribing}
                  className="bg-indigo-600 hover:bg-indigo-500 w-full shadow-lg shadow-indigo-900/20"
                >
                  {isTranscribing ? 'Processing...' : 'Auto-Generate Captions'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {subtitles.map((sub, idx) => (
                  <div key={sub.id} className="group relative bg-slate-900/40 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/30 rounded-xl p-3 transition-all duration-200 shadow-sm">
                    <div
                      className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-2 cursor-pointer select-none"
                      onClick={() => handleSeek(sub.start * project.fps)}
                    >
                      <div className="flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-500/10">#{idx + 1}</span>
                        <span>{formatTimecode(sub.start * project.fps, project.fps)}</span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold">JUMP</div>
                    </div>
                    <textarea
                      value={sub.text}
                      onChange={(e) => handleUpdateSubtitle(sub.id, e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-300 focus:text-white focus:bg-white/5 rounded-lg p-2 -ml-2 outline-none resize-none leading-relaxed placeholder:text-slate-700 transition-all border border-transparent focus:border-white/10"
                      placeholder="Type subtitle here..."
                      rows={Math.max(2, Math.ceil(sub.text.length / 32))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        {subtitles.length > 0 && (
          <div className="p-4 border-t border-white/5 bg-slate-900/80 backdrop-blur-lg absolute bottom-0 left-0 right-0 z-20">
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setSubtitles([])} variant="secondary" className="h-10 text-xs border-slate-700 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50">
                Clear All
              </Button>
              <Button onClick={handleSave} isLoading={isSaving} className="h-10 text-xs bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20">
                Burn & Export
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}