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
            relative min-w-[220px] bg-[#0a0a0a] rounded-xl border-2 transition-all duration-300 flex flex-col overflow-visible shadow-2xl group
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
            <div className="p-4 bg-black/80 relative min-h-[80px] flex flex-col justify-center rounded-b-lg">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none rounded-b-lg overflow-hidden"
                    style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '12px 12px' }}
                />

                <div className="relative z-10">
                    {data.isProcessing ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-1">
                            <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
                            <span className="text-[10px] font-mono text-yellow-500 animate-pulse">RENDERING...</span>
                        </div>
                    ) : data.processedUrl ? (
                        <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
                            <div className="flex items-center justify-center gap-2 text-green-400 text-[10px] font-bold bg-green-950/30 p-2 rounded border border-green-500/20">
                                <CheckCircle2 size={14} />
                                <span>Ready for Download</span>
                            </div>
                            <Button
                                onClick={handleProcessClick}
                                className="w-full h-8 text-[10px] bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 transition-colors"
                            >
                                <RefreshCw size={12} className="mr-1.5" /> Re-Render
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-[10px] text-slate-500 text-center italic">Connect video & audio clips</div>
                            <Button
                                onClick={handleProcessClick}
                                className="w-full h-9 bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20 text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Play size={12} className="mr-1.5 fill-white" /> Render Video
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- HANDLERS (Left Side) --- */}
            <div className="absolute -left-3 top-8 flex items-center group/handle z-50">
                <div className="relative">
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="video-in"
                        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-[#0a0a0a] hover:!bg-white hover:!scale-125 transition-all cursor-crosshair shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    />
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/90 text-blue-400 text-[9px] font-bold px-2 py-1 rounded border border-blue-500/30 opacity-0 group-hover/handle:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        VIDEO SEQUENCE
                    </div>
                </div>
            </div>

            <div className="absolute -left-3 top-20 flex items-center group/handle z-50">
                <div className="relative">
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="audio-in"
                        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-[#0a0a0a] hover:!bg-white hover:!scale-125 transition-all cursor-crosshair shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    />
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/90 text-emerald-400 text-[9px] font-bold px-2 py-1 rounded border border-emerald-500/30 opacity-0 group-hover/handle:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        AUDIO MIX
                    </div>
                </div>
            </div>
        </div>
    );
};