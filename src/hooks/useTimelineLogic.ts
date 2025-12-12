// src/hooks/useTimelineLogic.ts

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

                // Check for immediate collision at insertion point
                const itemEnd = newItem.start + newItem.duration;
                const hasCollision = track.items.some(existing => {
                    const existingEnd = existing.start + existing.duration;
                    return (newItem.start < existingEnd && itemEnd > existing.start);
                });

                if (hasCollision) {
                    // Simple collision handling: insert immediately after the last item, or reject if timeline is full
                    const maxEnd = track.items.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
                    newItem.start = maxEnd;
                }

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
            if (track.id !== trackId) return track;

            const item = track.items.find(i => i.id === itemId);
            if (!item) return track;

            const SNAP_THRESHOLD = 0.2; // seconds (FR-3.1.2)
            let proposedStart = Math.max(0, newStart);
            const proposedEnd = proposedStart + item.duration;

            const otherItems = track.items.filter(i => i.id !== itemId);

            // 1. Apply Snapping (FR-3.1.2)
            for (const other of otherItems) {
                const otherEnd = other.start + other.duration;

                // Snap to start of previous item's end
                if (Math.abs(proposedStart - otherEnd) < SNAP_THRESHOLD) {
                    proposedStart = otherEnd;
                }
                // Snap to end of next item's start
                if (Math.abs(proposedEnd - other.start) < SNAP_THRESHOLD) {
                    proposedStart = other.start - item.duration;
                }
            }

            // Ensure start time is clamped to zero after snapping
            proposedStart = Math.max(0, proposedStart);

            // 2. Collision Check (FR-3.1.3)
            const itemEnd = proposedStart + item.duration;
            const hasCollision = otherItems.some(other => {
                const otherEnd = other.start + other.duration;
                // Collision occurs if the time ranges overlap
                return (proposedStart < otherEnd && itemEnd > other.start);
            });

            if (hasCollision) {
                // If collision occurs, reject the move
                return track;
            }

            // 3. Commit Move (FR-3.1.4)
            return {
                ...track,
                items: track.items.map(i => i.id === itemId ? { ...i, start: proposedStart } : i)
            };
        }));
    }, []);

    const trimClip = useCallback((trackId: string, itemId: string, newOffset: number, newDuration: number, trimStart: boolean) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                const otherItems = track.items.filter(i => i.id !== itemId).sort((a, b) => a.start - b.start);
                const item = track.items.find(i => i.id === itemId);
                if (!item) return track;

                // Determine collision bounds
                let prevEnd = 0;
                let nextStart = Infinity;
                const SNAP_THRESHOLD = 0.1;

                // Find immediate neighbors' boundaries
                for (const other of otherItems) {
                    if (other.start + other.duration <= item.start + SNAP_THRESHOLD) {
                        prevEnd = Math.max(prevEnd, other.start + other.duration);
                    }
                    if (other.start >= item.start + item.duration - SNAP_THRESHOLD) {
                        nextStart = Math.min(nextStart, other.start);
                    }
                }

                return {
                    ...track,
                    items: track.items.map(i => {
                        if (i.id === itemId) {
                            if (trimStart) {
                                // FR-3.2.2: Trimming start shifts position and updates offset

                                // Calculate the desired timeline start based on the source shift
                                const sourceShift = newOffset - i.startOffset;
                                let updatedStart = i.start + (sourceShift / (i.playbackRate || 1));

                                // Apply collision constraint: updatedStart >= prevEnd
                                if (updatedStart < prevEnd) {
                                    // Snap start to previous clip end
                                    updatedStart = prevEnd;

                                    // Calculate the resulting duration (expanded backwards)
                                    const timeCorrection = prevEnd - i.start;
                                    newDuration = i.duration + timeCorrection;

                                    // Calculate the resulting offset
                                    const requiredOffsetShift = timeCorrection * (i.playbackRate || 1);
                                    newOffset = i.startOffset - requiredOffsetShift;
                                }

                                // Ensure new duration doesn't exceed the timeline slot (nextStart)
                                newDuration = Math.min(newDuration, nextStart - updatedStart);

                                return {
                                    ...i,
                                    start: updatedStart,
                                    startOffset: newOffset,
                                    duration: newDuration
                                };

                            } else {
                                // FR-3.2.3: Trimming End only changes duration
                                let updatedDuration = newDuration;

                                // FR-3.2.4: Constraint: start + duration <= nextStart
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
                    // FR-3.3.2: Correctly calculate new source offset based on playback rate
                    startOffset: itemToSplit.startOffset + firstHalfDuration * (itemToSplit.playbackRate || 1)
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