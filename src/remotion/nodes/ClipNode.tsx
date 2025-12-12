import React, { useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node, useReactFlow } from '@xyflow/react';
import { X, Loader2 } from 'lucide-react';

export type ClipNodeData = {
    label: string;
    url: string;
    filmstrip: string[];
    thumbnailUrl?: string;
    sourceDuration: number;
    startOffset: number;
    endOffset: number;
    isPlaying?: boolean;
    volume?: number;
    playbackRate?: number;
};

export type ClipNodeType = Node<ClipNodeData>;

const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
};

export const ClipNode = ({ id, data, selected }: NodeProps<ClipNodeType>) => {
    const { setNodes } = useReactFlow();
    const duration = data.endOffset - data.startOffset;

    const thumbnails = useMemo(() => {
        if (!data.filmstrip || data.filmstrip.length === 0) {
            if (data.thumbnailUrl) return [data.thumbnailUrl];
            return [];
        }

        // If we have very few frames, just return them
        if (data.filmstrip.length <= 5) return data.filmstrip;

        // Calculate indices based on startOffset and endOffset
        const totalFrames = data.filmstrip.length;
        const sourceDuration = data.sourceDuration || 10;

        // Ensure offsets are within bounds
        const start = Math.max(0, data.startOffset);
        const end = Math.min(sourceDuration, data.endOffset);

        const startIndex = Math.floor((start / sourceDuration) * totalFrames);
        const endIndex = Math.ceil((end / sourceDuration) * totalFrames);

        // Get the slice of frames relevant to the trimmed section
        const safeStartIndex = Math.max(0, Math.min(startIndex, totalFrames - 1));
        const safeEndIndex = Math.max(safeStartIndex + 1, Math.min(endIndex, totalFrames));

        const relevantFrames = data.filmstrip.slice(safeStartIndex, safeEndIndex);

        if (relevantFrames.length === 0) return [data.filmstrip[safeStartIndex] || data.filmstrip[0]];

        // Sample 5 frames from the relevant frames
        if (relevantFrames.length <= 5) return relevantFrames;

        const step = (relevantFrames.length - 1) / 4;
        const result = [];
        for (let i = 0; i < 5; i++) {
            const index = Math.round(i * step);
            result.push(relevantFrames[index]);
        }
        return result;
    }, [data.filmstrip, data.thumbnailUrl, data.startOffset, data.endOffset, data.sourceDuration]);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
    };

    return (
        <div className="relative group w-[300px]">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-yellow-500 !w-6 !h-6 !rounded-full !border-4 !border-[#1a1a1a] !-left-3 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50"
            />
            <div className={`flex flex-col w-full bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 ${selected ? 'ring-2 ring-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-[1.02]' : 'ring-1 ring-white/10 shadow-xl hover:ring-white/30'} ${data.isPlaying ? 'ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : ''}`}>
                <div className="px-3 py-2 bg-[#111] flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                        <span className="text-xs font-medium text-slate-300 truncate max-w-[180px]">{data.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500">{formatTime(duration)}</span>
                        <button onClick={handleDelete} className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-white/5" title="Delete Clip">
                            <X size={12} />
                        </button>
                    </div>
                </div>
                <div className="h-24 bg-[#000] relative flex overflow-hidden">
                    {thumbnails.length > 0 ? (
                        <div className="flex w-full h-full">
                            {thumbnails.map((thumb, i) => (
                                <div key={i} className="flex-1 border-r border-black/20 last:border-none overflow-hidden relative">
                                    <img src={`http://localhost:3001${thumb}`} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" alt={`frame-${i}`} draggable={false} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-2">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-[10px]">Processing...</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
                    <div className="absolute bottom-1 left-2 font-mono text-[9px] text-white/70">IN: {formatTime(data.startOffset)}</div>
                    <div className="absolute bottom-1 right-2 font-mono text-[9px] text-white/70">OUT: {formatTime(data.endOffset)}</div>
                </div>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-yellow-500 !w-6 !h-6 !rounded-full !border-4 !border-[#1a1a1a] !-right-3 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50"
            />
        </div>
    );
};
