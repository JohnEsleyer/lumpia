// src/remotion/PreviewComposition.tsx
import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, Img, Audio } from 'remotion';
import type { PreviewClip } from '../hooks/usePreviewLogic';

export interface PreviewCompositionProps {
    clips: PreviewClip[];
    audioClips: PreviewClip[];
    fps: number;
}

export const PreviewComposition: React.FC<PreviewCompositionProps> = ({
    clips,
    audioClips,
    fps
}) => {
    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* Video / Image Layers */}
            {clips.map((clip) => {
                const durationInFrames = Math.max(1, Math.ceil(clip.timelineDuration * fps));
                const startFrame = Math.round(clip.timelineStart * fps);

                // Common style
                const style = { width: '100%', height: '100%', objectFit: 'contain' as const };

                return (
                    <Sequence
                        key={`clip-${clip.id}`}
                        from={startFrame}
                        durationInFrames={durationInFrames}
                    >
                        {clip.mediaType === 'image' ? (
                            <Img
                                src={clip.url}
                                style={style}
                            />
                        ) : (
                            <OffthreadVideo
                                src={clip.url}
                                trimBefore={Math.round((clip.start || 0) * fps)}
                                playbackRate={clip.playbackRate}
                                volume={clip.volume ?? 1.0}
                                style={style}
                                crossOrigin="anonymous"
                            />
                        )}
                    </Sequence>
                );
            })}

            {/* Audio Layers */}
            {audioClips.map((clip) => {
                const durationInFrames = Math.max(1, Math.ceil(clip.timelineDuration * fps));
                const startFrame = Math.round(clip.timelineStart * fps);

                return (
                    <Sequence
                        key={`audio-${clip.id}`}
                        from={startFrame}
                        durationInFrames={durationInFrames}
                    >
                        <Audio
                            src={clip.url}
                            startFrom={Math.round((clip.start || 0) * fps)}
                            volume={clip.volume ?? 1.0}
                            playbackRate={clip.playbackRate ?? 1.0}
                        />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};