import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, Html5Audio } from 'remotion';
import type { PreviewClip } from '../hooks/usePreviewLogic';

export interface PreviewCompositionProps {
    clips: PreviewClip[];
    audioClips: PreviewClip[];
    mix: { videoGain: number; audioGain: number };
    fps: number;
}

export const PreviewComposition: React.FC<PreviewCompositionProps> = ({
    clips,
    audioClips,
    mix,
    fps
}) => {
    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* --- VIDEO TRACKS --- */}
            {clips.map((clip) => {
                const durationInFrames = Math.ceil(clip.timelineDuration * fps);
                if (durationInFrames <= 0) return null;

                // Calculate trims in frames
                const trimBeforeFrames = Math.round(clip.start * fps);

                return (
                    <Sequence
                        key={`vid-${clip.id}`}
                        from={Math.round(clip.timelineStart * fps)}
                        durationInFrames={durationInFrames}
                    >
                        <OffthreadVideo
                            src={clip.url}
                            // Using trimBefore to handle the IN point of the source file
                            trimBefore={trimBeforeFrames}
                            playbackRate={clip.playbackRate}
                            volume={(clip.volume ?? 1.0) * (mix.videoGain ?? 1.0)}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                            }}
                            // Ensure standard cross-origin handling for OffthreadVideo
                            crossOrigin="anonymous"
                        />
                    </Sequence>
                );
            })}

            {/* --- AUDIO TRACKS --- */}
            {audioClips.map((clip) => {
                const durationInFrames = Math.ceil(clip.timelineDuration * fps);
                if (durationInFrames <= 0) return null;

                const trimBeforeFrames = Math.round(clip.start * fps);

                return (
                    <Sequence
                        key={`aud-${clip.id}`}
                        from={Math.round(clip.timelineStart * fps)}
                        durationInFrames={durationInFrames}
                    >
                        <Html5Audio
                            src={clip.url}
                            trimBefore={trimBeforeFrames}
                            volume={(clip.volume ?? 1.0) * (mix.audioGain ?? 1.0)}
                            playbackRate={clip.playbackRate}
                            crossOrigin="anonymous"
                        />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};