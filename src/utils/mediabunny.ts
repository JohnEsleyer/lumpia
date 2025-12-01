import { Input, BlobSource, ALL_FORMATS, CanvasSink } from 'mediabunny';

/**
 * Creates a Mediabunny Input instance from a File or Blob.
 */
export const createInput = (file: File | Blob) => {
    return new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(file),
    });
};

/**
 * Generates a thumbnail URL for a specific time in the video.
 * Returns a Data URL string to avoid ObjectURL revocation complexity in lists.
 */
export const generateThumbnail = async (file: File, timeInSeconds: number, width = 320): Promise<string | null> => {
    try {
        const input = createInput(file);
        const videoTrack = await input.getPrimaryVideoTrack();
        
        if (!videoTrack) return null;
        
        const decodable = await videoTrack.canDecode();
        if (!decodable) return null;

        const sink = new CanvasSink(videoTrack, { width });
        const result = await sink.getCanvas(timeInSeconds);
        
        if (!result) return null;
        
        const { canvas } = result;

        if (canvas instanceof OffscreenCanvas) {
            const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
            return await blobToDataURL(blob);
        } else {
            return canvas.toDataURL('image/jpeg', 0.7);
        }
    } catch (e) {
        console.error("Thumbnail generation failed", e);
        return null;
    }
};

const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};