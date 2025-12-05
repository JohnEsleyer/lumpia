import React from 'react';
import { Handle, Position, type NodeProps, type Node, useReactFlow } from '@xyflow/react';
import { Button } from '../../components/ui/Button';
import { X, Loader2, Play, RefreshCw, CheckCircle2, Video, Music } from 'lucide-react';

export type RenderNodeData = {
    label: string;
    processedUrl?: string;
    isProcessing?: boolean;
    onProcess?: (nodeId: string) => void;
};

export type RenderNodeType = Node<RenderNodeData>;

export const RenderNode = ({ id, data, selected }: NodeProps<RenderNodeType>) => {
    const { setNodes } = useReactFlow();

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
    };

    const handleProcessClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.onProcess) {
            data.onProcess(id);
        }
    };

    return (
        <div className={`
            relative min-w-[200px] bg-[#0a0a0a] rounded-xl border-2 transition-all duration-300 flex flex-col shadow-2xl group
            ${selected ? 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.3)]' : 'border-slate-800 hover:border-slate-600'}
        `}>
            {/* Header */}
            <div className="bg-[#111] p-3 border-b border-white/5 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${data.isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-purple-500'} shadow-[0_0_8px_currentColor]`} />
                    <span className="font-bold text-slate-200 text-xs tracking-wider uppercase">Final Render</span>
                </div>
                <button
                    onClick={handleDelete}
                    className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                    title="Delete Node"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 bg-black/80 relative min-h-[100px] flex flex-col justify-center rounded-b-lg gap-4">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none rounded-b-lg overflow-hidden"
                    style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '12px 12px' }}
                />

                {/* Connection Indicators (Visual Only - helps identifying where to connect) */}
                <div className="space-y-4 z-10 pl-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <Video size={12} className="text-blue-500" />
                        <span>VIDEO IN</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <Music size={12} className="text-emerald-500" />
                        <span>AUDIO IN</span>
                    </div>
                </div>

                <div className="relative z-10 mt-2">
                    {data.isProcessing ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-1">
                            <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
                            <span className="text-[10px] font-mono text-yellow-500 animate-pulse">RENDERING...</span>
                        </div>
                    ) : data.processedUrl ? (
                        <div className="flex flex-col gap-2 animate-in fade-in zoom-in duration-300">
                            <div className="flex items-center justify-center gap-2 text-green-400 text-[10px] font-bold bg-green-950/30 p-2 rounded border border-green-500/20">
                                <CheckCircle2 size={14} />
                                <span>Ready</span>
                            </div>
                            <Button
                                onClick={handleProcessClick}
                                className="w-full h-7 text-[10px] bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300"
                            >
                                <RefreshCw size={10} className="mr-1.5" /> Retry
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={handleProcessClick}
                            className="w-full h-8 bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20 text-[10px] font-bold uppercase tracking-wide"
                        >
                            <Play size={10} className="mr-1.5 fill-white" /> Render
                        </Button>
                    )}
                </div>
            </div>

            {/* --- INPUT HANDLES --- */}

            {/* Video Input (Top-Left) - Blue */}
            <div className="absolute -left-3 top-[65px] z-50">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="video-in"
                    className="!w-4 !h-4 !bg-blue-500 !border-2 !border-[#0a0a0a] hover:!bg-white hover:!scale-125 transition-all cursor-crosshair shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                />
            </div>

            {/* Audio Input (Bottom-Left) - Green */}
            <div className="absolute -left-3 top-[95px] z-50">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="audio-in"
                    className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-[#0a0a0a] hover:!bg-white hover:!scale-125 transition-all cursor-crosshair shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
            </div>
        </div>
    );
};