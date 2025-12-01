import React, { useMemo } from 'react';
import { AbsoluteFill, Html5Video, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SubtitleItem } from '../types';
import { SUBTITLE_STYLES, type SubtitleStyleId } from './subtitle-styles';

export type SubtitleSettings = {
    x: number;     // 0-100%
    y: number;     // 0-100%
    scale: number; // Multiplier (e.g., 1.0)
};

export type SubtitleCompositionProps = {
    videoSrc: string;
    subtitles: SubtitleItem[];
    styleId?: SubtitleStyleId;
    settings?: SubtitleSettings;
};

export const SubtitleComposition: React.FC<SubtitleCompositionProps> = ({
    videoSrc,
    subtitles,
    styleId = 'modern',
    settings
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = frame / fps;

    // Default settings: centered horizontally, near bottom vertically
    const { x = 50, y = 80, scale = 1 } = settings || {};

    const currentSubtitle = useMemo(() => {
        return subtitles.find(sub => currentTime >= sub.start && currentTime < sub.end);
    }, [currentTime, subtitles]);

    // Get the component for the selected style, fallback to modern
    const StyleComponent = SUBTITLE_STYLES[styleId]?.component || SUBTITLE_STYLES.modern.component;

    return (
        <AbsoluteFill className="bg-black">
            {videoSrc && (
                <Html5Video
                    src={videoSrc}
                    className="w-full h-full object-cover"
                />
            )}

            <AbsoluteFill>
                {currentSubtitle && (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${x}%`,
                            top: `${y}%`,
                            transform: `translate(-50%, -50%) scale(${scale})`,
                            width: '100%',
                            textAlign: 'center',
                            pointerEvents: 'none', // Pass clicks through to the video/editor
                            paddingLeft: '2rem',
                            paddingRight: '2rem',
                        }}
                    >
                        <StyleComponent text={currentSubtitle.text} />
                    </div>
                )}
            </AbsoluteFill>
        </AbsoluteFill>
    );
};