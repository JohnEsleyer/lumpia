import { createRootRoute, Outlet, Link, useLocation } from '@tanstack/react-router'
import { useState } from 'react'
import { Home, Scissors, Clapperboard, MessageSquare, ChevronLeft, ChevronRight, Menu } from 'lucide-react'

export const Route = createRootRoute({
    component: RootLayout,
})

function RootLayout() {
    const { pathname, search } = useLocation();
    const pathMatch = pathname.match(/\/project\/([^\/]+)/);
    const searchParams = new URLSearchParams(search);
    const projectId = pathMatch?.[1] || searchParams.get('projectId');

    // Default to collapsed for focused editing, or expanded for dashboard
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navItems = [
        { to: '/', icon: <Home size={20} />, label: 'Dashboard', requiresProject: false },
        { to: '/cutter', icon: <Scissors size={20} />, label: 'Cutter', requiresProject: true },
        { to: '/editor', icon: <Clapperboard size={20} />, label: 'Editor', requiresProject: true },
        { to: '/subtitles', icon: <MessageSquare size={20} />, label: 'Subtitles', requiresProject: true },
    ];

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#050505] text-slate-200 font-sans selection:bg-yellow-500/30">
            {/* Sidebar */}
            <aside
                className={`
                    relative border-r border-white/5 bg-[#0a0a0a] flex flex-col shrink-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]
                    ${isCollapsed ? 'w-16' : 'w-20 lg:w-64'}
                `}
            >
                {/* Collapse Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-7 z-50 bg-[#1a1a1a] border border-white/10 text-slate-400 hover:text-white rounded-full p-1 shadow-xl hover:scale-110 transition-all"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? (
                        <ChevronRight size={12} />
                    ) : (
                        <ChevronLeft size={12} />
                    )}
                </button>

                {/* Logo Area */}
                <div className={`p-4 flex items-center gap-3 mb-2 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center text-black font-black text-xl shadow-[0_0_15px_rgba(234,179,8,0.2)] shrink-0">
                        L
                    </div>
                    {!isCollapsed && (
                        <div className="hidden lg:block overflow-hidden whitespace-nowrap animate-in fade-in duration-300">
                            <h1 className="font-bold text-lg text-white tracking-tight leading-none">Lumpia</h1>
                            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Studio</span>
                        </div>
                    )}
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 px-2 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.to;
                        const isDisabled = item.requiresProject && !projectId;
                        const to = item.requiresProject && projectId ? `${item.to}?projectId=${projectId}` : item.to;

                        return (
                            <Link
                                key={item.to}
                                to={to}
                                disabled={isDisabled}
                                title={isCollapsed ? item.label : undefined}
                                className={`
                                    flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group relative overflow-hidden
                                    ${isActive
                                        ? 'bg-white/5 text-yellow-400 font-bold shadow-inner'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }
                                    ${isDisabled ? 'opacity-30 pointer-events-none grayscale' : ''}
                                    ${isCollapsed ? 'justify-center' : ''}
                                `}
                            >
                                <span className={`shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
                                {!isCollapsed && <span className="hidden lg:block whitespace-nowrap text-sm">{item.label}</span>}

                                {/* Active Indicator Bar */}
                                {isActive && !isCollapsed && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-yellow-500 rounded-r-full" />
                                )}
                            </Link>
                        )
                    })}
                </nav>

                {/* Bottom Status Area */}
                {!isCollapsed && (
                    <div className="p-4 hidden lg:block animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-[#0f0f0f] rounded-lg p-3 border border-white/5">
                            <div className="flex items-center justify-between mb-1">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System</div>
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                                Engine Ready
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden flex flex-col relative bg-[#050505] shadow-[inset_10px_0_30px_-10px_rgba(0,0,0,0.5)]">
                <Outlet />
            </main>
        </div>
    )
}