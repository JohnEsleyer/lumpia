import React from 'react';
import { Html5Video, AbsoluteFill } from 'remotion'; // Changed OffthreadVideo to Html5Video

export type TextProps = {
    text: string;
    videoSrc: string;
};

export const TextOverlay: React.FC<TextProps> = ({ text, videoSrc }) => {
    return (
        <AbsoluteFill>
            <Html5Video // Replaced OffthreadVideo with Html5Video
                src={videoSrc}
                className="absolute inset-0 w-full h-full object-cover"
                // Optional: Explicitly stating we start from the beginning
                trimBefore={0}
            />
            <AbsoluteFill className="flex items-center justify-center">
                <h1 className="text-8xl font-black text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] uppercase tracking-widest text-center">
                    {text}
                </h1>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};