import React from 'react';
import { TimelineItem } from './TimelineItem';
import { type TimelineTrack as TimelineTrackType, type TimelineItem as TimelineItemType } from '../../types';
import { Video, Mic, Layers, Volume2 } from 'lucide-react';

interface TimelineTrackProps {
    track: TimelineTrackType;
    items: TimelineItemType[];
    pixelsPerSecond: number;
    onItemMove: (itemId: string, newTrackId: string, newStartTime: number) => void;
    onItemTrim: (itemId: string, newStartTime: number, newDuration: number, trimStart: boolean) => void;
    selectedItemId: string | null;
    onItemClick: (itemId: string) => void;
    getAssetName: (resourceId: string) => string;
    getAssetUrl: (resourceId: string) => string;
    activeTool?: 'cursor' | 'split';
    onSplit?: (id: string, time: number) => void;
    onToggleMute?: (trackId: string) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
    track,
    items,
    pixelsPerSecond,
    onItemMove,
    onItemTrim,
    selectedItemId,
    onItemClick,
    getAssetName,
    getAssetUrl,
    activeTool = 'cursor',
    onSplit,
    onToggleMute
}) => {
    const trackHeight = 80;

    const getIcon = () => {
        switch (track.type) {
            case 'video': return <Video size={16} />;
            case 'audio': return <Mic size={16} />;
            case 'overlay': return <Layers size={16} />;
        }
    };

    return (
        <div className={`flex w-full border-b border-white/5`}>
            {/* Track Header */}
            <div className="w-[200px] shrink-0 border-r border-white/5 bg-[#111] p-2 flex flex-col justify-between z-20 sticky left-0">
                <div className="flex items-center gap-2 text-slate-300">
                    {getIcon()}
                    <span className="text-xs font-bold truncate">{track.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className={`p-1 rounded ${track.isMuted ? 'text-red-500 hover:text-red-400' : 'text-slate-500 hover:text-white'}`}
                        onClick={() => onToggleMute?.(track.id)}
                    >
                        {track.isMuted ? <Volume2 className="line-through opacity-50" size={12} /> : <Volume2 size={12} />}
                    </button>
                    {/* Add more track controls here */}
                </div>
            </div>

            {/* Track Content */}
            <div className={`flex-1 relative bg-[#0a0a0a]`} style={{ height: trackHeight }}>
                {/* Grid Lines (could be moved to container for efficiency) */}
                <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'linear-gradient(to right, #222 1px, transparent 1px)',
                    backgroundSize: `${pixelsPerSecond}px 100%`
                }} />

                {items.map(item => (
                    <TimelineItem
                        key={item.id}
                        item={item}
                        pixelsPerSecond={pixelsPerSecond}
                        height={48}
                        onDrag={(_id, newTime) => onItemMove(item.id, track.id, newTime)}
                        onTrim={(_id, newTime, newDur, trimStart) => onItemTrim(item.id, newTime, newDur, trimStart)}
                        onClick={() => onItemClick(item.id)}
                        selected={selectedItemId === item.id}
                        name={getAssetName(item.resourceId)}
                        variant={track.type}
                        assetUrl={getAssetUrl(item.resourceId)}
                        activeTool={activeTool || 'cursor'}
                        onSplit={onSplit}
                    />
                ))}
            </div>
        </div>
    );
};
