import React, { useState } from 'react';
import {
    PanelLeftClose,
    PanelRightClose,
    PanelLeftOpen,
    PanelRightOpen,
    Maximize2,
    Minimize2,
    LayoutTemplate
} from 'lucide-react';

interface EditorLayoutProps {
    library: React.ReactNode;
    player: React.ReactNode;
    timeline: React.ReactNode;
    properties: React.ReactNode;
    isLibraryVisible: boolean;
    setIsLibraryVisible: (visible: boolean) => void;
    isPropertiesVisible: boolean;
    setIsPropertiesVisible: (visible: boolean) => void;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({
    library,
    player,
    timeline,
    properties,
    isLibraryVisible,
    setIsLibraryVisible,
    isPropertiesVisible,
    setIsPropertiesVisible,
}) => {
    // Default to showing the timeline
    const [isTimelineVisible, setIsTimelineVisible] = useState(true);

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden font-sans selection:bg-indigo-500/30">
            {/* Main Content Grid */}
            <div className="flex-1 flex min-h-0">

                {/* Left: Library */}
                {isLibraryVisible && library && (
                    <div className="w-[300px] flex-shrink-0 border-r border-zinc-900 bg-zinc-925 flex flex-col z-20">
                        {library}
                    </div>
                )}

                {/* Center: Combined Player & Timeline */}
                <div className="flex-1 flex flex-col min-w-0 bg-black relative">

                    {/* Toolbar (Global Controls) */}
                    <div className="h-10 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-30">
                        {/* Left Toggle */}
                        <button
                            onClick={() => setIsLibraryVisible(!isLibraryVisible)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title={isLibraryVisible ? "Hide Library" : "Show Library"}
                        >
                            {isLibraryVisible ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                        </button>

                        {/* View Controls */}
                        <div className="flex items-center gap-2 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                            <button
                                onClick={() => setIsTimelineVisible(true)}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${isTimelineVisible
                                        ? 'bg-zinc-700 text-white shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <LayoutTemplate size={12} /> Split View
                            </button>
                            <button
                                onClick={() => setIsTimelineVisible(false)}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${!isTimelineVisible
                                        ? 'bg-zinc-700 text-white shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                {isTimelineVisible ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                                {isTimelineVisible ? 'Expand Player' : 'Player Only'}
                            </button>
                        </div>

                        {/* Right Toggle */}
                        <button
                            onClick={() => setIsPropertiesVisible(!isPropertiesVisible)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title={isPropertiesVisible ? "Hide Inspector" : "Show Inspector"}
                        >
                            {isPropertiesVisible ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                        </button>
                    </div>

                    {/* Content Stack */}
                    <div className="flex-1 flex flex-col min-h-0">

                        {/* TOP: Player Area */}
                        <div className="flex-1 relative bg-black border-b border-zinc-900 overflow-hidden">
                            <div className="absolute inset-0">
                                {player}
                            </div>
                        </div>

                        {/* BOTTOM: Timeline Area */}
                        {isTimelineVisible && (
                            <div className="h-[320px] shrink-0 bg-zinc-900/50 flex flex-col relative z-10 border-t border-zinc-800 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
                                {timeline}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Properties */}
                {isPropertiesVisible && properties && (
                    <div className="w-[300px] flex-shrink-0 border-l border-zinc-900 bg-zinc-925 flex flex-col z-20">
                        {properties}
                    </div>
                )}
            </div>
        </div>
    );
};