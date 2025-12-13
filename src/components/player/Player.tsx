import React, { useRef } from 'react';
import { Play } from 'lucide-react';
import { PreviewMonitor } from '../inspector/PreviewMonitor';

// CHANGED: Import from useTimelinePreview instead of usePreviewLogic
import type { PreviewState } from '../../hooks/useTimelinePreview';

interface PlayerProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    previewState: PreviewState;
    isPlaying: boolean;
    currentTime: number;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onTimeUpdate: (time: number) => void;
    projectDimensions?: { width: number; height: number };
}

export const Player: React.FC<PlayerProps> = ({
    videoRef,
    previewState,
    isPlaying,
    currentTime,
    onPlayPause,
    onSeek,
    onTimeUpdate,
    projectDimensions
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="w-full h-full flex flex-col relative group bg-black" ref={containerRef}>
            {/* Main Viewport */}
            <div className="flex-1 relative bg-[#050505] flex items-center justify-center overflow-hidden">
                <PreviewMonitor
                    videoRef={videoRef}
                    previewState={previewState}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    onPlayPause={onPlayPause}
                    onSeek={onSeek}
                    onTimeUpdate={onTimeUpdate}
                    onSplit={() => { }}
                    viewMode="preview"
                    isExpanded={false}
                    projectDimensions={projectDimensions}
                    showControls={false} // Ensure monitor doesn't show its own controls
                />

                {/* Big Play Button Overlay (Optional visual cue when paused, click anywhere handles it) */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Play className="fill-white text-white ml-2" size={40} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};