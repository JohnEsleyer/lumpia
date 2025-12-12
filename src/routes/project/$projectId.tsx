import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getProject } from '../../api'
import type { Project } from '../../types'
import { Button } from '../../components/ui/Button'

export const Route = createFileRoute('/project/$projectId')({
  component: ProjectOverview,
})

function ProjectOverview() {
  const { projectId } = Route.useParams()
  const [project, setProject] = useState<Project | null>(null)

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
      id: 'editor',
      title: "Editor",
      desc: "Timeline & Composition",
      icon: "🎬",
      to: "/editor",
      color: "bg-orange-500",
      gradient: "from-orange-600/20 to-orange-600/5 hover:border-orange-500/50"
    },
    {
      id: 'subtitles',
      title: "Subtitles",
      desc: "AI Captions & Styling",
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
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Project Active</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto p-8">

          {/* Project Header */}
          <div className="flex flex-col md:flex-row gap-8 mb-12 items-start">
            {/* Static Thumbnail */}
            <div className="w-full md:w-80 aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl shrink-0 relative group">
              {project.thumbnail ? (
                <img
                  src={`http://localhost:3001${project.thumbnail}`}
                  alt={project.name}
                  className="w-full h-full object-cover opacity-90"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-700">
                  <span className="text-4xl grayscale opacity-50">📼</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-3 left-3 flex gap-2">
                <span className="bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10">
                  {project.width}×{project.height}
                </span>
                <span className="bg-black/70 backdrop-blur-md text-slate-200 text-[10px] font-bold px-2 py-1 rounded border border-white/10">
                  {project.fps} FPS
                </span>
              </div>
            </div>

            {/* Info & Actions */}
            <div className="flex-1 pt-2">
              <h1 className="text-4xl font-black text-white mb-4 tracking-tight">{project.name}</h1>
              <div className="flex flex-wrap gap-6 text-sm text-slate-400 font-mono mb-8 border-b border-white/5 pb-8">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">Created</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">ID</span>
                  <span>{project.id.slice(0, 8)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">Assets</span>
                  <span>{project.assets.length} Files</span>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleExport}
                  disabled={!videoUrl}
                  className="bg-white text-slate-900 hover:bg-slate-200 shadow-xl shadow-white/5 px-6 py-3 h-auto text-sm font-bold"
                >
                  {videoUrl ? 'Download Video' : 'No Video Generated'}
                </Button>
              </div>
            </div>
          </div>

          {/* Tools Section */}
          <div className="mb-16">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">🛠️</span>
              Select Tool
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tools.map((tool) => (
                <Link
                  key={tool.id}
                  to={tool.to}
                  search={{ projectId: project.id }}
                  className={`
                    group relative p-8 rounded-2xl border border-white/5 bg-gradient-to-br ${tool.gradient}
                    transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/10
                    flex items-center gap-6
                  `}
                >
                  <div className={`
                    w-16 h-16 rounded-2xl ${tool.color} bg-opacity-20 flex items-center justify-center
                    text-3xl group-hover:scale-110 transition-transform shadow-lg
                  `}>
                    {tool.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-200 group-hover:text-white transition-colors mb-2">{tool.title}</h3>
                    <p className="text-slate-400 group-hover:text-slate-300 transition-colors">{tool.desc}</p>
                  </div>

                  <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                    <span className="text-2xl text-white/50">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* History Section */}
          <div>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-400">📜</span>
              Edit History
            </h2>

            <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6">
              <div className="relative pl-6 space-y-8">
                {/* Vertical Line */}
                <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-800" />

                {/* Initial State */}
                <div className="relative">
                  <div className="absolute -left-5 w-4 h-4 rounded-full bg-slate-700 border-4 border-slate-900 z-10" />
                  <div>
                    <div className="text-sm font-bold text-slate-300">Project Created</div>
                    <div className="text-xs text-slate-500 font-mono mt-1">Source: {project.assets[0] || 'Unknown'}</div>
                  </div>
                </div>

                {/* Operations */}
                {project.operations.map((op, i) => (
                  <div key={i} className="relative">
                    <div className={`
                          absolute -left-5 w-4 h-4 rounded-full border-4 border-slate-900 z-10
                          ${i === project.operations.length - 1 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-600'}
                       `} />
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white uppercase tracking-wide">{op.type}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">STEP {i + 1}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        ID: {op.id}
                      </div>
                    </div>
                  </div>
                ))}

                {project.operations.length === 0 && (
                  <div className="relative pt-2">
                    <p className="text-sm text-slate-600 italic">No edits applied yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
