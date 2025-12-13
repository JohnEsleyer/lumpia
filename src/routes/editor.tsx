import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clapperboard, Plus, Scissors } from 'lucide-react';
import React from 'react';

import { getProject, getProjectAssets, updateProject } from '../api';
import type { Project } from '../types';

// Layout & Components
import { EditorLayout } from '../layout/EditorLayout';
import { Player } from '../components/player/Player';
import { UtilityPanel } from '../components/inspector/UtilityPanel';
import { VideoClipInspector } from '../components/inspector/VideoClipInspector';
import { AudioInspector } from '../components/inspector/AudioInspector';
import { ImageInspector } from '../components/inspector/ImageInspector';
import { AddAssetModal } from '../components/modals/AddAssetModal';
import { AudioTrimmerModal } from '../components/modals/AudioTrimmerModal';

// Timeline Specifics
import { TimelineContainer, type TimelineContainerHandle } from '../components/timeline/TimelineContainer';
import { TimelineControls } from '../components/timeline/TimelineControls';
import { useTimelineLogic } from '../hooks/useTimelineLogic';
import { useTimelinePreview } from '../hooks/useTimelinePreview';

export const Route = createFileRoute('/editor')({
  component: () => <EditorApp />,
  validateSearch: (search: Record<string, unknown>): { projectId?: string } => {
    return { projectId: search.projectId as string | undefined };
  },
});

interface LibraryAsset {
  name: string;
  url: string;
  filmstrip: string[];
  thumbnailUrl: string;
  duration?: number;
}

const isAudioFile = (filename: string) => /\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(filename);
const isImageFile = (filename: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);

