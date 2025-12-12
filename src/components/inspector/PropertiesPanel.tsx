import React from 'react';
import { Volume2, Gauge, Settings2 } from 'lucide-react';

interface ClipProperties {
    id: string;
    volume: number;
    playbackRate: number;
}

interface PropertiesPanelProps {
    selectedItemId: string | null;
    // selectedItemType: 'clip' | 'audio' | 'unknown' | null; // Removed unused prop
    properties: ClipProperties | null;
    onUpdate: (id: string, data: Partial<ClipProperties>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedItemId,
    properties,
    onUpdate
}) => {
    if (!selectedItemId || !properties) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-4 p-8 text-center bg-zinc-925">
                <Settings2 size={48} className="opacity-20" />
                <div>
                    <p className="text-sm font-bold text-zinc-500">No Selection</p>
                    <p className="text-xs text-zinc-700 mt-1">Select a clip to edit properties</p>
                </div>
            </div>
        );
    }

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(selectedItemId, { volume: parseFloat(e.target.value) });
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(selectedItemId, { playbackRate: parseFloat(e.target.value) });
    };

    return (
        <div className="flex flex-col h-full bg-zinc-925">
            <div className="h-14 border-b border-zinc-900 flex items-center px-4 bg-zinc-950/30">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings2 size={14} /> Properties
                </span>
            </div>

            <div className="p-6 space-y-8">
                {/* Volume Control */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                        <span className="flex items-center gap-1.5"><Volume2 size={12} /> Volume</span>
                        <span className="text-indigo-400 font-mono">{Math.round((properties.volume ?? 1) * 100)}%</span>
                    </div>
                    <div className="relative h-6 flex items-center">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={properties.volume ?? 1}
                            onChange={handleVolumeChange}
                            className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                        />
                    </div>
                </div>

                {/* Speed Control */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                        <span className="flex items-center gap-1.5"><Gauge size={12} /> Speed</span>
                        <span className="text-indigo-400 font-mono">{properties.playbackRate ?? 1}x</span>
                    </div>
                    <div className="relative h-6 flex items-center">
                        <input
                            type="range" min="0.25" max="3" step="0.25"
                            value={properties.playbackRate ?? 1}
                            onChange={handleSpeedChange}
                            className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
