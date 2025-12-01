import React, { useCallback, useState } from 'react';
import {
    AbsoluteFill,
    Video,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
    useCurrentScale
} from 'remotion';

export type AnimationType = 'fade' | 'slide' | 'scale' | 'typewriter' | 'none';

export type AdvancedTextProps = {
    videoSrc: string;
    text: string;
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    fontSize: number;
    color: string;
    fontFamily: string;
    animationType: AnimationType;
    shadow: boolean;
    // Callback for drag interaction
    onPositionChange?: (x: number, y: number) => void;
};

export const AdvancedTextOverlay: React.FC<AdvancedTextProps> = ({
    videoSrc,
    text,
    x,
    y,
    fontSize,
    color,
    fontFamily,
    animationType,
    shadow,
    onPositionChange
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useCurrentScale(); // Get current player scale
    const [isDragging, setIsDragging] = useState(false);

    // --- Animation Logic ---
    const entranceDuration = 30;

    // 1. Fade
    const fadeOpacity = interpolate(
        frame,
        [0, entranceDuration],
        [0, 1],
        { extrapolateRight: 'clamp' }
    );

    // 2. Slide
    const slideOffset = spring({
        frame,
        fps,
        from: 100,
        to: 0,
        config: { damping: 12 }
    });

    // 3. Scale
    const scaleAnim = spring({
        frame,
        fps,
        from: 0,
        to: 1,
        config: { mass: 0.5, stiffness: 100 }
    });

    // 4. Typewriter
    const textLength = Math.floor(
        interpolate(frame, [0, entranceDuration * 2], [0, text.length], { extrapolateRight: 'clamp' })
    );
    const displayedText = animationType === 'typewriter' ? text.slice(0, textLength) : text;

    let animationStyle: React.CSSProperties = {};
    switch (animationType) {
        case 'fade': animationStyle = { opacity: fadeOpacity }; break;
        case 'slide': animationStyle = { transform: `translateY(${slideOffset}px)`, opacity: fadeOpacity }; break;
        case 'scale': animationStyle = { transform: `scale(${scaleAnim})` }; break;
        case 'typewriter': animationStyle = {}; break;
    }

    // --- Drag Logic ---
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!onPositionChange) return;

        e.preventDefault();
        e.stopPropagation();

        const initialX = e.clientX;
        const initialY = e.clientY;
        const startXPercent = x;
        const startYPercent = y;

        setIsDragging(true);

        const onPointerMove = (moveEvent: PointerEvent) => {
            // Calculate delta in pixels, corrected by scale
            const deltaXPixels = (moveEvent.clientX - initialX) / scale;
            const deltaYPixels = (moveEvent.clientY - initialY) / scale;

            // Convert pixel delta to percentage of video dimensions
            const deltaXPercent = (deltaXPixels / width) * 100;
            const deltaYPercent = (deltaYPixels / height) * 100;

            onPositionChange(
                Math.min(100, Math.max(0, startXPercent + deltaXPercent)),
                Math.min(100, Math.max(0, startYPercent + deltaYPercent))
            );
        };

        const onPointerUp = () => {
            setIsDragging(false);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }, [scale, width, height, x, y, onPositionChange]);

    return (
        <AbsoluteFill className="bg-black">
            {videoSrc && (
                <Video
                    src={videoSrc}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            )}

            <div
                onPointerDown={handlePointerDown}
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 'auto', // Allow auto width to fit content
                    cursor: onPositionChange ? (isDragging ? 'grabbing' : 'grab') : 'default',
                    userSelect: 'none',
                    zIndex: 10,
                    // Add a transparent border to make grabbing easier
                    border: isDragging ? `2px dashed #3b82f6` : '2px solid transparent',
                    padding: '10px',
                    borderRadius: '8px',
                    transition: 'border-color 0.2s'
                }}
            >
                <div style={animationStyle}>
                    <h1
                        style={{
                            fontSize: `${fontSize}px`,
                            color: color,
                            fontFamily: fontFamily,
                            textShadow: shadow ? '0px 4px 20px rgba(0,0,0,0.8)' : 'none',
                            fontWeight: 800,
                            textAlign: 'center',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.2,
                            margin: 0
                        }}
                    >
                        {displayedText}
                        {animationType === 'typewriter' && frame < entranceDuration * 2 && (
                            <span className="animate-pulse text-blue-400">|</span>
                        )}
                    </h1>
                </div>
            </div>
        </AbsoluteFill>
    );
};