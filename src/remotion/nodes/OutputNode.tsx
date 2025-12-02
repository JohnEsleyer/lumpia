import React, { useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Button } from '../../components/ui/Button';

// We define the specific data shape for an Output Node
export type OutputNodeData = {
    label: string;
    processedUrl?: string;
    isProcessing?: boolean;
    onProcess?: (nodeId: string) => void;
};

export type OutputNodeType = Node<OutputNodeData>;

export const OutputNode = ({ id, data, selected }: NodeProps<OutputNodeType>) => {
    return (
        <div className={`
            relative w-[280px] bg-[#1a1a1a] rounded-xl border-2 transition-all duration-300 flex flex-col overflow-hidden shadow-2xl
            ${selected ? 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'border-slate-800 hover:border-slate-600'}
        `}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900/50 to-slate-900 p-3 border-b border-white/5 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] animate-pulse" />
                <span className="font-bold text-slate-200 text-sm tracking-wide">Output / Render</span>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-4 bg-black/40 relative">

                {/* Visual Background Pattern */}
                <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '12px 12px' }}
                />

                <div className="relative z-10 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        <div className="w-2 h-2 rounded-full bg-blue-500/50" /> Video Input
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/50" /> Audio Input
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-center mt-2">
                    {data.processedUrl ? (
                        <div className="w-full text-center">
                            <div className="text-xs text-green-400 font-bold mb-2 flex items-center justify-center gap-1">
                                <span>✓</span> Ready to Preview
                            </div>
                            <Button
                                onClick={() => data.onProcess?.(id)}
                                isLoading={data.isProcessing}
                                className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 border border-white/10"
                            >
                                Re-Process
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={() => data.onProcess?.(id)}
                            isLoading={data.isProcessing}
                            className="w-full h-10 bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20 text-xs font-bold"
                        >
                            Process Sequence
                        </Button>
                    )}
                </div>
            </div>

            {/* Inputs */}
            {/* Video Input (Top-Left) */}
            <div className="absolute left-0 top-[35%] -translate-x-1/2 flex items-center group/handle">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="video-in"
                    className="!w-4 !h-4 !bg-blue-500 !border-2 !border-[#1a1a1a] transition-transform group-hover/handle:scale-125"
                />
                <span className="absolute left-6 text-[9px] font-bold text-blue-500 opacity-0 group-hover/handle:opacity-100 transition-opacity bg-black/80 px-1 rounded pointer-events-none">VIDEO</span>
            </div>

            {/* Audio Input (Bottom-Left) */}
            <div className="absolute left-0 top-[65%] -translate-x-1/2 flex items-center group/handle">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="audio-in"
                    className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-[#1a1a1a] transition-transform group-hover/handle:scale-125"
                />
                <span className="absolute left-6 text-[9px] font-bold text-emerald-500 opacity-0 group-hover/handle:opacity-100 transition-opacity bg-black/80 px-1 rounded pointer-events-none">AUDIO</span>
            </div>

            {/* Optional Output Handle (Right) - In case we want to chain outputs later */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-slate-600 !border-2 !border-[#1a1a1a]"
            />
        </div>
    );
};