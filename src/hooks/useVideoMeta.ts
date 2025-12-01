import { useState } from 'react';
import { createInput } from '../utils/mediabunny';

export type VideoMeta = {
    file?: File;
    url: string;
    durationInSeconds: number;
    fps: number;
    width: number;
    height: number;
};

export function useVideoMeta() {
    const [meta, setMeta] = useState<VideoMeta | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const processFile = async (file: File): Promise<VideoMeta | null> => {
        setIsProcessing(true);
        try {
            const input = createInput(file);

            // Run duration and track info fetch in parallel
            const [duration, videoTrack] = await Promise.all([
                input.computeDuration(),
                input.getPrimaryVideoTrack()
            ]);

            if (!videoTrack) throw new Error("No video track found in file");

            // Calculate FPS by analyzing a small sample of packets
            const packetStats = await videoTrack.computePacketStats(50);
            const fps = packetStats.averagePacketRate || 30;

            const newMeta: VideoMeta = {
                file,
                url: URL.createObjectURL(file),
                durationInSeconds: duration,
                fps,
                width: videoTrack.displayWidth,
                height: videoTrack.displayHeight,
            };

            setMeta(newMeta);
            return newMeta;
        } catch (e) {
            console.error("Mediabunny Metadata Error:", e);
            return null;
        } finally {
            setIsProcessing(false);
        }
    };

    const getMeta = async (url: string): Promise<VideoMeta | null> => {
        setIsProcessing(true);
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = url;

            video.onloadedmetadata = () => {
                const newMeta: VideoMeta = {
                    url,
                    durationInSeconds: video.duration,
                    fps: 30, // Fallback as we can't easily get FPS from video element without analyzing frames
                    width: video.videoWidth,
                    height: video.videoHeight,
                };
                setMeta(newMeta);
                setIsProcessing(false);
                resolve(newMeta);
            };

            video.onerror = () => {
                console.error("Failed to load video metadata from URL");
                setIsProcessing(false);
                resolve(null);
            };
        });
    };

    const clear = () => {
        if (meta?.url && meta.file) URL.revokeObjectURL(meta.url);
        setMeta(null);
    };

    return { meta, processFile, getMeta, clear, isProcessing };
}