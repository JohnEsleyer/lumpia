import React from 'react';
import { AbsoluteFill, Sequence, Html5Video, Img } from 'remotion';
// Import the new Audio component (assuming `@remotion/media` is installed)
import { Audio } from '@remotion/media';
import type { PreviewVisual, AudioSource } from '../hooks/useTimelinePreview';

export interface PreviewCompositionProps {
    visuals: PreviewVisual[];
    audioSources: AudioSource[]; // Used ONLY during export/render
    fps: number;
    isRendering?: boolean; // Flag to enable audio for export
}

export const PreviewComposition: React.FC<PreviewCompositionProps> = ({
    visuals,
    audioSources,
    fps,
    isRendering = false
}) => {
    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>

            {/* 1. VISUALS (Video & Images) */}
            {visuals.map((clip) => {
                const durationInFrames = Math.max(1, Math.ceil(clip.timelineDuration * fps));
                const fromFrame = Math.round(clip.timelineStart * fps);
                const startFromFrame = Math.round(clip.sourceStartOffset * fps);

                return (
                    <Sequence
                        key={`vis-${clip.id}`}
                        from={fromFrame}
                        durationInFrames={durationInFrames}
                        style={{ zIndex: clip.zIndex }}
                    >
                        {clip.mediaType === 'image' ? (
                            <Img
                                src={clip.url}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        ) : (
                            <Html5Video
                                src={clip.url}
                                // NOTE: Html5Video uses `startFrom` (or `trimBefore` in modern versions).
                                // Keeping `startFrom` here for backwards compatibility with Remotion's Html5Video.
                                startFrom={startFromFrame}
                                playbackRate={clip.playbackRate}
                                muted={!isRendering}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                crossOrigin="anonymous"
                            />
                        )}
                    </Sequence>
                );
            })}

            {/* 2. AUDIO (Render Only) */}
            {isRendering && audioSources.map((clip) => {
                if (clip.isMuted) return null;

                const durationInFrames = Math.max(1, Math.ceil((clip.timelineEnd - clip.timelineStart) * fps));
                const fromFrame = Math.round(clip.timelineStart * fps);
                // Map old `startFrom` concept to new `trimBefore` prop (in frames)
                const trimBeforeFrames = Math.round(clip.sourceStartOffset * fps);

                return (
                    <Sequence
                        key={`aud-${clip.id}`}
                        from={fromFrame}
                        durationInFrames={durationInFrames}
                    >
                        {/* Using the new Audio component from @remotion/media */}
                        <Audio
                            src={clip.url}
                            trimBefore={trimBeforeFrames} // Use trimBefore for source offset
                            volume={clip.volume}
                            playbackRate={clip.playbackRate}
                        />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};