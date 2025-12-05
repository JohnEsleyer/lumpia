import React, { useRef, useState, useEffect } from 'react';
import { Upload, Music, Play, Pause, Trash2, Volume2, RefreshCw, SkipBack } from 'lucide-react';
import { Button } from '../ui/Button';
import { addAsset } from '../../api';
import { AudioWaveformTrimmer } from './AudioWaveformTrimmer';

interface AudioInspectorProps {
    projectId: string;
    nodeId: string;
    data: any;
    onUpdateNode: (id: string, data: any) => void;
}

export const AudioInspector: React.FC<AudioInspectorProps> = ({
    projectId,
    nodeId,
    data,
    onUpdateNode
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const previewRef = useRef<number | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // Local state for the trimmer
    const [localStart, setLocalStart] = useState(data.startOffset || 0);
    const [localEnd, setLocalEnd] = useState(data.endOffset || data.duration || 10);
    const [currentTime, setCurrentTime] = useState(0);

    // Sync local state with global data when node selection changes
    useEffect(() => {
        setLocalStart(data.startOffset || 0);
        setLocalEnd(data.endOffset || data.duration || 10);
        setCurrentTime(data.startOffset || 0);
        setIsPlaying(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = data.startOffset || 0;
        }
    }, [nodeId, data.url]); // Removed offset deps to prevent reset while editing

    // Apply volume live
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = data.volume !== undefined ? data.volume : 1.0;
        }
    }, [data.volume]);

    // --- Preview Loop Logic ---
    const startPreviewLoop = () => {
        const loop = () => {
            if (!audioRef.current) return;

            // 1. Update Playhead
            setCurrentTime(audioRef.current.currentTime);

            // 2. Check Trimming Bounds
            if (audioRef.current.currentTime >= localEnd) {
                audioRef.current.pause();
                setIsPlaying(false);
                audioRef.current.currentTime = localStart;
                setCurrentTime(localStart);
                return;
            }

            // 3. Continue Loop
            if (!audioRef.current.paused) {
                previewRef.current = requestAnimationFrame(loop);
            }
        };
        previewRef.current = requestAnimationFrame(loop);
    };

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            if (previewRef.current) cancelAnimationFrame(previewRef.current);
        } else {
            // Check if we need to reset to start (if at end or before start)
            if (Math.abs(audioRef.current.currentTime - localEnd) < 0.1 || audioRef.current.currentTime < localStart) {
                audioRef.current.currentTime = localStart;
            }

            audioRef.current.play()
                .then(() => {
                    setIsPlaying(true);
                    startPreviewLoop();
                })
                .catch(e => console.error("Play failed", e));
        }
    };

    // Clean up loop on unmount
    useEffect(() => {
        return () => {
            if (previewRef.current) cancelAnimationFrame(previewRef.current);
        };
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const assets = await addAsset(projectId, file);
            const asset = assets.find(a => a.name === file.name.replace(/[^a-z0-9.]/gi, '_'));

            if (asset) {
                onUpdateNode(nodeId, {
                    label: asset.name,
                    url: `http://localhost:3001${asset.url}`,
                    duration: asset.duration || 0,
                    startOffset: 0,
                    endOffset: asset.duration || 10,
                    volume: 1.0
                });
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Failed to upload audio file");
        } finally {
            setIsUploading(false);
        }
    };

    const handleTrimChange = (newStart: number, newEnd: number) => {
        setLocalStart(newStart);
        setLocalEnd(newEnd);

        // If the playhead is outside the new range, snap it back
        if (currentTime < newStart || currentTime > newEnd) {
            setCurrentTime(newStart);
            if (audioRef.current) audioRef.current.currentTime = newStart;
        }
    };

    const handleTrimCommit = (newStart: number, newEnd: number) => {
        onUpdateNode(nodeId, { startOffset: newStart, endOffset: newEnd });
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 10);
        return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
    };

    // --- Empty State ---
    if (!data.url) {
        return (
            <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5">
                <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Music size={14} /> Audio Inspector
                    </h2>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-emerald-900/20 border-2 border-dashed border-emerald-500/30 rounded-full flex items-center justify-center mb-6">
                        <Music size={32} className="text-emerald-500 opacity-50" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-200 mb-2">No Audio File</h3>
                    <p className="text-sm text-slate-500 mb-8 max-w-[200px]">Upload an MP3 or WAV file to attach it.</p>
                    <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                    <Button onClick={() => fileInputRef.current?.click()} isLoading={isUploading} className="bg-emerald-600 hover:bg-emerald-500">
                        <Upload size={16} /> Upload Audio
                    </Button>
                </div>
            </div>
        );
    }

    // --- Editor State ---
    const totalDuration = data.duration || 10;
    const selectionDuration = localEnd - localStart;

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5 relative">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Music size={14} /> Audio Editor
                </h2>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 hover:bg-white/10 rounded-md text-slate-500 hover:text-white transition-colors"
                    title="Replace File"
                >
                    <RefreshCw size={12} />
                    <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                {/* File Info Card */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                        <Music size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-200 truncate" title={data.label}>{data.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex gap-3 mt-1">
                            <span>{formatTime(totalDuration)} Total</span>
                            <span className="text-emerald-500">{formatTime(selectionDuration)} Selected</span>
                        </div>
                    </div>
                </div>

                {/* Trimmer UI */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trim Range</label>
                        <div className="flex gap-2">
                            <div className="bg-black/30 border border-white/5 rounded px-2 py-1 text-[10px] font-mono text-slate-400">
                                IN: <span className="text-emerald-400">{formatTime(localStart)}</span>
                            </div>
                            <div className="bg-black/30 border border-white/5 rounded px-2 py-1 text-[10px] font-mono text-slate-400">
                                OUT: <span className="text-emerald-400">{formatTime(localEnd)}</span>
                            </div>
                        </div>
                    </div>

                    <AudioWaveformTrimmer
                        url={data.url}
                        duration={totalDuration}
                        startOffset={localStart}
                        endOffset={localEnd}
                        currentTime={currentTime}
                        onRangeChange={handleTrimChange}
                        onCommit={handleTrimCommit}
                    />

                    <div className="flex justify-center pt-2 gap-2">
                        <Button
                            variant="secondary"
                            className="h-8 text-xs gap-2 border-white/10 bg-white/5 hover:bg-white/10"
                            onClick={() => {
                                setCurrentTime(localStart);
                                if (audioRef.current) audioRef.current.currentTime = localStart;
                            }}
                        >
                            <SkipBack size={12} /> Reset to Start
                        </Button>
                        <Button
                            variant={isPlaying ? 'secondary' : 'primary'}
                            className={`h-8 px-6 text-xs gap-2 ${!isPlaying ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : ''}`}
                            onClick={togglePlay}
                        >
                            {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                            {isPlaying ? 'Pause' : 'Preview Selection'}
                        </Button>
                    </div>
                </div>

                {/* Other Controls */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                            <span className="flex items-center gap-1"><Volume2 size={10} /> Volume</span>
                            <span className="text-emerald-500">{Math.round((data.volume ?? 1) * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={data.volume !== undefined ? data.volume : 1.0}
                            onChange={(e) => onUpdateNode(nodeId, { volume: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                        />
                    </div>

                    <Button
                        variant="danger"
                        className="w-full h-8 text-xs bg-red-500/5 border-red-500/20 hover:bg-red-500/10 text-red-500 justify-center mt-4"
                        onClick={() => onUpdateNode(nodeId, { url: '', label: 'Empty Audio', duration: 10, startOffset: 0, endOffset: 10 })}
                    >
                        <Trash2 size={12} className="mr-2" /> Remove Track
                    </Button>
                </div>
            </div>

            {/* Hidden Audio Element for Preview */}
            <audio ref={audioRef} src={data.url} />
        </div>
    );
};