import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { getProject } from '../../api'
import type { Project } from '../../types'
import { Button } from '../../components/ui/Button'

export const Route = createFileRoute('/project/$projectId')({
  component: ProjectOverview,
})

function ProjectOverview() {
  const { projectId } = Route.useParams()
  const [project, setProject] = useState<Project | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    getProject(projectId).then(setProject).catch(console.error)
  }, [projectId])

  if (!project) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 gap-4">
      <div className="w-8 h-8 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-sm font-medium animate-pulse">Loading Project Workspace...</p>
    </div>
  )

  const videoUrl = project.currentHead ? `http://localhost:3001${project.currentHead}` : null

  const tools = [
    {
      id: 'cutter',
      title: "Cutter",
      desc: "Trim & Cut",
      icon: "✂️",
      to: "/cutter",
      color: "bg-blue-500",
      gradient: "from-blue-600/20 to-blue-600/5 hover:border-blue-500/50"
    },
    {
      id: 'stitcher',
      title: "Stitcher",
      desc: "Join Clips",
      icon: "🧵",
      to: "/stitcher",
      color: "bg-purple-500",
      gradient: "from-purple-600/20 to-purple-600/5 hover:border-purple-500/50"
    },
    {
      id: 'editor',
      title: "Editor",
      desc: "Timeline",
      icon: "🎬",
      to: "/editor",
      color: "bg-orange-500",
      gradient: "from-orange-600/20 to-orange-600/5 hover:border-orange-500/50"
    },
    {
      id: 'subtitles',
      title: "Subtitles",
      desc: "Captions AI",
      icon: "💬",
      to: "/subtitles",
      color: "bg-emerald-500",
      gradient: "from-emerald-600/20 to-emerald-600/5 hover:border-emerald-500/50"
    }
  ];

  const handleExport = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `${project.name}_v${project.operations.length}.mp4`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 px-6 border-b border-white/5 flex items-center justify-between bg-slate-900/50 backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            ←
          </Link>
          <div className="h-6 w-px bg-white/10" />
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-wide">{project.name}</h1>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
              <span>{project.width}x{project.height}</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>{project.fps} FPS</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>ID: {project.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Project Active</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Split View */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Video Preview Canvas */}
        <div className="flex-1 flex flex-col relative bg-black/40 group/canvas">
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />

          <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
            <div className="relative max-w-full max-h-full aspect-video shadow-2xl rounded-lg overflow-hidden ring-1 ring-white/10 bg-black">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  poster={project.thumbnail}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                  <span className="text-5xl opacity-50">📼</span>
                  <p className="text-sm font-medium">No video generated yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Info Bar for Canvas */}
          <div className="h-8 bg-slate-900/50 border-t border-white/5 flex items-center justify-between px-4 text-[10px] text-slate-500 font-mono">
            <span>CURRENT HEAD: {project.currentHead?.split('/').pop()}</span>
            <span>PREVIEW MODE</span>
          </div>
        </div>

        {/* Right: Inspector Sidebar */}
        <aside className="w-[400px] bg-slate-900/80 border-l border-white/5 flex flex-col backdrop-blur-xl shrink-0 z-10">

          {/* Tools Section */}
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>Studio Tools</span>
              <span className="h-px flex-1 bg-white/5" />
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {tools.map((tool) => (
                <Link
                  key={tool.id}
                  to={tool.to}
                  search={{ projectId: project.id }}
                  className={`
                    group relative p-4 rounded-xl border border-white/5 bg-gradient-to-br ${tool.gradient}
                    transition-all duration-200 hover:-translate-y-1 hover:shadow-lg
                  `}
                >
                  <div className={`
                    absolute top-3 right-3 w-8 h-8 rounded-lg ${tool.color} bg-opacity-20 flex items-center justify-center
                    text-lg group-hover:scale-110 transition-transform
                  `}>
                    {tool.icon}
                  </div>
                  <div className="mt-6">
                    <h3 className="font-bold text-slate-200 group-hover:text-white transition-colors">{tool.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{tool.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* History / Operations Stack */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>Edit History</span>
              <span className="h-px flex-1 bg-white/5" />
            </h2>

            <div className="relative pl-4 space-y-0">
              {/* Vertical Line */}
              <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-800" />

              {/* Initial State */}
              <div className="relative pb-6">
                <div className="absolute -left-4 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-900 z-10" />
                <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                  <div className="text-xs font-bold text-slate-300">Project Created</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">Source: {project.assets[0] || 'Unknown'}</div>
                </div>
              </div>

              {/* Operations */}
              {project.operations.map((op, i) => (
                <div key={i} className="relative pb-6 last:pb-0">
                  <div className={`
                      absolute -left-4 w-3 h-3 rounded-full border-2 border-slate-900 z-10
                      ${i === project.operations.length - 1 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-600'}
                   `} />
                  <div className={`
                    p-3 rounded-lg border transition-colors
                    ${i === project.operations.length - 1
                      ? 'bg-blue-900/10 border-blue-500/30'
                      : 'bg-slate-800/50 border-white/5'}
                  `}>
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-white uppercase tracking-wide">{op.type}</span>
                      <span className="text-[9px] text-slate-500 font-mono">STEP {i + 1}</span>
                    </div>
                    {/* Tiny visual representation of params could go here */}
                    <div className="text-[10px] text-slate-400 mt-1 truncate">
                      ID: {op.id.slice(0, 6)}...
                    </div>
                  </div>
                </div>
              ))}

              {project.operations.length === 0 && (
                <div className="relative pt-2">
                  <p className="text-xs text-slate-600 italic pl-2">No edits applied yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Export Action */}
          <div className="p-6 border-t border-white/5 bg-slate-900/50">
            <Button
              onClick={handleExport}
              disabled={!videoUrl}
              className="w-full bg-white text-slate-900 hover:bg-slate-200 shadow-xl shadow-white/5 h-12 text-sm font-bold"
            >
              Export Final Video
            </Button>
            <p className="text-center text-[10px] text-slate-600 mt-3">
              Downloads the current head as MP4
            </p>
          </div>

        </aside>
      </div>
    </div>
  )
}
