import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clapperboard, Plus, Save, Scissors, Download } from 'lucide-react';
import React from 'react';

import { getProject, getProjectAssets, updateProject, renderSequence } from '../api';
import type { Project, ProjectAsset, TimelineItem } from '../types';
import { Button } from '../components/ui/Button';

// Layout & Components
import { EditorLayout } from '../layout/EditorLayout';
import { Player } from '../components/player/Player';
import { UtilityPanel } from '../components/inspector/UtilityPanel';
import { VideoClipInspector } from '../components/inspector/VideoClipInspector';
import { AudioInspector } from '../components/inspector/AudioInspector';
import { ImageInspector } from '../components/inspector/ImageInspector';
import { TimelineContainer, type TimelineContainerHandle } from '../components/timeline/TimelineContainer';
import { AddAssetModal } from '../components/modals/AddAssetModal';
import { AudioTrimmerModal } from '../components/modals/AudioTrimmerModal';

// Hooks & Engines
import { useTimelineLogic } from '../hooks/useTimelineLogic';
import { useTimelinePreview } from '../hooks/useTimelinePreview';
import { TimelineAudioEngine } from '../components/audio/TimelineAudioEngine';

interface LibraryAsset extends ProjectAsset { }

export const Route = createFileRoute('/editor')({
  component: () => <EditorApp />,
  validateSearch: (search: Record<string, unknown>): { projectId?: string } => {
    return { projectId: search.projectId as string | undefined };
  },
});

const isAudioFile = (filename: string) => /\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(filename);
const isImageFile = (filename: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);

