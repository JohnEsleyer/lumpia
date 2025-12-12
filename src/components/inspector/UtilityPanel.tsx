import React, { useState } from 'react';
import { Volume2, Gauge, Settings2, Scissors, MousePointer2 } from 'lucide-react';

interface ClipProperties {
    id: string;
    volume: number;
    playbackRate: number;
}

interface UtilityPanelProps {
    selectedItemId: string | null;
    properties: ClipProperties | null;
    onUpdate: (id: string, data: Partial<ClipProperties>) => void;
    activeTool: 'cursor' | 'split';
    onToolChange: (tool: 'cursor' | 'split') => void;
}

export const UtilityPanel: React.FC<UtilityPanelProps> = ({
    selectedItemId,
    properties,
    onUpdate,
    activeTool,
    onToolChange
}) => {
    const [activeTab, setActiveTab] = useState<'properties' | 'tools'>('properties');

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (selectedItemId) {
            onUpdate(selectedItemId, { volume: parseFloat(e.target.value) });
        }
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (selectedItemId) {
            onUpdate(selectedItemId, { playbackRate: parseFloat(e.target.value) });
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-925">
            {/* Header / Tabs */}
            <div className="h-14 border-b border-zinc-900 flex items-center px-4 bg-zinc-950/30 gap-4">
                <button
                    onClick={() => setActiveTab('properties')}
                    className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 pb-5 pt-5 border-b-2 transition-colors ${activeTab === 'properties' ? 'text-white border-indigo-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                >
                    <Settings2 size={14} /> Properties
                </button>
                <button
                    onClick={() => setActiveTab('tools')}
                    className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 pb-5 pt-5 border-b-2 transition-colors ${activeTab === 'tools' ? 'text-white border-indigo-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                >
                    <Settings2 size={14} className="rotate-45" /> Utility
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'properties' ? (
                    selectedItemId && properties ? (
                        <div className="space-y-8">
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
                    ) : (
                        <div className="flex flex-col items-center justify-center text-zinc-600 space-y-4 py-8 text-center opacity-50">
                            <Settings2 size={32} />
                            <p className="text-xs">Select a clip to view properties</p>
                        </div>
                    )
                ) : (
                    /* Tools Tab */
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block mb-2">
                                Mode
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => onToolChange('cursor')}
                                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${activeTool === 'cursor'
                                        ? 'bg-zinc-800 border-indigo-500 text-indigo-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                                        }`}
                                >
                                    <MousePointer2 size={20} />
                                    <span className="text-xs font-bold">Select</span>
                                </button>

                                <button
                                    onClick={() => onToolChange('split')}
                                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${activeTool === 'split'
                                        ? 'bg-zinc-800 border-indigo-500 text-indigo-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                                        }`}
                                >
                                    <Scissors size={20} />
                                    <span className="text-xs font-bold">Split</span>
                                </button>
                            </div>

                            <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                                {activeTool === 'split'
                                    ? "Splitting Mode active. Click on any clip in the timeline to split it at that exact point."
                                    : "Selection Mode active. Click, drag and move clips normally."}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
