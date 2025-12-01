import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVideoMeta } from '../hooks/useVideoMeta';
import { generateThumbnail } from '../utils/mediabunny';
import { Button } from '../components/ui/Button';
import { getProject, saveProjectOperation, addAsset } from '../api';
import type { Project } from '../types';

export const Route = createFileRoute('/stitcher')({
  component: StitcherApp,
  validateSearch: (search: Record<string, unknown>): { projectId?: string } => {
    return { projectId: search.projectId as string | undefined }
  },
});

type Clip = {
  id: string;
  url: string;
  duration: number; // in seconds
  thumbnail?: string;
  name: string;
};

function SortableItem({ clip, index, onRemove, isActive, onClick }: { clip: Clip, index: number, onRemove: (id: string) => void, isActive: boolean, onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-3 p-2 rounded-lg mb-2 group border transition-colors select-none
            ${isActive ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}
        `}
    >
      <div {...attributes} {...listeners} className="p-2 cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300">⋮⋮</div>
      <div
        className="flex-1 flex items-center gap-3 cursor-pointer"
        onClick={onClick}
      >
        <div className="h-10 w-16 bg-black rounded overflow-hidden relative shrink-0">
          {clip.thumbnail && <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">{clip.name}</div>
          <div className="text-xs text-slate-500">{clip.duration.toFixed(1)}s</div>
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onRemove(clip.id); }} className="p-2 text-slate-500 hover:text-red-400">✕</button>
    </div>
  );
}

function StitcherApp() {
  const { projectId } = Route.useSearch();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const { processFile } = useVideoMeta();
  const [clips, setClips] = useState<Clip[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Player State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (projectId) {
      getProject(projectId).then(p => {
        setProject(p);
        // Load initial project head as first clip if available
        if (p.currentHead) {
          const videoUrl = `http://localhost:3001${p.currentHead}`;
          // Simple fetch to get duration if needed, or just let it load
          setClips([{
            id: crypto.randomUUID(),
            url: videoUrl,
            duration: 0, // Will update on load
            name: "Current Project",
            thumbnail: undefined
          }]);
        }
      }).catch(console.error);
    }
  }, [projectId]);

  // Determine what to play
  const activeClip = clips[currentClipIndex];

  const handleVideoEnd = () => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
      // Auto play next clip
      setTimeout(() => videoRef.current?.play(), 100);
    } else {
      setIsPlaying(false);
      setCurrentClipIndex(0); // Reset to start
    }
  };

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !project) return;
    const files = Array.from(e.target.files);

    for (const file of files) {
      try {
        const { url: assetUrl } = await addAsset(project.id, file);
        const serverUrl = `http://localhost:3001${assetUrl}`;
        const meta = await processFile(file);
        const thumb = await generateThumbnail(file, 1);

        if (meta) {
          setClips(prev => [...prev, {
            id: crypto.randomUUID(),
            url: serverUrl,
            duration: meta.durationInSeconds,
            name: file.name,
            thumbnail: thumb || undefined
          }]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setClips((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        // If the playing clip moves, follow it roughly or reset
        if (currentClipIndex === oldIndex) setCurrentClipIndex(newIndex);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      await saveProjectOperation(project.id, {
        type: 'stitch',
        params: {
          // Backend expects clips array
          clips: clips.map(c => ({ url: c.url, durationInFrames: 0 })) // Frame duration not strictly needed for backend concat unless utilizing precise frame cuts later
        },
        id: crypto.randomUUID()
      });
      navigate({ to: '/project/$projectId', params: { projectId: project.id } });
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (!projectId || !project) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Player Section */}
      <div className="flex-[2] bg-black/40 p-8 flex flex-col items-center justify-center relative border-r border-white/10 overflow-hidden">
        {/* Grid Background Pattern */}
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        <div className="w-full flex justify-start mb-4 absolute top-6 left-6 z-10">
          <Button variant="secondary" onClick={() => navigate({ to: '/project/$projectId', params: { projectId: project.id } })} className="text-xs h-9 px-4 rounded-full bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300">← Back</Button>
        </div>

        <div className="w-full max-w-4xl aspect-video shadow-2xl ring-1 ring-white/10 relative rounded-lg overflow-hidden bg-black/50 backdrop-blur-sm flex items-center justify-center">
          {activeClip ? (
            <video
              ref={videoRef}
              src={activeClip.url}
              className="w-full h-full object-contain"
              controls
              autoPlay={isPlaying}
              onEnded={handleVideoEnd}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 font-medium">Add clips to start stitching</div>
          )}
        </div>
        <div className="mt-6 text-slate-400 font-mono text-xs bg-black/20 px-4 py-1.5 rounded-full border border-white/5">
          Playing Clip <span className="text-white font-bold">{currentClipIndex + 1}</span> of {clips.length}
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex-1 bg-slate-950 p-6 flex flex-col gap-6 min-w-[350px]">
        <div>
          <h2 className="text-xl font-bold mb-4 text-white">Sequence</h2>
          <label className="block cursor-pointer">
            <div className="bg-blue-600 hover:bg-blue-500 text-white text-center py-2 rounded-lg font-bold transition-colors">
              + Add Clips
            </div>
            <input type="file" multiple accept="video/*" className="hidden" onChange={handleAdd} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-900/30 rounded-xl p-2 border border-slate-800/50">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={clips} strategy={verticalListSortingStrategy}>
              {clips.map((clip, index) => (
                <SortableItem
                  key={clip.id}
                  clip={clip}
                  index={index}
                  onRemove={(id) => setClips(c => c.filter(x => x.id !== id))}
                  isActive={index === currentClipIndex}
                  onClick={() => {
                    setCurrentClipIndex(index);
                    setIsPlaying(true);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
          {clips.length === 0 && <p className="text-center text-slate-600 text-sm mt-10">Drag video files here</p>}
        </div>

        <div className="pt-4 border-t border-slate-800">
          <Button className="w-full" onClick={handleSave} isLoading={isSaving} disabled={isSaving}>
            {isSaving ? 'Stitching...' : 'Save Sequence'}
          </Button>
        </div>
      </div>
    </div>
  );
}