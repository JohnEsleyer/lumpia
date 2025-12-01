import React, { useEffect, useRef, useState } from 'react';
import { createInput } from '../utils/mediabunny';
import { CanvasSink } from 'mediabunny';

interface FilmstripProps {
    fileUrl: string;
    duration: number;
    height?: number;
}

// Helper to convert Blob to Base64 string for display
const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const Filmstrip: React.FC<FilmstripProps> = ({ fileUrl, duration, height = 64 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [thumbnails, setThumbnails] = useState<string[]>([]);

    useEffect(() => {
        let isCancelled = false;

        const generate = async () => {
            if (!containerRef.current || !fileUrl || duration <= 0) return;

            try {
                // Fetch the file as a blob to feed Mediabunny (Client-side extraction)
                const response = await fetch(fileUrl);
                const blob = await response.blob();

                const input = createInput(blob);
                const videoTrack = await input.getPrimaryVideoTrack();
                if (!videoTrack || !(await videoTrack.canDecode())) return;

                const sink = new CanvasSink(videoTrack, { height });

                // Calculate how many thumbs fit in the container
                const width = containerRef.current.clientWidth;
                // Assume roughly 16:9 aspect ratio per thumb
                const thumbWidth = (height * 16) / 9;
                const count = Math.max(1, Math.ceil(width / thumbWidth));

                const generated: string[] = [];
                const interval = duration / count;

                for (let i = 0; i < count; i++) {
                    if (isCancelled) break;

                    // Calculate timestamp (avoiding exactly the end which might be black)
                    const time = Math.min(i * interval, duration - 0.1);

                    try {
                        const result = await sink.getCanvas(time);

                        if (result) {
                            let url = '';

                            // Type guard for OffscreenCanvas vs HTMLCanvasElement
                            if (result.canvas instanceof OffscreenCanvas) {
                                const imageBlob = await result.canvas.convertToBlob({ type: 'image/jpeg', quality: 0.5 });
                                url = await blobToDataURL(imageBlob);
                            } else {
                                url = (result.canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.5);
                            }

                            generated.push(url);
                            // Update progressively so user sees images appearing
                            if (!isCancelled) setThumbnails([...generated]);
                        }
                    } catch (err) {
                        console.warn(`Frame extraction failed at ${time}s`, err);
                    }
                }
            } catch (e) {
                console.error("Filmstrip generation error", e);
            }
        };

        // Reset thumbnails when file changes
        setThumbnails([]);
        generate();

        return () => {
            isCancelled = true;
        };
    }, [fileUrl, duration, height]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 flex overflow-hidden opacity-50 pointer-events-none rounded-lg bg-black/20"
        >
            {thumbnails.map((src, i) => (
                <img
                    key={i}
                    src={src}
                    alt={`frame-${i}`}
                    className="h-full object-cover flex-1 min-w-0 border-r border-white/5 last:border-0"
                    draggable={false}
                />
            ))}
        </div>
    );
};