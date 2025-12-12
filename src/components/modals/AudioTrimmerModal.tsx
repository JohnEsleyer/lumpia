import React, { useRef, useState, useEffect } from 'react';
import { X, Play, Pause, Scissors } from 'lucide-react';
import { Button } from '../ui/Button';

interface AudioTrimmerModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: { name: string; url: string; duration?: number } | null;
    onAddToTimeline: (startOffset: number, duration: number) => void;
}

export const AudioTrimmerModal: React.FC<AudioTrimmerModalProps> = ({
    isOpen,
    onClose,
    asset,
    onAddToTimeline
}) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [starTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(10); // Default 10s if no duration

    useEffect(() => {
        if (asset && asset.duration) {
            setEndTime(asset.duration);
        } else {
            setEndTime(10);
        }
        setStartTime(0);
    }, [asset]);

    useEffect(() => {
        if (isOpen && audioRef.current) {
            audioRef.current.currentTime = starTime;
            setCurrentTime(starTime);
        }
    }, [isOpen, starTime]);

    if (!isOpen || !asset) return null;

    const handlePlayPause = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            // If at end of selection, restart
            if (audioRef.current.currentTime >= endTime) {
                audioRef.current.currentTime = starTime;
            }
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        setCurrentTime(audioRef.current.currentTime);
        // Loop in selection
        if (audioRef.current.currentTime >= endTime) {
            audioRef.current.pause();
            audioRef.current.currentTime = starTime;
            setIsPlaying(false);
        }
    };

    const handleAdd = () => {
        const duration = endTime - starTime;
        if (duration > 0) {
            onAddToTimeline(starTime, duration);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-[500px] shadow-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
                    <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <Scissors size={16} /> Trim Audio: {asset.name}
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    {/* Audio Preview Area */}
                    <div className="flex flex-col items-center justify-center gap-4 py-4 bg-zinc-950/30 rounded-lg border border-zinc-800/50">
                        <button
                            onClick={handlePlayPause}
                            className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-900/20"
                        >
                            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                        </button>
                        <div className="text-2xl font-mono text-zinc-300">
                            {currentTime.toFixed(2)}s
                        </div>
                    </div>

                    <audio
                        ref={audioRef}
                        src={`http://localhost:3001${asset.url}`}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => setIsPlaying(false)}
                    />

                    {/* Controls */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                            <span>Start: {starTime.toFixed(2)}s</span>
                            <span>End: {endTime.toFixed(2)}s</span>
                            <span className="text-indigo-400">Dur: {(endTime - starTime).toFixed(2)}s</span>
                        </div>

                        {/* Simple range inputs for now (Dual slider is complex to implement from scratch without lib) */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs w-8 text-zinc-400">In</span>
                                <input
                                    type="range"
                                    min="0"
                                    max={asset.duration || 10}
                                    step="0.1"
                                    value={starTime}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        if (v < endTime) {
                                            setStartTime(v);
                                            // Seek to start for preview
                                            if (audioRef.current) audioRef.current.currentTime = v;
                                        }
                                    }}
                                    className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs w-8 text-zinc-400">Out</span>
                                <input
                                    type="range"
                                    min="0"
                                    max={asset.duration || 10}
                                    step="0.1"
                                    value={endTime}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        if (v > starTime) setEndTime(v);
                                    }}
                                    className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white border-0">
                        Add to Timeline
                    </Button>
                </div>
            </div>
        </div>
    );
};
