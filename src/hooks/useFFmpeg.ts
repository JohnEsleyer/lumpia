import { useState, useEffect, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export function useFFmpeg() {
    const [loaded, setLoaded] = useState(false);
    const ffmpegRef = useRef(new FFmpeg());

    useEffect(() => {
        const load = async () => {
            const ffmpeg = ffmpegRef.current;

            // Avoid double loading
            if (ffmpeg.loaded) {
                setLoaded(true);
                return;
            }

            ffmpeg.on('log', ({ message }) => console.debug(`[FFmpeg]: ${message}`));

            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
            try {
                await ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                });
                setLoaded(true);
            } catch (error) {
                console.error("Failed to load FFmpeg", error);
            }
        };

        load();
    }, []);

    return { ffmpeg: ffmpegRef.current, loaded };
}