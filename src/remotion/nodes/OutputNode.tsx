import React from 'react';
import { Handle, Position, type NodeProps, type Node, useReactFlow } from '@xyflow/react';
import { Button } from '../../components/ui/Button';
import { X, Loader2, Play, RefreshCw, CheckCircle2 } from 'lucide-react';

export type OutputNodeData = {
    label: string;
    processedUrl?: string;
    isProcessing?: boolean;
    onProcess?: (nodeId: string) => void;
};

export type OutputNodeType = Node<OutputNodeData>;

export const OutputNode = ({ id, data, selected }: NodeProps<OutputNodeType>) => {
    const { setNodes } = useReactFlow();

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
    };

    const handleProcessClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Critical: Prevent node selection event from firing immediately
        if (data.onProcess) {
            data.onProcess(id);
        } else {
            console.error("onProcess function is missing. Hydration failed.");
        }
    };

    return (
        <div className={`
            relative w-[280px] bg-[#0a0a0a] rounded-xl border-2 transition-all duration-300 flex flex-col overflow-hidden shadow-2xl
            ${selected ? 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'border-slate-800 hover:border-slate-600'}
        `}>
            {/* Header */}
            <div className="bg-[#111] p-3 border-b border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${data.isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-purple-500'} shadow-[0_0_10px_currentColor]`} />
                    <span className="font-bold text-slate-200 text-sm tracking-wide">Final Output</span>
                </div>
                <button
                    onClick={handleDelete}
                    className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-white/5"
                    title="Delete Node"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-4 bg-black relative min-h-[100px] justify-center">

                {/* Visual Background Pattern */}
                <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                />

                <div className="relative z-10 flex flex-col gap-3">
                    {data.isProcessing ? (
                        <div className="flex flex-col items-center justify-center py-2 animate-in fade-in">
                            <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mb-2" />
                            <span className="text-xs font-mono text-yellow-500">RENDER IN PROGRESS...</span>
                        </div>
                    ) : data.processedUrl ? (
                        <div className="flex flex-col gap-3 animate-in fade-in zoom-in">
                            <div className="flex items-center justify-center gap-2 text-green-500 bg-green-500/10 p-2 rounded-lg border border-green-500/20">
                                <CheckCircle2 size={16} />
                                <span className="text-xs font-bold">Render Complete</span>
                            </div>
                            <Button
                                onClick={handleProcessClick}
                                className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300"
                            >
                                <RefreshCw size={12} className="mr-2" /> Re-Process
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <div className="text-[10px] text-slate-500 text-center mb-1">
                                Connect clips to input handles
                            </div>
                            <Button
                                onClick={handleProcessClick}
                                className="w-full h-10 bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20 text-xs font-bold"
                            >
                                <Play size={14} className="mr-2 fill-white" /> Render Sequence
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Input Handles */}
            <div className="absolute -left-[9px] top-12 flex flex-col gap-6">
                {/* Video In */}
                <div className="relative group/handle flex items-center">
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="video-in"
                        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-[#1a1a1a] transition-transform group-hover/handle:scale-125 cursor-crosshair"
                    />
                    <span className="absolute left-4 text-[9px] font-bold text-blue-500 opacity-0 group-hover/handle:opacity-100 transition-opacity bg-black/90 px-1.5 py-0.5 rounded pointer-events-none border border-blue-500/30 whitespace-nowrap z-50">
                        VIDEO IN
                    </span>
                </div>

                {/* Audio In */}
                <div className="relative group/handle flex items-center">
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="audio-in"
                        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-[#1a1a1a] transition-transform group-hover/handle:scale-125 cursor-crosshair"
                    />
                    <span className="absolute left-4 text-[9px] font-bold text-emerald-500 opacity-0 group-hover/handle:opacity-100 transition-opacity bg-black/90 px-1.5 py-0.5 rounded pointer-events-none border border-emerald-500/30 whitespace-nowrap z-50">
                        AUDIO IN
                    </span>
                </div>
            </div>
        </div>
    );
};