// --- Library Panel ---
const LibraryPanel = ({
  assets,
  onOpenUploadModal,
  onDragStart,
  onTrimAudio,
}: {
  assets: LibraryAsset[],
  onOpenUploadModal: () => void,
  onDragStart: (e: React.DragEvent, type: string, payload: any) => void,
  onTrimAudio: (asset: LibraryAsset) => void
}) => (
  <div className="flex flex-col h-full bg-zinc-925">
    <div className="h-14 border-b border-zinc-900 flex items-center px-4 bg-zinc-950/30">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
        <Clapperboard size={14} /> Library
      </span>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
      <div
        onClick={onOpenUploadModal}
        className="mb-6 p-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3 text-center"
      >
        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3 text-zinc-400">
          <Plus size={18} />
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">Upload Media</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {assets.map(asset => {
          const isAudio = isAudioFile(asset.name);
          const isImage = isImageFile(asset.name);
          const dragType = isAudio ? 'asset-audio' : (isImage ? 'asset-image' : 'asset-video');
          return (
            <div
              key={asset.name}
              draggable
              onDragStart={(e) => onDragStart(e, dragType, asset)}
              className="group flex flex-col gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-900 cursor-grab hover:border-indigo-500/50"
            >
              <div className="aspect-video w-full rounded-md overflow-hidden shrink-0 relative flex items-center justify-center bg-black">
                {isImage || asset.thumbnailUrl ? (
                  <img src={`http://localhost:3001${isImage ? asset.url : asset.thumbnailUrl}`} className="w-full h-full object-cover" />
                ) : <Clapperboard className="text-zinc-600" />}
              </div>
              <div className="text-[10px] font-bold truncate text-zinc-400">{asset.name}</div>
              {isAudio && (
                <button onClick={(e) => { e.stopPropagation(); onTrimAudio(asset); }} className="absolute top-2 right-2 p-1 bg-zinc-900 text-white rounded opacity-0 group-hover:opacity-100"><Scissors size={12} /></button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// --- Main Editor ---
function EditorApp() {
  const { projectId } = Route.useSearch();
  const [project, setProject] = useState<Project | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<ProjectAsset[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [trimOverride, setTrimOverride] = useState<{ id: string, startOffset: number, endOffset: number } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // Trimmer Modal
  const [trimmerAsset, setTrimmerAsset] = useState<ProjectAsset | null>(null);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);

  // Panels
  const [isLibraryVisible, setIsLibraryVisible] = useState(true);
  const [isUtilityVisible, setIsUtilityVisible] = useState(true);
  const [activeTool, setActiveTool] = useState<'cursor' | 'split'>('cursor');

  // Logic
  const timeline = useTimelineLogic(project);
  const previewState = useTimelinePreview(timeline.tracks, libraryAssets, selectedItemId, trimOverride);

  const timelineContainerRef = useRef<TimelineContainerHandle>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (projectId) {
      getProject(projectId).then(async (p) => {
        setProject(p);
        timeline.initializeTimeline(p);
        const assets = await getProjectAssets(projectId);
        setLibraryAssets(assets);
      }).catch(console.error);
    }
  }, [projectId]);

  const onDragStart = (e: React.DragEvent, type: string, payload: ProjectAsset) => {
    // Add mediaType heuristic for better handling in logic
    const mediaType = isAudioFile(payload.name) ? 'audio' : (isImageFile(payload.name) ? 'image' : 'video');
    const assetPayload = { ...payload, mediaType };

    // Update payload dataTransfer to include mediaType
    e.dataTransfer.setData('application/json', JSON.stringify({ type, payload: assetPayload }));
  };

  const handleSeek = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, previewState.totalDuration));
    timeline.setCurrentTime(clamped);
    timelineContainerRef.current?.setPlayheadTime(clamped);
  }, [timeline, previewState.totalDuration]);

  const handlePlayerTimeUpdate = useCallback((time: number) => {
    timelineContainerRef.current?.setPlayheadTime(time);
    timeline.setCurrentTime(time);
  }, [timeline]);

  const handleAssetDrop = useCallback((trackId: string, payload: ProjectAsset, dropTime: number) => {
    // The dropTime argument is the exact timeline position (in seconds) where the user dropped the asset.
    timeline.addClip(trackId, payload, dropTime);
  }, [timeline]);


  // --- EXPORT LOGIC ---
  const handleExport = async () => {
    if (!projectId) return;
    setIsRendering(true);
    try {
      // Collect all clips for the backend to render
      // In a real app, you might send the whole project state.
      // Here we assume the backend just needs to know the sequence.
      // We trigger the backend render endpoint.
      await renderSequence(projectId, []); // Modify API to accept full timeline state if needed, or backend reads state.json
      alert("Render started! Check backend console.");
    } catch (e) {
      console.error(e);
      alert("Render failed");
    } finally {
      setIsRendering(false);
    }
  };

  const handleSave = async () => {
    if (!project) return;
    await updateProject(project.id, {
      editorState: { timeline: { tracks: timeline.tracks, duration: timeline.duration } }
    });
  };

  // --- Inspector Logic ---
  const renderInspector = useMemo(() => {
    const track = timeline.tracks.find(t => t.items.some(i => i.id === selectedItemId));
    const item = track?.items.find(i => i.id === selectedItemId);
    const asset = libraryAssets.find(a => a.name === item?.resourceId);

    if (!item || !track || !asset) {
      return <UtilityPanel selectedItemId={null} properties={null} onUpdate={() => { }} activeTool={activeTool} onToolChange={setActiveTool} />;
    }

    const commonProps = {
      itemId: item.id,
      onUpdateItemProperties: (id: string, d: any) => timeline.updateClip(track.id, id, d),
    };

    if (track.type === 'video') {
      return <VideoClipInspector
        {...commonProps}
        itemData={{ ...item, playbackRate: item.playbackRate ?? 1, volume: item.volume ?? 1 }}
        assetData={{ ...asset, url: asset.url }}
        committedItemData={{ start: item.start, startOffset: item.startOffset, playbackRate: item.playbackRate ?? 1, currentCommittedSourceEnd: item.startOffset + item.duration }}
        onUpdateTimelinePosition={(id, start, dur, off) => timeline.trimClip(track.id, id, start, dur, true)} // Simplified mapping
        onSeek={handleSeek}
        globalTimelineTime={timeline.currentTime}
        onUpdateTrimOverride={(s, e) => setTrimOverride({ id: item.id, startOffset: s, endOffset: e })}
        onClearTrimOverride={() => setTrimOverride(null)}
      />;
    }
    if (track.type === 'audio') {
      return <AudioInspector projectId={projectId!} nodeId={item.id} data={{ ...item, url: `http://localhost:3001${asset.url}`, label: asset.name, endOffset: item.startOffset + item.duration }} onUpdateNode={(_, d) => timeline.updateClip(track.id, item.id, d)} />;
    }
    return <ImageInspector nodeId={item.id} data={{ url: `http://localhost:3001${asset.url}`, duration: item.duration }} onUpdateNode={(_, d) => timeline.updateClip(track.id, item.id, d)} />;
  }, [selectedItemId, timeline.tracks, activeTool, timeline.currentTime]);


  if (!project) return <div className="bg-black h-screen flex items-center justify-center text-white">Loading...</div>;

  return (
    <>
      {/* INDEPENDENT AUDIO ENGINE: Handles all audio playback during editing */}
      <TimelineAudioEngine
        audioSources={previewState.audioSources}
        currentTime={timeline.currentTime}
        isPlaying={isPlaying}
        playbackRate={1}
      />


      <EditorLayout
        isLibraryVisible={isLibraryVisible}
        setIsLibraryVisible={setIsLibraryVisible}
        isPropertiesVisible={isUtilityVisible}
        setIsPropertiesVisible={setIsUtilityVisible}
        library={
          <LibraryPanel
            assets={libraryAssets}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onDragStart={onDragStart}
            onTrimAudio={(a) => { setTrimmerAsset(a); setIsTrimmerOpen(true); }}
          />
        }
        player={
          <div className="relative w-full h-full flex flex-col">
            {/* Header Toolbar */}
            <div className="absolute top-4 right-4 z-50 flex gap-2">
              <Button onClick={handleSave} className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-600">
                <Save size={14} className="mr-2" /> Save
              </Button>
              <Button onClick={handleExport} isLoading={isRendering} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white">
                <Download size={14} className="mr-2" /> Export Video
              </Button>
            </div>

            {/* TimelineAudioEngine is mounted here for scope access */}
            <TimelineAudioEngine
              audioSources={previewState.audioSources}
              currentTime={timeline.currentTime}
              isPlaying={isPlaying}
              playbackRate={1}
            />

            <Player
              videoRef={videoRef}
              previewState={previewState}
              isPlaying={isPlaying}
              currentTime={timeline.currentTime}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onSeek={handleSeek}
              onTimeUpdate={handlePlayerTimeUpdate}
              projectDimensions={{ width: project.width, height: project.height }}
            />
          </div>
        }
        timeline={
          <TimelineContainer
            ref={timelineContainerRef}
            tracks={timeline.tracks}
            items={timeline.tracks.flatMap(t => t.items)}
            duration={timeline.duration}
            currentTime={timeline.currentTime}
            onSeek={handleSeek}
            // Clips now use ripple move, handled internally by useTimelineLogic
            onItemMove={(id, track, start) => timeline.moveClip(track, id, start)}
            onItemTrim={timeline.trimClip}
            selectedItemId={selectedItemId}
            onItemClick={setSelectedItemId}
            getAssetData={(id) => libraryAssets.find(a => a.name === id)}
            onAssetDrop={handleAssetDrop} // Updated handler now receives dropTime
            activeTool={activeTool}
            onToggleMute={timeline.toggleTrackMute}
            onDeleteClip={(tid, iid) => timeline.deleteClip(tid, iid)}
          />
        }
        properties={renderInspector}
      />

      {/* Modals */}
      <AddAssetModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} projectId={projectId!} onAssetAdded={a => setLibraryAssets(p => [...p, ...a])} />
      <AudioTrimmerModal isOpen={isTrimmerOpen} onClose={() => setIsTrimmerOpen(false)} asset={trimmerAsset} onAddToTimeline={(s, d) => {
        const track = timeline.tracks.find(t => t.type === 'audio');
        if (track && trimmerAsset) timeline.addClip(track.id, trimmerAsset, timeline.currentTime, { startOffset: s, duration: d });
      }} />
    </>
  );
}