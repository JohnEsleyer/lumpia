import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo } from 'remotion';
import type { PreviewClip } from '../hooks/usePreviewLogic';

export interface PreviewCompositionProps {
    clips: PreviewClip[];
    // We keep audioClips in the interface to avoid type errors, 
    // but we won't render them here anymore.
    audioClips: PreviewClip[];
    fps: number;
}

export const PreviewComposition: React.FC<PreviewCompositionProps> = ({
    clips,
    fps
}) => {
    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* --- VIDEO TRACKS ONLY --- */}
            {clips.map((clip) => {
                const durationInFrames = Math.max(1, Math.ceil(clip.timelineDuration * fps));
                const startFrame = Math.round(clip.timelineStart * fps);
                const trimBeforeFrames = Math.round(clip.start * fps);

                return (
                    <Sequence
                        key={`vid-${clip.id}`}
                        from={startFrame}
                        durationInFrames={durationInFrames}
                    >
                        <OffthreadVideo
                            src={clip.url}
                            trimBefore={trimBeforeFrames}
                            playbackRate={clip.playbackRate}
                            volume={clip.volume ?? 1.0}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                            }}
                            crossOrigin="anonymous"
                        />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};