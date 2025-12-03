import React from 'react';
import { Handle, Position, type NodeProps, type Node, useReactFlow } from '@xyflow/react';
import { Music, X } from 'lucide-react';

export type AudioNodeData = {
    label: string;
    url: string;
    duration: number;
    startOffset: number;
    endOffset: number;
};

export type AudioNodeType = Node<AudioNodeData>;

// Helper format function
const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const AudioNode = ({ id, data, selected }: NodeProps<AudioNodeType>) => {
    const { setNodes } = useReactFlow();
    const duration = data.duration;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
    };

    return (
        <div className="relative group w-[240px] transition-all duration-300">
            {/* Optional Target Handle for chaining/mixing */}
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity"
            />

            <div className={`
                flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg border overflow-hidden relative
                ${selected
                    ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                    : 'border-white/10 hover:border-white/20 shadow-lg'
                }
            `}>
                {/* Audio Waveform/Icon Graphic */}
                <div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-500">
                    <Music size={20} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-200 truncate pr-4" title={data.label}>
                        {data.label}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 rounded">
                            AUDIO
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>

                {/* Delete Action */}
                <button
                    onClick={handleDelete}
                    className="absolute top-1 right-1 p-1 text-slate-600 hover:text-red-500 hover:bg-white/5 rounded opacity-0 group-hover:opacity-100 transition-all"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Visual bottom bar representing length/track */}
            <div className="h-1 w-full bg-emerald-500/30 mt-1 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-full opacity-50" />
            </div>

            {/* Source Handle (Connects to Output Audio In) */}
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-emerald-500 !w-4 !h-4 !rounded-full !border-4 !border-[#1a1a1a] !-right-2 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50"
            />
        </div>
    );
};