// src/components/inspector/ImageInspector.tsx
import React from 'react';
import { Clock, Trash2, Image as LucideImage } from 'lucide-react';
import { Button } from '../ui/Button';

interface ImageInspectorProps {
    nodeId: string;
    data: any;
    onUpdateNode: (id: string, data: any) => void;
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({
    nodeId,
    data,
    onUpdateNode
}) => {
    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
            onUpdateNode(nodeId, { duration: val });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5">
            <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <LucideImage size={14} /> Image Properties
                </h2>
            </div>

            <div className="p-6 space-y-6">
                {/* Preview Card */}
                <div className="aspect-video w-full bg-black rounded-lg border border-white/10 overflow-hidden relative">
                    <img src={data.url} className="w-full h-full object-contain" alt="preview" />
                </div>

                <div className="space-y-4">
                    {/* Duration Control */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <span className="flex items-center gap-1"><Clock size={12} /> Duration</span>
                            <span className="text-purple-400 font-mono">{data.duration}s</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            step="0.5"
                            value={data.duration || 3}
                            onChange={handleDurationChange}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                        />
                        <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                            <span>1s</span>
                            <span>30s</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <Button
                            variant="danger"
                            className="w-full h-8 text-xs bg-red-500/5 border-red-500/20 hover:bg-red-500/10 text-red-500 justify-center"
                            onClick={() => onUpdateNode(nodeId, { ...data, deleted: true })} // Ideally this should trigger a delete handler in parent
                        >
                            <Trash2 size={12} className="mr-2" /> Remove Image
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};