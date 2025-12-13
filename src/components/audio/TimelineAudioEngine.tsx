import React, { useEffect, useRef } from 'react';
import type { AudioSource } from '../../hooks/useTimelinePreview';

interface TimelineAudioEngineProps {
    audioSources: AudioSource[];
    currentTime: number;
    isPlaying: boolean;
    playbackRate: number; // Global playback rate (usually 1)
}

export const TimelineAudioEngine: React.FC<TimelineAudioEngineProps> = ({
    audioSources,
    currentTime,
    isPlaying,
    playbackRate
}) => {
    // Map to hold persistent audio elements: Key = ItemID, Value = AudioElement
    const audioPool = useRef<Map<string, HTMLAudioElement>>(new Map());

    // Sync Loop
    useEffect(() => {
        // 1. Cleanup removed items
        const activeIds = new Set(audioSources.map(s => s.id));
        audioPool.current.forEach((_, id) => {
            if (!activeIds.has(id)) {
                audioPool.current.get(id)?.pause();
                audioPool.current.delete(id);
            }
        });

        // 2. Update / Create / Sync items
        audioSources.forEach(source => {
            if (source.isMuted) {
                const el = audioPool.current.get(source.id);
                if (el) {
                    el.pause();
                    el.volume = 0;
                }
                return;
            }

            let audio = audioPool.current.get(source.id);
            if (!audio) {
                audio = new Audio(source.url);
                audio.preload = 'auto';
                audioPool.current.set(source.id, audio);
            }

            // Sync Properties
            if (audio.src !== source.url) audio.src = source.url;
            audio.volume = Math.max(0, Math.min(1, source.volume));
            audio.playbackRate = source.playbackRate * playbackRate;

            // Logic: Is the Playhead inside this clip?
            const isInside = currentTime >= source.timelineStart && currentTime < source.timelineEnd;

            if (isInside) {
                // Calculate where in the SOURCE file we should be
                const timeSinceStart = currentTime - source.timelineStart;
                const sourceTime = source.sourceStartOffset + (timeSinceStart * source.playbackRate);

                // SYNC CHECK: Only seek if drifted significantly (> 0.15s) to avoid stutter
                if (Math.abs(audio.currentTime - sourceTime) > 0.15) {
                    audio.currentTime = sourceTime;
                }

                if (isPlaying) {
                    // Promise safe play
                    if (audio.paused) {
                        audio.play().catch(e => { /* Ignore auto-play blocks during dev */ });
                    }
                } else {
                    if (!audio.paused) audio.pause();
                }
            } else {
                // Outside clip range
                if (!audio.paused) audio.pause();
            }
        });

    }, [audioSources, currentTime, isPlaying, playbackRate]);

    // Unmount Cleanup
    useEffect(() => {
        return () => {
            audioPool.current.forEach(audio => audio.pause());
            audioPool.current.clear();
        };
    }, []);

    return null; // Invisible component
};