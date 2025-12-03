import React, { useRef, useState, useEffect } from 'react';
import { Upload, Music, Play, Pause, Trash2, Volume2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { addAsset } from '../../api';

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
    const [isUploading, setIsUploading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Reset state when node changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.load();
        }
    }, [data.url]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Upload to server
            const assets = await addAsset(projectId, file);

            // Find the asset we just uploaded (simplistic match by name for now, or take the last one)
            // ideally backend returns the specific asset added, but we get the list.
            const asset = assets.find(a => a.name === file.name.replace(/[^a-z0-9.]/gi, '_'));

            if (asset) {
                onUpdateNode(nodeId, {
                    label: asset.name,
                    url: `http://localhost:3001${asset.url}`,
                    duration: asset.duration || 0,
                    startOffset: 0,
                    endOffset: asset.duration || 10
                });
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Failed to upload audio file");
        } finally {
            setIsUploading(false);
        }
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };

    const handleMetadata = () => {
        if (audioRef.current) setDuration(audioRef.current.duration);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // --- Empty State (Upload) ---
    if (!data.url) {
        return (
            <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5">
                <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Music size={14} /> Audio Inspector
                    </h2>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-emerald-900/20 border-2 border-dashed border-emerald-500/30 rounded-full flex items-center justify-center mb-6 group hover:scale-105 transition-transform">
                        <Music size={32} className="text-emerald-500 opacity-50" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-200 mb-2">No Audio File</h3>
                    <p className="text-sm text-slate-500 mb-8 max-w-[200px]">
                        Upload an MP3 or WAV file to attach it to this node.
                    </p>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleFileUpload}
                    />

                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        isLoading={isUploading}
                        className="bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
                    >
                        <Upload size={16} /> Upload Audio
                    </Button>
                </div>
            </div>
        );
    }

    // --- Loaded State (Player) ---
    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5 relative">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Music size={14} /> Audio Properties
                </h2>
            </div>

            {/* Visualizer Area */}
            <div className="flex-1 bg-black/40 relative flex items-center justify-center overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'radial-gradient(#059669 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />

                {/* Pulse Circle */}
                <div className={`w-40 h-40 rounded-full bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center relative ${isPlaying ? 'animate-pulse' : ''}`}>
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                        <Music size={32} className="text-emerald-500" />
                    </div>
                    {/* Fake visualizer bars */}
                    {isPlaying && (
                        <div className="absolute inset-0 flex items-end justify-center gap-1 pb-10 opacity-50">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="w-1 bg-emerald-500 animate-[bounce_1s_infinite]" style={{ height: Math.random() * 40 + 10, animationDelay: `${i * 0.1}s` }} />
                            ))}
                        </div>
                    )}
                </div>

                <audio
                    ref={audioRef}
                    src={data.url}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleMetadata}
                    onEnded={() => setIsPlaying(false)}
                />
            </div>

            {/* Controls */}
            <div className="p-6 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 space-y-6 z-20">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="font-bold text-slate-200 truncate pr-4">{data.label}</h3>
                        <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">MP3</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>

                    {/* Scrubber */}
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 mt-2"
                    />
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="flex justify-start">
                        <Button
                            variant="danger"
                            className="p-2 h-8 w-8 rounded-full flex items-center justify-center border-white/5 bg-transparent hover:bg-white/5"
                            title="Remove Audio"
                            onClick={() => onUpdateNode(nodeId, { url: '', label: 'Empty Audio', duration: 10 })}
                        >
                            <Trash2 size={14} />
                        </Button>
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={togglePlay}
                            className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                        >
                            {isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-1" />}
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            variant="secondary"
                            className="p-2 h-8 w-8 rounded-full flex items-center justify-center border-white/5 bg-transparent hover:bg-white/5"
                            title="Replace File"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            <RefreshCw size={14} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};