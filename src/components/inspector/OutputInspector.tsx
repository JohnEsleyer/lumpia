import React from 'react';
import { FlaskConical, Loader2, Download, Play, RotateCcw, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface OutputInspectorProps {
    nodeId: string;
    isProcessing?: boolean;
    processedUrl?: string;
    onProcess: () => void;
}

export const OutputInspector: React.FC<OutputInspectorProps> = ({
    nodeId,
    isProcessing,
    processedUrl,
    onProcess
}) => {

    const handleDownload = () => {
        if (!processedUrl) return;
        const a = document.createElement('a');
        a.href = `http://localhost:3001${processedUrl}`;
        a.download = `render_${nodeId.slice(0, 8)}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5 relative">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FlaskConical size={14} /> Output Renderer
                </h2>
            </div>

            <div className="flex-1 flex flex-col relative overflow-hidden">

                {/* Preview Area */}
                <div className="flex-1 bg-black/40 relative flex items-center justify-center p-6">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10"
                        style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                    />

                    {processedUrl ? (
                        <div className="w-full h-full flex flex-col relative shadow-2xl rounded-lg overflow-hidden border border-white/10 bg-black">
                            <video
                                src={`http://localhost:3001${processedUrl}`}
                                controls
                                className="w-full h-full object-contain"
                                autoPlay
                            />
                            {isProcessing && (
                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-20">
                                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                                    <span className="text-sm font-bold text-slate-200">Re-Processing...</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center space-y-4">
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 border-dashed transition-all duration-500
                                ${isProcessing
                                    ? 'border-purple-500/50 bg-purple-500/10 animate-pulse'
                                    : 'border-slate-700 bg-slate-800/30'
                                }`}>
                                {isProcessing ? (
                                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                                ) : (
                                    <FlaskConical className="w-10 h-10 text-slate-600" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-slate-200">
                                    {isProcessing ? 'Rendering Sequence...' : 'Ready to Render'}
                                </h3>
                                <p className="text-xs text-slate-500 max-w-[200px] mx-auto">
                                    {isProcessing
                                        ? 'Stitching clips and mixing audio. This may take a moment.'
                                        : 'Connect clips to the Video Input handle to start.'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="p-6 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 space-y-4 z-20">

                    {processedUrl && !isProcessing && (
                        <div className="flex items-center gap-2 text-xs text-green-400 font-mono bg-green-500/10 p-2 rounded border border-green-500/20 mb-2">
                            <CheckCircle size={12} />
                            <span>Render Complete successfully.</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                        {!isProcessing ? (
                            <>
                                <Button
                                    onClick={onProcess}
                                    className={`w-full h-10 shadow-lg font-bold flex items-center justify-center gap-2
                                        ${processedUrl
                                            ? 'bg-slate-700 hover:bg-slate-600 border border-white/10'
                                            : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                                        }`}
                                >
                                    {processedUrl ? <RotateCcw size={16} /> : <Play size={16} fill="currentColor" />}
                                    {processedUrl ? 'Re-Process Sequence' : 'Process Sequence'}
                                </Button>

                                {processedUrl && (
                                    <Button
                                        onClick={handleDownload}
                                        className="w-full h-10 bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 flex items-center justify-center gap-2"
                                    >
                                        <Download size={16} /> Download MP4
                                    </Button>
                                )}
                            </>
                        ) : (
                            <Button disabled className="w-full h-10 bg-purple-600/50 cursor-not-allowed text-white/50 flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" /> Rendering...
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};