// --- Library Panel ---
const LibraryPanel = ({ assets, onOpenUploadModal, onDragStart, onTrimAudio }: any) => {
  // Reusing simplified/placeholder asset list structure
  return (
    <div className="flex flex-col h-full bg-zinc-925">
      <div className="h-14 border-b border-zinc-900 flex items-center px-4 bg-zinc-950/30">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Clapperboard size={14} /> Library
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div
          onClick={onOpenUploadModal}
          className="mb-6 p-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer flex flex-col items-center justify-center gap-3 text-center"
        >
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
            <Plus size={18} />
          </div>
          <span className="text-xs font-bold text-zinc-300">Upload Media</span>
        </div>

        {/* Simplified Asset List for brevity */}
        <div className="grid grid-cols-2 gap-3">
          {assets.map((asset: LibraryAsset) => {
            const isAudio = isAudioFile(asset.name);
            const isImage = isImageFile(asset.name);
            const dragType = isAudio ? 'asset-audio' : (isImage ? 'asset-image' : 'asset-video');
            return (
              <div
                key={asset.name}
                draggable
                onDragStart={(e) => onDragStart(e, dragType, asset)}
                className="p-2 bg-zinc-900 rounded border border-zinc-800 hover:border-indigo-500/50 cursor-grab"
              >
                <div className="aspect-video bg-black rounded mb-2 overflow-hidden flex items-center justify-center relative group">
                  {isImage || asset.thumbnailUrl ? (
                    <img src={`http://localhost:3001${isImage ? asset.url : asset.thumbnailUrl}`} className="w-full h-full object-cover" />
                  ) : <Clapperboard className="text-zinc-700" />}
                  {isAudio && (
                    <button onClick={(e) => { e.stopPropagation(); onTrimAudio(asset) }} className="absolute top-1 right-1 bg-black/80 text-white p-1 rounded opacity-0 group-hover:opacity-100"><Scissors size={10} /></button>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">{asset.name}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
};

function EditorApp() {
  const { projectId } = Route.useSearch();
  const [project, setProject] = useState<Project | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);

  // Modals & Panels
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLibraryVisible, setIsLibraryVisible] = useState(true);
  const [isUtilityVisible, setIsUtilityVisible] = useState(true);

  // State
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [trimOverride, setTrimOverride] = useState<{ id: string, startOffset: number, endOffset: number } | null>(null);
  const [activeTool, setActiveTool] = useState<'cursor' | 'split'>('cursor');
  const [zoomLevel, setZoomLevel] = useState(50);

  // Player Ref & State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const timelineContainerRef = useRef<TimelineContainerHandle>(null);

  // Audio Trimmer
  const [trimmerAsset, setTrimmerAsset] = useState<LibraryAsset | null>(null);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);

  // Hooks
  const timeline = useTimelineLogic(project);
  const previewState = useTimelinePreview(timeline.tracks, libraryAssets, selectedItemId, trimOverride);

  // Load Data
  useEffect(() => {
    if (projectId) {
      getProject(projectId).then(async (p) => {
        setProject(p);
        timeline.initializeTimeline(p);
        setLibraryAssets(await getProjectAssets(projectId));
      }).catch(console.error);
    }
  }, [projectId]);

  // Save Logic
  useEffect(() => {
    if (!project) return;
    const autoSave = setTimeout(() => {
      updateProject(project.id, {
        ...project,
        editorState: { timeline: { tracks: timeline.tracks, duration: timeline.duration } }
      }).catch(console.error);
    }, 5000); // Autosave every 5s
    return () => clearTimeout(autoSave);
  }, [timeline.tracks, project]);

  const onDragStart = (e: React.DragEvent, type: string, payload: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, payload }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // --- PLAYBACK SYNC ---
  const handleSeek = (time: number) => {
    const clampedTime = Math.max(0, Math.min(time, timeline.duration));
    timeline.setCurrentTime(clampedTime);
    if (videoRef.current) videoRef.current.currentTime = clampedTime;
    timelineContainerRef.current?.setPlayheadTime(clampedTime);
  };

  const handlePlayerTimeUpdate = useCallback((time: number) => {
    timelineContainerRef.current?.setPlayheadTime(time);
    timeline.setCurrentTime(time);
  }, [timeline]);

  const handleTogglePlay = () => setIsPlaying(!isPlaying);

  // --- TOOLS ---
  const handleSplit = () => {
    if (selectedItemId) {
      // Find track for selected item
      const track = timeline.tracks.find(t => t.items.some(i => i.id === selectedItemId));
      if (track) timeline.splitClip(track.id, selectedItemId, timeline.currentTime);
    }
    // We do not automatically reset to cursor here, split tool is modal or stays active until switched
    // setActiveTool('cursor'); 
  };

  // --- INSPECTOR LOGIC ---
  const getAssetData = useCallback((id: string) => libraryAssets.find(a => a.name === id), [libraryAssets]);

  const handleUpdateItem = (id: string, data: any) => {
    const track = timeline.tracks.find(t => t.items.some(i => i.id === id));
    if (track) timeline.updateClip(track.id, id, data);
  };

  const renderInspector = useMemo(() => {
    if (!selectedItemId) return <UtilityPanel selectedItemId={null} properties={null} onUpdate={() => { }} activeTool={activeTool} onToolChange={setActiveTool} />;

    const track = timeline.tracks.find(t => t.items.some(i => i.id === selectedItemId));
    const item = track?.items.find(i => i.id === selectedItemId);
    const asset = item ? getAssetData(item.resourceId) : null;

    if (!item || !track || !asset) return null;

    const committedItemData = {
      start: item.start,
      startOffset: item.startOffset,
      playbackRate: item.playbackRate ?? 1,
    };

    const commonProps = {
      itemId: item.id,
      onUpdateItemProperties: handleUpdateItem,
    };

    if (track.type === 'video') {
      const itemData = {
        start: item.start,
        duration: item.duration,
        startOffset: item.startOffset,
        playbackRate: item.playbackRate ?? 1,
        volume: item.volume ?? 1,
        // url: `http://localhost:3001${asset.url}`, <-- ERROR FIXED: URL moved to assetData
        sourceDuration: asset.duration,
        label: asset.name
      };

      return <VideoClipInspector
        {...commonProps}
        itemData={itemData}
        assetData={asset}
        committedItemData={committedItemData}
        onUpdateTimelinePosition={(id, start, dur, off) => {
          timeline.updateClip(track.id, id, { start, duration: dur, startOffset: off });
          setTrimOverride(null);
        }}
        onSeek={handleSeek}
        globalTimelineTime={timeline.currentTime}
        onUpdateTrimOverride={(s, e) => setTrimOverride({ id: item.id, startOffset: s, endOffset: e })}
        onClearTrimOverride={() => setTrimOverride(null)}
      />
    }
    if (track.type === 'audio' && projectId) {
      return <AudioInspector
        projectId={projectId} nodeId={item.id}
        data={{ ...item, url: `http://localhost:3001${asset.url}`, label: asset.name }}
        onUpdateNode={handleUpdateItem}
      />
    }
    if (track.type === 'overlay') {
      return <ImageInspector nodeId={item.id} data={{ url: `http://localhost:3001${asset.url}`, duration: item.duration }} onUpdateNode={handleUpdateItem} />
    }

    return null;
  }, [selectedItemId, timeline.tracks, activeTool, timeline.currentTime, projectId]);


  if (!projectId) return <div>Invalid Project ID</div>;

  return (
    <>
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
            onTrimAudio={(a: LibraryAsset) => { setTrimmerAsset(a); setIsTrimmerOpen(true); }}
          />
        }

        player={
          <Player
            videoRef={videoRef}
            previewState={previewState}
            isPlaying={isPlaying}
            currentTime={timeline.currentTime}
            onPlayPause={handleTogglePlay}
            onSeek={handleSeek}
            onTimeUpdate={handlePlayerTimeUpdate}
            projectDimensions={project ? { width: project.width, height: project.height } : undefined}
          />
        }

        timeline={
          <div className="h-full flex flex-col relative">
            {/* 1. Unified Controls Bar */}
            <TimelineControls
              isPlaying={isPlaying}
              onPlayPause={handleTogglePlay}
              onSkipToStart={() => handleSeek(0)}
              onSkipToEnd={() => handleSeek(timeline.duration)}
              currentTime={timeline.currentTime}
              duration={timeline.duration}
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onSplit={handleSplit}
              canSplit={!!selectedItemId}
              zoom={zoomLevel}
              onZoomChange={setZoomLevel}
              minZoom={2}
              maxZoom={600}
            />

            {/* 2. Timeline Surface */}
            <TimelineContainer
              ref={timelineContainerRef}
              tracks={timeline.tracks}
              duration={timeline.duration}
              currentTime={timeline.currentTime}
              pixelsPerSecond={zoomLevel} // Passed down
              onSeek={handleSeek}
              onItemMove={(itemId, trackId, newStart) => timeline.moveClip(trackId, itemId, newStart)}
              onItemTrim={timeline.trimClip}
              items={timeline.tracks.flatMap(t => t.items)}
              selectedItemId={selectedItemId}
              onItemClick={setSelectedItemId}
              getAssetData={getAssetData}
              onAssetDrop={(trackId, payload) => timeline.addClip(trackId, payload, timeline.currentTime)}
              activeTool={activeTool}
              onSplit={(id, time) => {
                const t = timeline.tracks.find(tr => tr.items.some(it => it.id === id));
                if (t) timeline.splitClip(t.id, id, time);
                setActiveTool('cursor');
              }}
              onToggleMute={timeline.toggleTrackMute}
            />
          </div>
        }

        properties={renderInspector}
      />

      <AddAssetModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        projectId={projectId}
        onAssetAdded={(newAssets: LibraryAsset[]) => setLibraryAssets(newAssets)}
      />

      <AudioTrimmerModal
        isOpen={isTrimmerOpen}
        onClose={() => setIsTrimmerOpen(false)}
        asset={trimmerAsset}
        onAddToTimeline={(start, dur) => {
          if (trimmerAsset) {
            const track = timeline.tracks.find(t => t.type === 'audio');
            if (track) timeline.addClip(track.id, trimmerAsset, timeline.currentTime, { startOffset: start, duration: dur });
          }
        }}
      />
    </>
  );
}