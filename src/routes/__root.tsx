import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { Clapperboard } from 'lucide-react'

export const Route = createRootRoute({
    component: () => (
        <>
            <div className="flex bg-black text-white h-screen overflow-hidden">
                {/* Sidebar */}
                <div className="w-16 bg-[#0a0a0a] border-r border-white/5 flex flex-col items-center py-4 gap-6 shrink-0 z-50">
                    <Link to="/" className="text-white hover:text-indigo-400 transition-colors">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Clapperboard size={20} className="text-white" />
                        </div>
                    </Link>
                    {/* Add more nav items if needed */}
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <Outlet />
                </div>
            </div>
        </>
    ),
})