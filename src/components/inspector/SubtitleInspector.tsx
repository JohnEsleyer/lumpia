import React, { useEffect, useRef, useState } from 'react';
import { Type, Move, Scaling, List, Palette, Clock, Trash2, Plus } from 'lucide-react';
import { SUBTITLE_STYLES, type SubtitleStyleId } from '../subtitle-styles';
import type { SubtitleItem } from '../../types';
import type { SubtitleSettings } from '../SubtitleComposition';

interface SubtitleInspectorProps {
    subtitles: SubtitleItem[];
    styleId: SubtitleStyleId;
    settings: SubtitleSettings;
    currentTime: number;
    onUpdateStyle: (style: SubtitleStyleId) => void;
    onUpdateSettings: (settings: Partial<SubtitleSettings>) => void;
    onUpdateSubtitles: (subtitles: SubtitleItem[]) => void;
    onSeek: (time: number) => void;
}

export const SubtitleInspector: React.FC<SubtitleInspectorProps> = ({
    subtitles,
    styleId,
    settings,
    currentTime,
    onUpdateStyle,
    onUpdateSettings,
    onUpdateSubtitles,
    onSeek
}) => {
    const [activeTab, setActiveTab] = useState<'design' | 'edit'>('design');
    const activeSubtitleRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active subtitle in Edit mode
    useEffect(() => {
        if (activeTab === 'edit' && activeSubtitleRef.current) {
            activeSubtitleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentTime, activeTab]);

    const handleTextChange = (id: string, newText: string) => {
        const newSubs = subtitles.map(s => s.id === id ? { ...s, text: newText } : s);
        onUpdateSubtitles(newSubs);
    };

    const handleDelete = (id: string) => {
        const newSubs = subtitles.filter(s => s.id !== id);
        onUpdateSubtitles(newSubs);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full bg-[#0f0f0f] border-t border-white/5">
            {/* --- Tab Switcher --- */}
            <div className="flex items-center p-2 gap-2 border-b border-white/5 bg-[#0a0a0a]">
                <button
                    onClick={() => setActiveTab('design')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'design' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}
                >
                    <Palette size={12} /> Design
                </button>
                <button
                    onClick={() => setActiveTab('edit')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'edit' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}
                >
                    <List size={12} /> Edit ({subtitles.length})
                </button>
            </div>

            {/* --- Content Area --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">

                {/* DESIGN TAB */}
                {activeTab === 'design' && (
                    <div className="p-4 flex flex-col gap-6 animate-in slide-in-from-left-2 duration-200">
                        {/* Style Presets */}
                        <div>
                            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <Type size={12} /> Style Preset
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(SUBTITLE_STYLES).map(([key, config]) => {
                                    const isSelected = styleId === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => onUpdateStyle(key as SubtitleStyleId)}
                                            className={`
                                                relative h-20 rounded-xl border-2 transition-all overflow-hidden group
                                                ${isSelected
                                                    ? 'border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                                    : 'border-white/5 hover:border-white/20'
                                                }
                                            `}
                                        >
                                            {/* Background Preview */}
                                            <div className={`absolute inset-0 ${config.bg} opacity-50 group-hover:opacity-70 transition-opacity`} />

                                            {/* Text Preview */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className={`text-xl font-black ${isSelected ? 'scale-110' : 'scale-100'} transition-transform duration-300`}
                                                    style={{
                                                        color: key === 'classic' ? '#FFD700' : 'white',
                                                        textShadow: key === 'neon' ? '0 0 10px white' : '2px 2px 0 black'
                                                    }}>
                                                    {config.text}
                                                </span>
                                            </div>

                                            {/* Label */}
                                            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/60 backdrop-blur-sm text-[9px] font-bold text-slate-300 text-center uppercase tracking-wider">
                                                {config.label}
                                            </div>

                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_5px_cyan]" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Position & Scale */}
                        <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/5">
                            <div>
                                <div className="flex items-center justify-between mb-2 text-[10px] font-bold text-slate-500 uppercase">
                                    <span className="flex items-center gap-1"><Move size={10} /> Vertical Position</span>
                                    <span className="text-cyan-400 font-mono">{settings.y}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="100"
                                    value={settings.y}
                                    onChange={(e) => onUpdateSettings({ y: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2 text-[10px] font-bold text-slate-500 uppercase">
                                    <span className="flex items-center gap-1"><Scaling size={10} /> Scale Size</span>
                                    <span className="text-cyan-400 font-mono">{settings.scale.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range" min="0.5" max="3.0" step="0.1"
                                    value={settings.scale}
                                    onChange={(e) => onUpdateSettings({ scale: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* EDIT TAB */}
                {activeTab === 'edit' && (
                    <div className="p-2 flex flex-col gap-2 animate-in slide-in-from-right-2 duration-200 pb-10">
                        {subtitles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-600 opacity-50">
                                <List size={32} className="mb-2" />
                                <span className="text-xs">No subtitles found</span>
                            </div>
                        ) : (
                            subtitles.map((sub, idx) => {
                                const isActive = currentTime >= sub.start && currentTime < sub.end;
                                return (
                                    <div
                                        key={sub.id}
                                        ref={isActive ? activeSubtitleRef : null}
                                        className={`
                                            group relative flex gap-3 p-3 rounded-xl border transition-all duration-200
                                            ${isActive
                                                ? 'bg-cyan-950/20 border-cyan-500/40 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]'
                                                : 'bg-[#151515] border-white/5 hover:border-white/10 hover:bg-[#1a1a1a]'
                                            }
                                        `}
                                        onClick={() => onSeek(sub.start)}
                                    >
                                        {/* Active Indicator Line */}
                                        {isActive && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-cyan-500 rounded-r-full shadow-[0_0_10px_cyan]" />
                                        )}

                                        {/* Index & Time */}
                                        <div className="flex flex-col items-center gap-1 pt-1 shrink-0 w-8">
                                            <span className={`text-[10px] font-black ${isActive ? 'text-cyan-500' : 'text-slate-600'}`}>
                                                {(idx + 1).toString().padStart(2, '0')}
                                            </span>
                                            <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-cyan-500 animate-pulse' : 'bg-slate-800'}`} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 bg-black/20 px-1.5 py-0.5 rounded">
                                                    <Clock size={10} />
                                                    <span>{formatTime(sub.start)}</span>
                                                    <span className="text-slate-700">→</span>
                                                    <span>{formatTime(sub.end)}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(sub.id); }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                                    title="Delete Line"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>

                                            <textarea
                                                value={sub.text}
                                                onChange={(e) => handleTextChange(sub.id, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className={`
                                                    w-full bg-transparent text-xs resize-none leading-relaxed p-0 border-none focus:ring-0
                                                    ${isActive ? 'text-white font-medium' : 'text-slate-400'}
                                                    placeholder:text-slate-700
                                                `}
                                                rows={2}
                                                spellCheck={false}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Add Button Placeholder (Future) */}
                        <div className="border border-dashed border-white/5 rounded-xl p-2 flex items-center justify-center text-slate-700 hover:text-slate-500 hover:border-white/10 cursor-pointer transition-colors">
                            <Plus size={14} className="mr-2" />
                            <span className="text-[10px] font-bold uppercase">Add Subtitle Line</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
