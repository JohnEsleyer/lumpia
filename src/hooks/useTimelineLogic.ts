import { useState, useCallback } from 'react';
import { type TimelineTrack, type TimelineItem, type Project } from '../types';

export const useTimelineLogic = (_initialProject: Project | null) => {
    const [tracks, setTracks] = useState<TimelineTrack[]>([]);
    const [duration, setDuration] = useState(60); // Default 60s
    const [currentTime, setCurrentTime] = useState(0);

    // Initialize logic
    const initializeTimeline = useCallback((project: Project) => {
        if (project.editorState?.timeline) {
            setTracks(project.editorState.timeline.tracks);
            setDuration(project.editorState.timeline.duration);
        } else {
            // Default setup if no timeline exists
            setTracks([
                { id: 'video-main', type: 'video', name: 'Main Video', items: [] },
                { id: 'audio-main', type: 'audio', name: 'Main Audio', items: [] },
                { id: 'overlay-main', type: 'overlay', name: 'Overlays', items: [] },
            ]);
        }
    }, []);

    const addClip = useCallback((trackId: string, asset: any, startTime: number) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                const newItem: TimelineItem = {
                    id: crypto.randomUUID(),
                    resourceId: asset.name, // Or asset.id if available
                    trackId: trackId,
                    start: startTime,
                    duration: asset.duration || 5, // Default duration
                    startOffset: 0,
                    volume: 1,
                    playbackRate: 1
                };
                return { ...track, items: [...track.items, newItem] };
            }
            return track;
        }));
    }, []);

    const moveClip = useCallback((trackId: string, itemId: string, newStart: number) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    items: track.items.map(item =>
                        item.id === itemId ? { ...item, start: newStart } : item
                    )
                };
            }
            return track;
        }));
    }, []);

    const trimClip = useCallback((trackId: string, itemId: string, newOffset: number, newDuration: number, trimStart: boolean) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    items: track.items.map(item => {
                        if (item.id === itemId) {
                            if (trimStart) {
                                // Trimming the start means moving the start time forward AND changing the offset
                                // But here we are passed the raw new offset and duration. 
                                // We need to adjust 'start' if we trimmed from the left.
                                // Actually, the UI usually handles the drag delta.
                                // Let's assume the UI calculates everything or we simplify. 
                                // For now, update offset and duration.
                                const shift = newOffset - item.startOffset;
                                return {
                                    ...item,
                                    start: item.start + shift,
                                    startOffset: newOffset,
                                    duration: newDuration
                                };
                            } else {
                                return { ...item, duration: newDuration };
                            }
                        }
                        return item;
                    })
                };
            }
            return track;
        }));
    }, []);

    const splitClip = useCallback((trackId: string, itemId: string, splitTime: number) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                const itemToSplit = track.items.find(i => i.id === itemId);
                if (!itemToSplit) return track;

                // Check if splitTime is within item range
                if (splitTime <= itemToSplit.start || splitTime >= itemToSplit.start + itemToSplit.duration) {
                    return track;
                }

                const firstHalfDuration = splitTime - itemToSplit.start;
                const secondHalfDuration = itemToSplit.duration - firstHalfDuration;

                const firstItem: TimelineItem = {
                    ...itemToSplit,
                    duration: firstHalfDuration
                };

                const secondItem: TimelineItem = {
                    ...itemToSplit,
                    id: crypto.randomUUID(),
                    start: splitTime,
                    duration: secondHalfDuration,
                    startOffset: itemToSplit.startOffset + firstHalfDuration
                };

                return {
                    ...track,
                    items: track.items.map(i => i.id === itemId ? firstItem : i).concat(secondItem)
                };
            }
            return track;
        }));
    }, []);

    const updateClip = useCallback((trackId: string, itemId: string, data: Partial<TimelineItem>) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    items: track.items.map(item => item.id === itemId ? { ...item, ...data } : item)
                };
            }
            return track;
        }));
    }, []);

    return {
        tracks,
        duration,
        currentTime,
        setCurrentTime,
        initializeTimeline,
        addClip,
        moveClip,
        trimClip,
        splitClip,
        updateClip,
        setTracks
    };
};
