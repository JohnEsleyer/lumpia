import { useState, useCallback, useMemo } from 'react';
import { type TimelineTrack, type TimelineItem, type Project } from '../types';

export const useTimelineLogic = (_initialProject: Project | null) => {
    const [tracks, setTracks] = useState<TimelineTrack[]>([]);
    const [currentTime, setCurrentTime] = useState(0);

    // Dynamic duration with padding
    const duration = useMemo(() => {
        if (tracks.length === 0) return 60;
        const maxItemEnd = tracks.flatMap(t => t.items).reduce((max, item) => Math.max(max, item.start + item.duration), 0);
        return Math.max(maxItemEnd + 10, 30);
    }, [tracks]);

    // --- SNAPPING ENGINE ---
    const getSnapTime = useCallback((time: number, excludedItemId: string | null = null, threshold = 0.2) => {
        let closestTime = time;
        let minDist = threshold;

        // 1. Snap to Playhead
        if (Math.abs(time - currentTime) < minDist) {
            closestTime = currentTime;
            minDist = Math.abs(time - currentTime);
        }

        // 2. Snap to Start/End of other clips on ALL tracks
        tracks.forEach(track => {
            track.items.forEach(item => {
                if (item.id === excludedItemId) return;

                // Snap to Start
                const startDist = Math.abs(time - item.start);
                if (startDist < minDist) {
                    closestTime = item.start;
                    minDist = startDist;
                }

                // Snap to End
                const endDist = Math.abs(time - (item.start + item.duration));
                if (endDist < minDist) {
                    closestTime = item.start + item.duration;
                    minDist = endDist;
                }
            });
        });

        // 3. Snap to Timeline Start
        if (Math.abs(time) < minDist) closestTime = 0;

        return closestTime;
    }, [tracks, currentTime]);


    const initializeTimeline = useCallback((project: Project) => {
        if (project.editorState?.timeline) {
            setTracks(project.editorState.timeline.tracks);
        } else {
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
                const isImage = track.type === 'overlay' && !/\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(asset.name);

                const newItem: TimelineItem = {
                    id: crypto.randomUUID(),
                    resourceId: asset.name,
                    trackId: trackId,
                    start: startTime,
                    duration: isImage ? 5 : itemDuration,
                    startOffset: options?.startOffset ?? 0,
                    volume: 1,
                    playbackRate: 1
                };
                return { ...track, items: [...track.items, newItem] };
            }
            return track;
        }));
    }, []);

    // --- STANDARD DELETE ---
    const deleteClip = useCallback((trackId: string, itemId: string) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return { ...track, items: track.items.filter(item => item.id !== itemId) };
            }
            return track;
        }));
    }, []);

    // --- RIPPLE DELETE ---
    const rippleDeleteClip = useCallback((trackId: string, itemId: string) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                const itemToDelete = track.items.find(i => i.id === itemId);
                if (!itemToDelete) return track;

                const deletedDuration = itemToDelete.duration;
                const deletedStart = itemToDelete.start;

                // Remove item and shift all subsequent items left
                const newItems = track.items
                    .filter(i => i.id !== itemId)
                    .map(i => {
                        if (i.start > deletedStart) {
                            return { ...i, start: i.start - deletedDuration };
                        }
                        return i;
                    });

                return { ...track, items: newItems };
            }
            return track;
        }));
    }, []);

    const moveClip = useCallback((trackId: string, itemId: string, newStart: number) => {
        // Simple move logic, snapping is handled by the caller (UI) via getSnapTime
        setTracks(prev => prev.map(track => {
            if (track.id !== trackId) return track;
            const items = track.items.map(i => {
                if (i.id === itemId) return { ...i, start: Math.max(0, newStart) };
                return i;
            });
            return { ...track, items };
        }));
    }, []);

    // --- SLIP EDITING ---
    // Changes startOffset while keeping start/duration on timeline fixed
    const slipClip = useCallback((trackId: string, itemId: string, delta: number, sourceDuration: number) => {
        setTracks(prev => prev.map(track => {
            if (track.id !== trackId) return track;

            return {
                ...track,
                items: track.items.map(item => {
                    if (item.id === itemId) {
                        const rate = item.playbackRate || 1;
                        // Calculate new offset
                        let newStartOffset = item.startOffset - (delta * rate);

                        // Bounds checking
                        newStartOffset = Math.max(0, newStartOffset);

                        const currentDurationInSource = item.duration * rate;
                        if (newStartOffset + currentDurationInSource > sourceDuration) {
                            newStartOffset = sourceDuration - currentDurationInSource;
                        }

                        return { ...item, startOffset: newStartOffset };
                    }
                    return item;
                })
            };
        }));
    }, []);

    // --- ADVANCED TRIM (Standard, Ripple, Roll) ---
    const trimClip = useCallback((
        trackId: string,
        itemId: string,
        newStart: number,
        newDuration: number,
        trimStart: boolean,
        mode: 'standard' | 'ripple' = 'standard'
    ) => {
        setTracks(prev => prev.map(track => {
            if (track.id !== trackId) return track;

            const originalItem = track.items.find(i => i.id === itemId);
            if (!originalItem) return track;

            const timeDiff = trimStart
                ? newStart - originalItem.start
                : newDuration - originalItem.duration;

            // RIPPLE TRIM (Shift subsequent items)
            if (mode === 'ripple') {
                return {
                    ...track,
                    items: track.items.map(item => {
                        if (item.id === itemId) {
                            // Apply trim to self
                            if (trimStart) {
                                const sourceShift = (newStart - item.start) * (item.playbackRate || 1);
                                return { ...item, start: newStart, duration: newDuration, startOffset: item.startOffset + sourceShift };
                            } else {
                                return { ...item, duration: newDuration };
                            }
                        }

                        // Shift subsequent items
                        // If we extended duration (positive diff), shift right. If shrunk, shift left.
                        if (item.start > originalItem.start) {
                            return { ...item, start: item.start + timeDiff };
                        }

                        return item;
                    })
                };
            }

            // STANDARD TRIM (Overwrite / Gap)
            return {
                ...track,
                items: track.items.map(item => {
                    if (item.id === itemId) {
                        if (trimStart) {
                            const delta = newStart - item.start;
                            const sourceDelta = delta * (item.playbackRate || 1);

                            return {
                                ...item,
                                start: newStart,
                                duration: newDuration,
                                startOffset: item.startOffset + sourceDelta
                            };
                        } else {
                            return { ...item, duration: newDuration };
                        }
                    }
                    return item;
                })
            };
        }));
    }, []);

    const splitClip = useCallback((trackId: string, itemId: string, splitTime: number) => {
        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                const itemToSplit = track.items.find(i => i.id === itemId);
                if (!itemToSplit) return track;
                if (splitTime <= itemToSplit.start || splitTime >= itemToSplit.start + itemToSplit.duration) return track;

                const firstHalfDuration = splitTime - itemToSplit.start;
                const secondHalfDuration = itemToSplit.duration - firstHalfDuration;

                const firstItem: TimelineItem = { ...itemToSplit, duration: firstHalfDuration };
                const secondItem: TimelineItem = {
                    ...itemToSplit,
                    id: crypto.randomUUID(),
                    start: splitTime,
                    duration: secondHalfDuration,
                    startOffset: itemToSplit.startOffset + firstHalfDuration * (itemToSplit.playbackRate || 1)
                };

                return { ...track, items: track.items.map(i => i.id === itemId ? firstItem : i).concat(secondItem) };
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

    const toggleTrackMute = useCallback((trackId: string) => {
        setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t));
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
        rippleDeleteClip, // New
        slipClip,         // New
        toggleTrackMute,
        getSnapTime       // New
    };
};