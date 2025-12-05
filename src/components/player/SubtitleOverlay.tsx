import React from 'react';
import { SUBTITLE_STYLES, type SubtitleStyleId } from '../subtitle-styles';
import type { SubtitleSettings } from '../../types';

interface SubtitleOverlayProps {
    text: string;
    styleId?: SubtitleStyleId;
    settings?: SubtitleSettings;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
    text,
    styleId = 'modern',
    settings = { x: 50, y: 85, scale: 1 }
}) => {
    const StyleComponent = SUBTITLE_STYLES[styleId]?.component || SUBTITLE_STYLES.modern.component;

    return (
        <div
            style={{
                position: 'absolute',
                top: `${settings.y}%`,
                left: `${settings.x}%`,
                transform: `translate(-50%, -50%) scale(${settings.scale})`,
                width: '100%',
                pointerEvents: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
            }}
        >
            <StyleComponent text={text} />
        </div>
    );
};
