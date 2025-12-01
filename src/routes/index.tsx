import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getProjects, createProject, deleteProject } from '../api'
import type { Project } from '../types'
import { Button } from '../components/ui/Button'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { fetchFile } from '@ffmpeg/util'

export const Route = createFileRoute('/')({
    component: Dashboard,
})

function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([])
    const [isCreating, setIsCreating] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadProjects()
    }, [])

    async function loadProjects() {
        try {
            const data = await getProjects()
            setProjects(data)
        } catch (e) {
            console.error(e)
        }
    }

    async function handleDelete(e: React.MouseEvent, id: string) {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this project?')) return

        try {
            await deleteProject(id)
            loadProjects()
        } catch (err) {
            console.error(err)
            alert('Failed to delete project')
        }
    }

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="h-full w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden font-sans selection:bg-blue-500/30">
            {/* Header Area */}
            <header className="px-8 py-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Projects</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage and edit your local videos</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-500 text-xs">🔍</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 hover:border-slate-700"
                        />
                    </div>
                    <Button onClick={() => setIsCreating(true)} className="shrink-0 shadow-lg shadow-blue-900/20 whitespace-nowrap">
                        + New Project
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto pb-20">
                    {projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20 animate-in fade-in zoom-in duration-300">
                            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 text-5xl shadow-inner border border-slate-800/50">
                                🎬
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">No projects yet</h3>
                            <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">
                                Get started by creating your first video project. You can edit, trim, and stitch videos locally.
                            </p>
                            <Button onClick={() => setIsCreating(true)} className="px-8 h-12 text-base">
                                Create Project
                            </Button>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-4xl mb-4">🔍</div>
                            <p className="text-slate-500 font-medium">No projects found matching "{searchQuery}"</p>
                            <button onClick={() => setSearchQuery('')} className="text-blue-400 text-sm mt-2 hover:underline">Clear search</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredProjects.map((project) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    onDelete={(e) => handleDelete(e, project.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isCreating && (
                <CreateProjectModal
                    onClose={() => setIsCreating(false)}
                    onCreated={() => {
                        setIsCreating(false)
                        loadProjects()
                    }}
                />
            )}
        </div>
    )
}

function ProjectCard({ project, onDelete }: { project: Project, onDelete: (e: React.MouseEvent) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    return (
        <Link
            to="/project/$projectId"
            params={{ projectId: project.id }}
            className="group relative bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/10 flex flex-col h-full"
            onMouseEnter={() => {
                if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play().catch(() => { });
                }
            }}
            onMouseLeave={() => {
                if (videoRef.current) {
                    videoRef.current.pause();
                }
            }}
        >
            {/* Thumbnail / Video Preview */}
            <div className="aspect-video bg-black relative overflow-hidden border-b border-white/5">
                {project.currentHead ? (
                    <video
                        ref={videoRef}
                        src={`http://localhost:3001${project.currentHead}`}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                        muted
                        loop
                        playsInline
                        poster={project.thumbnail}
                    />
                ) : project.thumbnail ? (
                    <img src={project.thumbnail} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-700">
                        <span className="text-4xl grayscale opacity-50">📼</span>
                    </div>
                )}

                {/* Overlay Badges */}
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 transition-opacity">
                    <span className="bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-sm tracking-wide">
                        {project.width}×{project.height}
                    </span>
                    <span className="bg-black/70 backdrop-blur-md text-slate-200 text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-sm tracking-wide">
                        {project.fps} FPS
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-base text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1" title={project.name}>
                        {project.name}
                    </h3>
                </div>

                <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>

                    <button
                        onClick={onDelete}
                        className="p-2 -mr-2 -my-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 scale-90 group-hover:scale-100"
                        title="Delete Project"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </Link>
    )
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
    const [name, setName] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [statusText, setStatusText] = useState('')
    const [preset, setPreset] = useState('yt')
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { ffmpeg, loaded: ffmpegLoaded } = useFFmpeg()

    const presets = [
        { id: 'yt', w: 1920, h: 1080, label: 'Landscape', sub: '16:9', icon: '▭' },
        { id: 'tt', w: 1080, h: 1920, label: 'Portrait', sub: '9:16', icon: '▯' },
        { id: 'sq', w: 1080, h: 1080, label: 'Square', sub: '1:1', icon: '◻' },
    ]

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        e.stopPropagation()

        if (!file || !name) return

        setLoading(true)
        setStatusText('Initializing...')

        let fileToUpload = file

        // Attempt optimization if FFmpeg is ready
        if (ffmpegLoaded) {
            try {
                setStatusText('Analyzing Codec...')
                await ffmpeg.writeFile('input.mp4', await fetchFile(file))

                let isH265 = false
                const logCallback = ({ message }: { message: string }) => {
                    if (message.toLowerCase().includes('hevc') || message.toLowerCase().includes('h265')) isH265 = true
                }
                ffmpeg.on('log', logCallback)
                await ffmpeg.exec(['-i', 'input.mp4'])
                ffmpeg.off('log', logCallback)

                if (isH265) {
                    setStatusText('Optimizing Video...')
                    await ffmpeg.exec(['-i', 'input.mp4', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'copy', 'output.mp4'])
                    const data = await ffmpeg.readFile('output.mp4')
                    fileToUpload = new File([data as any], file.name.replace(/\.[^/.]+$/, "") + "_h264.mp4", { type: 'video/mp4' })
                }
            } catch (err) {
                console.warn("Optimization failed, using original.", err)
            }
        }

        try {
            setStatusText('Creating Project...')
            const selectedPreset = presets.find(p => p.id === preset) || presets[0]
            await createProject({
                name,
                width: selectedPreset.w,
                height: selectedPreset.h,
                fps: 30
            }, fileToUpload)
            onCreated()
        } catch (e) {
            console.error(e)
            alert('Failed to create project')
        } finally {
            setLoading(false)
            setStatusText('')
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation() // Stop propagation to prevent parent elements from catching it
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        // Only set to false if leaving the drop zone entirely, not just a child element
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-white/10">
                {/* Fixed Header */}
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">New Project</h2>
                        <p className="text-slate-400 text-xs">Configure settings and upload footage.</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors" disabled={loading}>✕</button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="create-project-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g., Summer Vlog 2024"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                required
                                autoFocus
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video Format</label>
                            <div className="grid grid-cols-3 gap-3">
                                {presets.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setPreset(p.id)}
                                        disabled={loading}
                                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${preset === p.id
                                            ? 'bg-blue-600/10 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:bg-slate-900'
                                            }`}
                                    >
                                        <span className="text-xl mb-1 opacity-80">{p.icon}</span>
                                        <span className="font-bold text-xs">{p.label}</span>
                                        <span className="text-[9px] opacity-60 font-mono">{p.sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>


                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Base Footage</label>
                            <div
                                onClick={() => !loading && fileInputRef.current?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop} // Use the dedicated handleDrop
                                className={`
                                    relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[140px]
                                    ${isDragging ? 'border-blue-500 bg-blue-500/10 scale-[0.99]' : file ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 bg-slate-950 hover:border-slate-500 hover:bg-slate-900'}
                                    ${loading ? 'opacity-50 pointer-events-none' : ''}
                                `}
                            >
                                <input ref={fileInputRef} type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" disabled={loading} />
                                {file ? (
                                    <div className="animate-in fade-in zoom-in duration-200">
                                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mb-2 mx-auto text-slate-900 text-lg shadow-lg shadow-green-500/20">✓</div>
                                        <p className="font-bold text-white text-sm truncate max-w-[200px]">{file.name}</p>
                                        <p className="text-slate-400 text-xs mt-0.5">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-2 text-slate-400 text-xl">☁️</div>
                                        <p className="font-bold text-slate-300 text-sm">Upload Video</p>
                                        <p className="text-slate-500 text-xs mt-1">MP4, MOV, MKV supported</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="p-5 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between shrink-0 gap-4">
                    <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors text-xs">Cancel</button>
                    <Button type="submit" form="create-project-form" disabled={!file || !name || loading} isLoading={loading} className="flex-1 max-w-[200px]">
                        {loading ? (statusText || 'Processing...') : 'Create Project'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
