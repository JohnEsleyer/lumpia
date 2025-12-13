import React from 'react';
import { TimelineItem } from './TimelineItem';
import { type TimelineTrack as TimelineTrackType, type TimelineItem as TimelineItemType } from '../../types';
import { Video, Mic, Layers, Volume2, VolumeX, Eye, Lock } from 'lucide-react';

interface LibraryAsset {
    name: string;
    url: string;
    filmstrip: string[];
    thumbnailUrl: string;
    duration?: number;
}

interface TimelineTrackProps {
    track: TimelineTrackType;
    items: TimelineItemType[];
    pixelsPerSecond: number;
    onItemMove: (itemId: string, newTrackId: string, newStartTime: number) => void;
    onItemTrim: (itemId: string, newStartTime: number, newDuration: number, trimStart: boolean) => void;
    selectedItemId: string | null;
    onItemClick: (itemId: string) => void;
    getAssetName: (resourceId: string) => string;
    getAssetData: (resourceId: string) => LibraryAsset | undefined;
    onAssetDrop: (trackId: string, payload: LibraryAsset) => void;
    activeTool?: 'cursor' | 'split';
    onSplit?: (id: string, time: number) => void;
    onToggleMute?: (trackId: string) => void;
    onDeleteClip?: (trackId: string, itemId: string) => void;
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
    getAssetData,
    onAssetDrop,
    activeTool = 'cursor',
    onSplit,
    onToggleMute,
    onDeleteClip
}) => {
    const trackHeight = 80;
    const sidebarWidth = '240px';

    const getIcon = () => {
        switch (track.type) {
            case 'video': return <Video size={14} className="text-blue-400" />;
            case 'audio': return <Mic size={14} className="text-emerald-400" />;
            case 'overlay': return <Layers size={14} className="text-purple-400" />;
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (track.isMuted) return; // Disable drop on muted tracks

        try {
            const dataString = e.dataTransfer.getData('application/json');
            const data = JSON.parse(dataString);
            if (data.type.startsWith('asset')) {
                onAssetDrop(track.id, data.payload);
            }
        } catch (error) {
            console.error("Invalid drop payload", error);
        }
    };

    return (
        <div className={`flex w-full mb-1 group`}>
            {/* Track Header (Sticky Left) */}
            <div
                className="shrink-0 border-r border-white/5 bg-[#1a1a1a] flex flex-col z-20 sticky left-0 shadow-[2px_0_10px_rgba(0,0,0,0.2)]"
                style={{ width: sidebarWidth, height: trackHeight }}
            >
                <div className="flex-1 p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                        {getIcon()}
                        <span className="text-xs font-bold truncate text-slate-200">{track.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            className={`p-1.5 rounded transition-colors ${track.isMuted ? 'bg-red-500/20 text-red-500' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                            onClick={() => onToggleMute?.(track.id)}
                            title={track.isMuted ? "Unmute Track" : "Mute Track"}
                        >
                            {track.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        </button>
                        <button className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-not-allowed opacity-50">
                            <Lock size={12} />
                        </button>
                        <button className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-not-allowed opacity-50">
                            <Eye size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Track Content */}
            <div
                className={`flex-1 relative border-y border-white/5 transition-colors duration-200
                    ${track.isMuted ? 'bg-[#0f0f0f] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#1a1a1a_10px,#1a1a1a_20px)]' : 'bg-[#111]/50 group-hover:bg-[#111]'}
                `}
                style={{ height: trackHeight }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {items.map(item => {
                    const assetData = getAssetData(item.resourceId);
                    const assetUrl = assetData ? `http://localhost:3001${assetData.url}` : '';

                    return (
                        <TimelineItem
                            key={item.id}
                            item={item}
                            pixelsPerSecond={pixelsPerSecond}
                            height={trackHeight - 4} // Padding
                            onDrag={(_id, newTime) => onItemMove(item.id, track.id, newTime)}
                            onTrim={(_id, newTime, newDur, trimStart) => onItemTrim(item.id, newTime, newDur, trimStart)}
                            onClick={() => onItemClick(item.id)}
                            selected={selectedItemId === item.id}
                            name={getAssetName(item.resourceId)}
                            variant={track.type}
                            assetUrl={assetUrl}
                            filmstrip={assetData?.filmstrip}
                            sourceDuration={assetData?.duration}
                            activeTool={activeTool || 'cursor'}
                            onSplit={onSplit}
                            // New Props
                            isTrackMuted={track.isMuted}
                            onDelete={() => onDeleteClip?.(track.id, item.id)}
                        />
                    );
                })}
            </div>
        </div>
    );
};