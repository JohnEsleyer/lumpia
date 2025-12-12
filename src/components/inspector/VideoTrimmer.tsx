// FILE: src/components/inspector/VideoTrimmer.tsx
import React from 'react';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { VideoTimelineSlider } from './VideoTimelineSlider';

interface VideoTrimmerProps {
    sourceDuration: number;
    // Controlled props
    startOffset: number;
    endOffset: number;
    filmstrip?: string[];
    onPreviewChange: (start: number, end: number) => void;
    onCommit: (start: number, end: number) => void;
    onCancel: () => void;

    // New Props
    currentTimeSource: number; // For playhead display
    onSeekSource: (sourceTime: number) => void; // For background scrubbing
}

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
    sourceDuration,
    startOffset,
    endOffset,
    filmstrip,
    onPreviewChange,
    onCommit,
    onCancel,
    currentTimeSource,
    onSeekSource,
}) => {

    // Frame Nudge Logic (Assuming 30fps)
    const FRAME_TIME = 1 / 30;
    const minClipDuration = 0.1;

    // Use a single handler since we no longer have internal state
    const handleRangeChange = (newStart: number, newEnd: number) => {
        onPreviewChange(newStart, newEnd);
    };

    const nudge = (type: 'start' | 'end', dir: 1 | -1) => {
        if (type === 'start') {
            const newVal = Math.max(0, Math.min(startOffset + (dir * FRAME_TIME), endOffset - minClipDuration));
            onPreviewChange(newVal, endOffset);
        } else {
            const newVal = Math.min(sourceDuration, Math.max(endOffset + (dir * FRAME_TIME), startOffset + minClipDuration));
            onPreviewChange(startOffset, newVal);
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 100);
        return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col gap-4 bg-[#111] border border-yellow-500/30 p-4 rounded-xl animate-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Trim Mode Active</span>
                <span className="text-[10px] font-mono text-slate-500">Duration: {formatTime(endOffset - startOffset)}</span>
            </div>

            {/* The Slider */}
            <VideoTimelineSlider
                duration={sourceDuration}
                startOffset={startOffset}
                endOffset={endOffset}
                filmstrip={filmstrip}
                currentTimeSource={currentTimeSource}
                onRangeChange={handleRangeChange}
                onSeekSource={onSeekSource}
            />

            {/* Precision Controls */}
            <div className="flex justify-between items-center gap-4">
                {/* IN POINT */}
                <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-500">IN POINT</span>
                    <div className="flex items-center gap-1 bg-black rounded p-1 border border-white/10">
                        <button onClick={() => nudge('start', -1)} className="p-1 hover:bg-white/20 rounded"><ChevronLeft size={10} /></button>
                        <span className="text-[10px] font-mono text-yellow-400 min-w-[50px] text-center">{formatTime(startOffset)}</span>
                        <button onClick={() => nudge('start', 1)} className="p-1 hover:bg-white/20 rounded"><ChevronRight size={10} /></button>
                    </div>
                </div>

                {/* OUT POINT */}
                <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-500">OUT POINT</span>
                    <div className="flex items-center gap-1 bg-black rounded p-1 border border-white/10">
                        <button onClick={() => nudge('end', -1)} className="p-1 hover:bg-white/20 rounded"><ChevronLeft size={10} /></button>
                        <span className="text-[10px] font-mono text-yellow-400 min-w-[50px] text-center">{formatTime(endOffset)}</span>
                        <button onClick={() => nudge('end', 1)} className="p-1 hover:bg-white/20 rounded"><ChevronRight size={10} /></button>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mt-2">
                <Button variant="secondary" onClick={onCancel} className="h-8 text-xs border-slate-700">
                    <X size={12} className="mr-1" /> Cancel
                </Button>
                <Button onClick={() => onCommit(startOffset, endOffset)} className="h-8 text-xs bg-yellow-600 hover:bg-yellow-500 text-black border-none">
                    <Check size={12} className="mr-1" /> Apply Trim
                </Button>
            </div>
        </div>
    );
};