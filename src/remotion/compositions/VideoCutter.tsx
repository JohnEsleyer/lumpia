import React from 'react';
import { AbsoluteFill, Html5Video } from 'remotion';

export type CutterProps = {
    videoSrc: string;
    startFrom: number;
    endAt: number;
    fit?: 'contain' | 'cover';
};

export const VideoCutter: React.FC<CutterProps> = ({ videoSrc, startFrom, fit = 'contain' }) => {
    return (
        <AbsoluteFill className="bg-black flex justify-center items-center">
            <Html5Video
                src={videoSrc}
                trimBefore={startFrom}
                crossOrigin="anonymous"
                className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                acceptableTimeShiftInSeconds={0.5}
            />
        </AbsoluteFill>
    );
};