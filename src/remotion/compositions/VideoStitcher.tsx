import React from 'react';
import { Series, Html5Video, AbsoluteFill } from 'remotion'; // Changed OffthreadVideo to Html5Video

export type StitcherClip = {
    id: string;
    url: string;
    durationInFrames: number;
};

export type StitcherProps = {
    clips: StitcherClip[];
    width: number;
    height: number;
};

export const VideoStitcher: React.FC<StitcherProps> = ({ clips, width, height }) => {
    if (clips.length === 0) {
        return (
            <AbsoluteFill className="bg-black flex items-center justify-center">
                <h1 className="text-white font-bold text-2xl">No clips added</h1>
            </AbsoluteFill>
        );
    }

    return (
        <AbsoluteFill className="bg-black">
            <Series>
                {clips.map((clip) => (
                    <Series.Sequence key={clip.id} durationInFrames={clip.durationInFrames}>
                        <AbsoluteFill className="flex items-center justify-center">
                            {/* We allow Remotion to handle the visual scaling (contain) during preview */}
                            <Html5Video // Replaced OffthreadVideo with Html5Video
                                src={clip.url}
                                style={{
                                    height: '100%',
                                    width: '100%',
                                    objectFit: 'contain'
                                }}
                            />
                        </AbsoluteFill>
                    </Series.Sequence>
                ))}
            </Series>
        </AbsoluteFill>
    );
};