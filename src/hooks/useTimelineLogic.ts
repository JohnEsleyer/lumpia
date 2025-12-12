import { useState, useCallback, useMemo } from 'react';
import { type TimelineTrack, type TimelineItem, type Project } from '../types';

export const useTimelineLogic = (_initialProject: Project | null) => {
    const [tracks, setTracks] = useState<TimelineTrack[]>([]);
    const [currentTime, setCurrentTime] = useState(0);

    // Calculate duration dynamically based on the furthest item in the timeline
    const duration = useMemo(() => {
        if (tracks.length === 0) return 60; // Default if no tracks

        const maxItemEnd = tracks.flatMap(t => t.items).reduce((max, item) => {
            const itemEnd = item.start + item.duration;
            return Math.max(max, itemEnd);
        }, 0);

        // Add 5 seconds of padding, or ensure a minimum of 30 seconds
        return Math.max(maxItemEnd + 5, 30);
    }, [tracks]);

    // Initialize logic
    const initializeTimeline = useCallback((project: Project) => {
        if (project.editorState?.timeline) {
            setTracks(project.editorState.timeline.tracks);
            // We no longer manually set duration, it is derived from the loaded tracks
        } else {
            // Default setup if no timeline exists
            setTracks([
                { id: 'video-main', type: 'video', name: 'Main Video', items: [] },
                { id: 'audio-main', type: 'audio', name: 'Main Audio', items: [] },
                { id: 'overlay-main', type: 'overlay', name: 'Overlays', items: [] },
            ]);
        }
    }, []);

    const addClip = useCallback((trackId: string, asset: any, startTime: number, options?: { startOffset?: number, duration?: number }) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                const itemDuration = options?.duration ?? (asset.duration || 5);

                // If it's an image, duration is fixed. If video/audio, it's source duration or provided duration.
                const isImage = track.type === 'overlay' && !/\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(asset.name);

                const newItem: TimelineItem = {
                    id: crypto.randomUUID(),
                    resourceId: asset.name, // Or asset.id if available
                    trackId: trackId,
                    start: startTime,
                    duration: isImage ? 5 : itemDuration, // Default 5s for images
                    startOffset: options?.startOffset ?? 0,
                    volume: 1,
                    playbackRate: 1
                };
                return { ...track, items: [...track.items, newItem] };
            }
            return track;
        }));
    }, []);

    const toggleTrackMute = useCallback((trackId: string) => {
        setTracks(prev => prev.map(track =>
            track.id === trackId ? { ...track, isMuted: !track.isMuted } : track
        ));
    }, []);

    const moveClip = useCallback((trackId: string, itemId: string, newStart: number) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                const item = track.items.find(i => i.id === itemId);
                if (!item) return track;

                // 1. Collision & Snapping (Simplified bounds checking)
                const SNAP_THRESHOLD = 0.5; // seconds
                const otherItems = track.items.filter(i => i.id !== itemId).sort((a, b) => a.start - b.start);

                let proposedStart = Math.max(0, newStart);
                const proposedEnd = proposedStart + item.duration;

                let leftBound = 0;
                let rightBound = Infinity;

                // Find the two items surrounding the proposed center
                const sortedOthers = [...otherItems].sort((a, b) => a.start - b.start);

                // Find immediate left neighbor's end time
                for (const other of sortedOthers) {
                    if (other.start + other.duration <= proposedStart + SNAP_THRESHOLD) {
                        leftBound = Math.max(leftBound, other.start + other.duration);
                    }
                }

                // Find immediate right neighbor's start time
                for (const other of sortedOthers) {
                    if (other.start >= proposedEnd - SNAP_THRESHOLD) {
                        rightBound = Math.min(rightBound, other.start);
                    }
                }

                // Clamp to bounds
                let constrainedStart = Math.max(leftBound, Math.min(proposedStart, rightBound - item.duration));

                // Apply Snapping
                if (Math.abs(constrainedStart - leftBound) < SNAP_THRESHOLD) {
                    constrainedStart = leftBound;
                } else if (Math.abs((constrainedStart + item.duration) - rightBound) < SNAP_THRESHOLD) {
                    constrainedStart = rightBound - item.duration;
                }


                return {
                    ...track,
                    items: track.items.map(i =>
                        i.id === itemId ? { ...i, start: constrainedStart } : i
                    )
                };
            }
            return track;
        }));
    }, []);

    const trimClip = useCallback((trackId: string, itemId: string, newOffset: number, newDuration: number, trimStart: boolean) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                // Find neighbors
                const otherItems = track.items.filter(i => i.id !== itemId).sort((a, b) => a.start - b.start);
                const item = track.items.find(i => i.id === itemId);
                if (!item) return track;

                // Determine bounds
                let prevEnd = 0;
                let nextStart = Infinity;

                // Find immediate neighbors
                for (const other of otherItems) {
                    if (other.start + other.duration <= item.start + 0.001) {
                        prevEnd = Math.max(prevEnd, other.start + other.duration);
                    }
                    if (other.start >= item.start + item.duration - 0.001) {
                        nextStart = Math.min(nextStart, other.start);
                    }
                }

                return {
                    ...track,
                    items: track.items.map(i => {
                        if (i.id === itemId) {
                            if (trimStart) {
                                const shift = newOffset - i.startOffset;
                                let updatedStart = i.start + shift;
                                let updatedDuration = newDuration;

                                // Constraint: updatedStart >= prevEnd
                                if (updatedStart < prevEnd) {
                                    // Calculate maximum allowed shift
                                    const maxShift = item.start - prevEnd;
                                    updatedStart = prevEnd;
                                    updatedDuration = item.duration + maxShift;
                                    newOffset = item.startOffset - maxShift;

                                    if (newDuration < updatedDuration) return i; // Prevent invalid backwards trim past neighbor
                                }

                                return {
                                    ...i,
                                    start: updatedStart,
                                    startOffset: newOffset,
                                    duration: updatedDuration
                                };

                            } else {
                                // Trimming End
                                let updatedDuration = newDuration;
                                // Constraint: start + duration <= nextStart
                                if (i.start + updatedDuration > nextStart) {
                                    updatedDuration = nextStart - i.start;
                                }
                                return { ...i, duration: updatedDuration };
                            }
                        }
                        return i;
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
                    startOffset: itemToSplit.startOffset + firstHalfDuration * (itemToSplit.playbackRate || 1) // Apply speed to calculate source offset
                };

                // Replace original item with first half, append second half
                const updatedItems = track.items
                    .map(i => i.id === itemId ? firstItem : i)
                    .concat(secondItem)
                    .sort((a, b) => a.start - b.start); // Re-sort to maintain order

                return {
                    ...track,
                    items: updatedItems
                };
            }
            return track;
        }));
    }, []);

    // Refined updateClip to handle multi-property updates including timeline position/trim commitment
    const updateClip = useCallback((trackId: string, itemId: string, data: Partial<TimelineItem>) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    items: track.items.map(item => {
                        if (item.id === itemId) {
                            // Merge new data (handles volume/speed/start/duration/startOffset)
                            return { ...item, ...data };
                        }
                        return item;
                    })
                };
            }
            return track;
        }));
    }, []);

    const deleteClip = useCallback((trackId: string, itemId: string) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    items: track.items.filter(item => item.id !== itemId)
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
        deleteClip,
        toggleTrackMute,
        setTracks
    };
};