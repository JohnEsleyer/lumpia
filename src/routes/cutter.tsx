
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef, useMemo } from 'react';
import { RangeSlider } from '../components/RangeSlider';
import { Button } from '../components/ui/Button';
import { Filmstrip } from '../components/Filmstrip';
import { getProject, saveProjectOperation } from '../api';
import type { Project } from '../types';

export const Route = createFileRoute('/cutter')({
    component: CutterApp,
    validateSearch: (search: Record<string, unknown>): { projectId?: string } => {
        return { projectId: search.projectId as string | undefined };
    },
});

// Helper: 00:00.00 format
const formatTimeCode = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')} `;
};

function CutterApp() {
    const { projectId } = Route.useSearch();
    const navigate = useNavigate();

    // Data State
    const [project, setProject] = useState<Project | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Video State
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [range, setRange] = useState<[number, number]>([0, 0]);
    const [isDragging, setIsDragging] = useState(false);

    // Load Project
    useEffect(() => {
        if (projectId) {
            getProject(projectId).then(setProject).catch(console.error);
        }
    }, [projectId]);

    const videoUrl = useMemo(() => {
        if (!project?.currentHead) return '';
        return `http://localhost:3001${project.currentHead}`;
    }, [project?.currentHead]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, range]);

    // Video Event Handlers
    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const dur = videoRef.current.duration;
            setDuration(dur);
            setRange([0, dur]);
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const curr = videoRef.current.currentTime;
        setCurrentTime(curr);

        if (!isDragging && range[1] > 0 && curr >= range[1]) {
            videoRef.current.currentTime = range[0];
            if (!isPlaying) videoRef.current.pause();
        }
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            if (videoRef.current.currentTime >= range[1] - 0.1) {
                videoRef.current.currentTime = range[0];
            }
            videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleRangeChange = (newRange: [number, number]) => {
        setRange(newRange);
        if (!videoRef.current) return;

        const [oldStart, oldEnd] = range;
        const [newStart, newEnd] = newRange;

        if (Math.abs(newStart - oldStart) > 0.01) {
            videoRef.current.currentTime = newStart;
            videoRef.current.pause();
            setIsPlaying(false);
        } else if (Math.abs(newEnd - oldEnd) > 0.01) {
            videoRef.current.currentTime = newEnd;
            videoRef.current.pause();
            setIsPlaying(false);
        }
        setIsDragging(true);
        setTimeout(() => setIsDragging(false), 200);
    };

    const handleSave = async () => {
        if (!project) return;
        setIsSaving(true);
        try {
            await saveProjectOperation(project.id, {
                type: 'trim',
                params: {
                    start: range[0],
                    end: range[1],
                },
                id: crypto.randomUUID(),
            });
            navigate({
                to: '/project/$projectId',
                params: { projectId: project.id },
            });
        } catch (e) {
            console.error(e);
            alert('Failed to save cut');
        } finally {
            setIsSaving(false);
        }
    };

    if (!projectId || !project) return (
        <div className="flex h-full w-full items-center justify-center text-slate-500 bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-sm font-medium">Loading Studio...</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full w-full bg-slate-950 text-white overflow-hidden">
            {/* --- Top Bar --- */}
            <div className="h-16 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-6">
                    <Button
                        variant="secondary"
                        onClick={() => navigate({ to: '/project/$projectId', params: { projectId: project.id } })}
                        className="text-xs h-9 px-4 rounded-full bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300"
                    >
                        ← Back
                    </Button>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold text-slate-100 tracking-wide">{project.name}</h1>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span className="bg-white/5 px-1.5 py-0.5 rounded">{project.width}x{project.height}</span>
                            <span className="bg-white/5 px-1.5 py-0.5 rounded">{project.fps}fps</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">New Duration</div>
                        <div className="font-mono text-blue-400 font-bold text-lg leading-none shadow-blue-500/20 drop-shadow-sm">
                            {formatTimeCode(Math.max(0, range[1] - range[0]))}
                        </div>
                    </div>
                    <Button
                        onClick={handleSave}
                        isLoading={isSaving}
                        disabled={isSaving}
                        className="h-9 px-6 text-sm bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40 rounded-full"
                    >
                        {isSaving ? 'Processing...' : 'Save Cut'}
                    </Button>
                </div>
            </div>

            {/* --- Main Workspace --- */}
            <div className="flex-1 flex flex-col min-h-0 relative group/workspace">

                {/* Video Container */}
                <div className="flex-1 bg-black/40 relative flex items-center justify-center overflow-hidden w-full p-8">
                    {/* Grid Background Pattern */}
                    <div className="absolute inset-0 opacity-20"
                        style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                    />

                    <div className="relative w-full h-full flex items-center justify-center shadow-2xl shadow-black/50">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
                            crossOrigin="anonymous"
                            onLoadedMetadata={handleLoadedMetadata}
                            onTimeUpdate={handleTimeUpdate}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onClick={togglePlay}
                        />

                        {/* Big Play Button Overlay */}
                        {!isPlaying && (
                            <div
                                className="absolute inset-0 flex items-center justify-center bg-black/10 cursor-pointer group-hover/workspace:bg-black/20 transition-colors"
                                onClick={togglePlay}
                            >
                                <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl hover:scale-110 hover:bg-white/20 transition-all duration-300 group/play">
                                    <div className="w-0 h-0 border-t-[16px] border-t-transparent border-l-[32px] border-l-white border-b-[16px] border-b-transparent ml-3 drop-shadow-lg" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Bottom Timeline --- */}
                <div className="bg-slate-900/80 backdrop-blur-xl border-t border-white/10 shrink-0 flex flex-col z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">

                    {/* Toolbar / Timecodes */}
                    <div className="flex justify-between items-center px-8 py-3 border-b border-white/5">
                        <button
                            onClick={togglePlay}
                            className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all hover:scale-105 active:scale-95"
                        >
                            {isPlaying ? (
                                <div className="flex gap-1">
                                    <span className="block w-1.5 h-4 bg-slate-200 rounded-full" />
                                    <span className="block w-1.5 h-4 bg-slate-200 rounded-full" />
                                </div>
                            ) : (
                                <span className="block w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-slate-200 border-b-[8px] border-b-transparent ml-1" />
                            )}
                        </button>

                        <div className="flex gap-12 font-mono text-sm bg-black/20 px-8 py-2 rounded-full border border-white/5">
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">In Point</span>
                                <span className="text-slate-400 font-medium">{formatTimeCode(range[0])}</span>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Current</span>
                                <span className={`font-bold text-lg leading-none ${isPlaying ? 'text-blue-400' : 'text-white'}`}>
                                    {formatTimeCode(currentTime)}
                                </span>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Out Point</span>
                                <span className="text-slate-400 font-medium">{formatTimeCode(range[1])}</span>
                            </div>
                        </div>

                        <div className="w-12" /> {/* Spacer */}
                    </div>

                    {/* Slider Container */}
                    <div className="px-8 py-6 pb-10">
                        <div className="relative h-20 w-full group select-none">

                            {/* Background Track */}
                            <div className="absolute inset-0 rounded-xl bg-slate-950 border border-white/10 overflow-hidden shadow-inner">
                                {duration > 0 && (
                                    <Filmstrip fileUrl={videoUrl} duration={duration} height={80} />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none" />
                            </div>

                            {/* Playhead Cursor */}
                            {duration > 0 && (
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white z-30 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                                    style={{ left: `${(currentTime / duration) * 100}%` }}
                                >
                                    <div className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-white rotate-45 shadow-sm" />
                                    <div className="absolute top-0 bottom-0 w-full bg-gradient-to-b from-white to-transparent opacity-50" />
                                </div>
                            )}

                            {/* Interactive Range Slider */}
                            <div className="absolute inset-0 -mx-3 h-full flex items-center z-20">
                                <RangeSlider
                                    min={0}
                                    max={duration || 100}
                                    step={0.01}
                                    value={range}
                                    onChange={handleRangeChange}
                                    formatLabel={() => ''}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}