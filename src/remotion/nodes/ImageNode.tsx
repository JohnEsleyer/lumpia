// src/remotion/nodes/ImageNode.tsx
import React from 'react';
import { Handle, Position, type NodeProps, type Node, useReactFlow } from '@xyflow/react';
import { Image as ImageIcon, X, Clock } from 'lucide-react';

export type ImageNodeData = {
    label: string;
    url: string;
    duration: number; // Duration in seconds
};

export type ImageNodeType = Node<ImageNodeData>;

export const ImageNode = ({ id, data, selected }: NodeProps<ImageNodeType>) => {
    const { setNodes } = useReactFlow();

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
    };

    return (
        <div className="relative group w-[200px] transition-all duration-300">
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-purple-500 !w-3 !h-3 !border-2 !border-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity"
            />

            <div className={`
                flex flex-col bg-[#1a1a1a] rounded-lg overflow-hidden border transition-all
                ${selected
                    ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                    : 'border-white/10 hover:border-white/20 shadow-lg'
                }
            `}>
                {/* Header */}
                <div className="px-3 py-2 bg-[#111] flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <ImageIcon size={12} className="text-purple-400 shrink-0" />
                        <span className="text-xs font-medium text-slate-300 truncate">{data.label}</span>
                    </div>
                    <button
                        onClick={handleDelete}
                        className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-white/5"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* Image Preview */}
                <div className="h-28 bg-black relative group/preview">
                    <img
                        src={data.url}
                        alt={data.label}
                        className="w-full h-full object-cover opacity-80 group-hover/preview:opacity-100 transition-opacity"
                        draggable={false}
                    />

                    {/* Duration Badge */}
                    <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-md text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-1">
                        <Clock size={8} />
                        {data.duration}s
                    </div>
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-purple-500 !w-4 !h-4 !rounded-full !border-4 !border-[#1a1a1a] !-right-2 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50"
            />
        </div>
    );
};