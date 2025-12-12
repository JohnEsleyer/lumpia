import React from 'react';
import { PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen } from 'lucide-react';

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
    const [activeTab, setActiveTab] = React.useState<'player' | 'timeline'>('player');

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

                {/* Center: Tabs & Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-black relative">
                    {/* Tabs Header */}
                    <div className="h-12 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between px-4 z-30">
                        {/* Left Toggle */}
                        <button
                            onClick={() => setIsLibraryVisible(!isLibraryVisible)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title={isLibraryVisible ? "Hide Library" : "Show Library"}
                        >
                            {isLibraryVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                        </button>

                        {/* Tabs */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setActiveTab('player')}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === 'player'
                                    ? 'bg-zinc-800 text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                                    }`}
                            >
                                Player
                            </button>
                            <button
                                onClick={() => setActiveTab('timeline')}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === 'timeline'
                                    ? 'bg-zinc-800 text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                                    }`}
                            >
                                Timeline
                            </button>
                        </div>

                        {/* Right Toggle */}
                        <button
                            onClick={() => setIsPropertiesVisible(!isPropertiesVisible)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title={isPropertiesVisible ? "Hide Inspector" : "Show Inspector"}
                        >
                            {isPropertiesVisible ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 relative overflow-hidden">
                        {activeTab === 'player' ? (
                            <div className="absolute inset-0 z-10 bg-black">
                                {player}
                            </div>
                        ) : (
                            <div className="absolute inset-0 z-10 bg-zinc-900/50 flex flex-col">
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
