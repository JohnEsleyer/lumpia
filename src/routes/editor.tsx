import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Clapperboard,
  Plus,
  Save,
  Scissors
} from 'lucide-react';
import React from 'react';

import { getProject, getProjectAssets, updateProject } from '../api';
import type { Project } from '../types';
import { Button } from '../components/ui/Button';

// Layout & New Components
import { EditorLayout } from '../layout/EditorLayout';
import { Player } from '../components/player/Player';
import { UtilityPanel } from '../components/inspector/UtilityPanel';

// New/Integrated Inspectors
import { VideoClipInspector } from '../components/inspector/VideoClipInspector';
import { AudioInspector } from '../components/inspector/AudioInspector';
import { ImageInspector } from '../components/inspector/ImageInspector';

// Timeline Components
import { TimelineContainer } from '../components/timeline/TimelineContainer';
import { useTimelineLogic } from '../hooks/useTimelineLogic';
import { useTimelinePreview } from '../hooks/useTimelinePreview';
import { AddAssetModal } from '../components/modals/AddAssetModal';
import { AudioTrimmerModal } from '../components/modals/AudioTrimmerModal';

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

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms} `;
};

const isAudioFile = (filename: string) => /\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(filename);
const isImageFile = (filename: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);

// --- Library Panel (Local Definition for now, can be extracted) ---
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
}) => {

  return (
    <div className="flex flex-col h-full bg-zinc-925">
      <div className="h-14 border-b border-zinc-900 flex items-center px-4 bg-zinc-950/30">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Clapperboard size={14} /> Library
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="space-y-4">
          {/* Upload Zone */}
          <div
            onClick={onOpenUploadModal}
            className="mb-6 p-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:scale-110 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-all">
              <Plus size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">Upload Media</p>
              <p className="text-[10px] text-zinc-500 mt-1">Click to browse files</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Project Files</span>
            <span className="text-[10px] text-zinc-600 font-mono">({assets.length})</span>
          </div>

          {/* Grid Layout for Assets */}
          <div className="grid grid-cols-2 gap-3">
            {assets.map(asset => {
              const isAudio = isAudioFile(asset.name);
              const isImage = isImageFile(asset.name);
              const dragType = isAudio ? 'asset-audio' : (isImage ? 'asset-image' : 'asset-video'); // Standardized drag type

              return (
                <div
                  key={asset.name}
                  draggable
                  onDragStart={(e) => onDragStart(e, dragType, asset)}
                  className={`
                        group flex flex-col gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]
                        ${isAudio
                      ? 'bg-zinc-900 border-emerald-900/30 hover:border-emerald-500/50 hover:shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : isImage
                        ? 'bg-zinc-900 border-purple-900/30 hover:border-purple-500/50 hover:shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                        : 'bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 hover:shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                    }
`}
                >
                  <div className={`
aspect-video w-full rounded-md overflow-hidden shrink-0 relative border flex items-center justify-center 
                        ${isAudio
                      ? 'bg-emerald-950/30 border-emerald-500/20'
                      : isImage
                        ? 'bg-black border-purple-500/20'
                        : 'bg-black border-zinc-800'
                    }
`}>
                    {isImage || asset.thumbnailUrl ? (
                      <img
                        src={`http://localhost:3001${isImage ? asset.url : asset.thumbnailUrl}`}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        alt={asset.name}
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <Clapperboard size={20} className="opacity-50 text-zinc-600" />
                    )}
                    {
                      !isImage && (
                        <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-white font-bold backdrop-blur-sm shadow-sm border border-white/10">
                          {asset.duration ? formatTime(asset.duration) : '0:00'}
                        </div>
                      )
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold truncate mb-0.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" title={asset.name}>
                      {asset.name}
                    </div>
                  </div>

                  {/* Trim Button for Audio */}
                  {isAudio && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrimAudio(asset);
                      }}
                      className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1.5 bg-zinc-900/90 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-md border border-zinc-700 transition-all shadow-xl z-20"
                      title="Trim & Add"
                    >
                      <Scissors size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
function EditorApp() {
  const { projectId } = Route.useSearch();
  const [project, setProject] = useState<Project | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [trimOverride, setTrimOverride] = useState<{ id: string, startOffset: number, endOffset: number } | null>(null);


  // UI State
  const [isLibraryVisible, setIsLibraryVisible] = useState(true);
  const [isUtilityVisible, setIsUtilityVisible] = useState(true);
  const [activeTool, setActiveTool] = useState<'cursor' | 'split'>('cursor');

  // Video State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Audio Trimmer State
  const [trimmerAsset, setTrimmerAsset] = useState<LibraryAsset | null>(null);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);

  // Timeline Logic
  const timeline = useTimelineLogic(project);

  // Preview Logic
  const previewState = useTimelinePreview(timeline.tracks, libraryAssets, selectedItemId, trimOverride); // Pass trimOverride

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


  const onDragStart = (e: React.DragEvent, type: string, payload: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, payload }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSave = async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      const newEditorState = {
        timeline: {
          tracks: timeline.tracks,
          duration: timeline.duration
        }
      };
      await updateProject(project.id, { ...project, editorState: newEditorState });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeek = (time: number) => {
    // Clamped time uses the derived timeline duration (which can change dynamically)
    const clampedTime = Math.max(0, Math.min(time, previewState.totalDuration));
    timeline.setCurrentTime(clampedTime);
    if (videoRef.current) {
      videoRef.current.currentTime = clampedTime;
    }
  };

  // Handler for generic property updates (volume, speed, image duration)
  const handleUpdateItemProperties = (id: string, data: any) => {
    const track = timeline.tracks.find(t => t.items.some(i => i.id === id));
    if (track) {
      timeline.updateClip(track.id, id, data);
    }
  };

  // Handler specifically for when the VideoTrimmer commits a trim
  const handleUpdateClipTimelineAndTrim = (
    itemId: string,
    newStart: number,
    newDuration: number,
    newStartOffset: number
  ) => {
    const track = timeline.tracks.find(t => t.items.some(i => i.id === itemId));
    if (track) {
      // Merge new properties (including timeline position/duration/offset).
      timeline.updateClip(track.id, itemId, {
        start: newStart,
        duration: newDuration,
        startOffset: newStartOffset
      });
      // CRITICAL: Clear override state once committed
      setTrimOverride(null);
    }
  };

  const handleSplit = () => {
    if (selectedItemId) {
      const track = timeline.tracks.find(t => t.items.some(i => i.id === selectedItemId));
      if (track) {
        timeline.splitClip(track.id, selectedItemId, timeline.currentTime);
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected item
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
        // Find which track has this item
        const track = timeline.tracks.find(t => t.items.some(i => i.id === selectedItemId));
        if (track) {
          timeline.deleteClip(track.id, selectedItemId);
          setSelectedItemId(null); // Deselect
        }
      }

      if (e.key.toLowerCase() === 's' && selectedItemId) {
        handleSplit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, timeline]);

  const handleSplitClick = (itemId: string, time: number) => {
    const track = timeline.tracks.find(t => t.items.some(i => i.id === itemId));
    if (track) {
      timeline.splitClip(track.id, itemId, time);
    }
  };

  // Function to retrieve full asset data
  const getAssetData = useCallback((resourceId: string): LibraryAsset | undefined => {
    return libraryAssets.find(a => a.name === resourceId);
  }, [libraryAssets]);

  // Handler for asset dropping onto tracks
  const handleAssetDrop = useCallback((trackId: string, payload: LibraryAsset) => {
    const trackType = timeline.tracks.find(t => t.id === trackId)?.type;

    let expectedType = 'video';
    if (isAudioFile(payload.name)) expectedType = 'audio';
    else if (isImageFile(payload.name)) expectedType = 'overlay';

    if (trackType !== expectedType) {
      console.warn(`Cannot drop ${payload.name} (Type: ${expectedType}) onto ${trackType} track.`);
      return;
    }

    timeline.addClip(trackId, payload, timeline.currentTime);

  }, [timeline.tracks, timeline.currentTime, timeline.addClip]);


  // Derived state for the inspector
  const selectedTrackedItem = useMemo(() => {
    if (!selectedItemId) return null;
    for (const track of timeline.tracks) {
      const item = track.items.find(i => i.id === selectedItemId);
      if (item) {
        const asset = getAssetData(item.resourceId);
        return {
          item,
          track,
          asset,
        };
      }
    }
    return null;
  }, [selectedItemId, timeline.tracks, getAssetData]);

  // NEW: Memoized snapshot of the committed item data for stable trimming calculations
  const committedItemData = useMemo(() => {
    if (!selectedTrackedItem) return null;
    const { item } = selectedTrackedItem;
    return {
      start: item.start,
      startOffset: item.startOffset,
      playbackRate: item.playbackRate ?? 1,
    };
  }, [selectedTrackedItem]);


  // Conditional Inspector Rendering
  const renderInspector = useMemo(() => {
    if (!selectedTrackedItem || !committedItemData) {
      // Show generic tools if nothing is selected
      return (
        <UtilityPanel
          selectedItemId={null}
          properties={null}
          onUpdate={handleUpdateItemProperties}
          activeTool={activeTool}
          onToolChange={setActiveTool}
        />
      );
    }

    const { item, track, asset } = selectedTrackedItem;

    // Fallback if asset is missing (shouldn't happen, but safety)
    if (!asset) return <UtilityPanel selectedItemId={null} properties={null} onUpdate={handleUpdateItemProperties} activeTool={activeTool} onToolChange={setActiveTool} />;


    // Common item data structure for inspectors
    const itemData = {
      start: item.start,
      duration: item.duration,
      startOffset: item.startOffset,
      playbackRate: item.playbackRate ?? 1,
      volume: item.volume ?? 1,
      // Used by image/audio inspectors:
      url: `http://localhost:3001${asset.url}`,
      sourceDuration: asset.duration,
      label: asset.name
    };

    if (track.type === 'video') {
      return (
        <VideoClipInspector
          itemId={item.id}
          itemData={itemData}
          assetData={asset}
          committedItemData={committedItemData} // <-- PASSED NEW SNAPSHOT
          onUpdateItemProperties={handleUpdateItemProperties}
          onUpdateTimelinePosition={handleUpdateClipTimelineAndTrim}
          onSeek={handleSeek}
          globalTimelineTime={timeline.currentTime}
          // NEW TRIM OVERRIDE HANDLERS
          onUpdateTrimOverride={(startOffset, endOffset) => {
            setTrimOverride({ id: item.id, startOffset, endOffset });
          }}
          onClearTrimOverride={() => {
            setTrimOverride(null);
          }}
        />
      );
    }

    if (track.type === 'audio') {
      if (!projectId) return null;

      // Calculate the audio clip end offset for the AudioInspector display
      const endOffset = item.startOffset + item.duration * (item.playbackRate || 1);

      return (
        <AudioInspector
          projectId={projectId}
          nodeId={item.id}
          data={{
            url: itemData.url,
            duration: itemData.sourceDuration,
            startOffset: itemData.startOffset,
            endOffset: endOffset,
            volume: itemData.volume,
            label: itemData.label
          }}
          // Note: AudioInspector's onUpdateNode handles its own complex state (offset/duration/volume)
          // When we unify, we pass the generic handler which uses timeline.updateClip
          onUpdateNode={handleUpdateItemProperties}
        />
      );
    }

    if (track.type === 'overlay') {
      // Assuming this is primarily for images/static overlays
      return (
        <ImageInspector
          nodeId={item.id}
          data={{
            url: itemData.url,
            duration: itemData.duration // Image node uses timeline duration as its property
          }}
          onUpdateNode={handleUpdateItemProperties}
        />
      );
    }

    // Default to UtilityPanel if type is unhandled or generic properties are needed
    return (
      <UtilityPanel
        selectedItemId={item.id}
        properties={{ id: item.id, volume: item.volume ?? 1, playbackRate: item.playbackRate ?? 1 }}
        onUpdate={handleUpdateItemProperties}
        activeTool={activeTool}
        onToolChange={setActiveTool}
      />
    );

  }, [selectedItemId, timeline.tracks, getAssetData, activeTool, handleUpdateItemProperties, handleUpdateClipTimelineAndTrim, handleSeek, projectId, timeline.currentTime, committedItemData]);


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
            onTrimAudio={(asset) => {
              setTrimmerAsset(asset);
              setIsTrimmerOpen(true);
            }}
          />
        }
        player={
          <Player
            videoRef={videoRef}
            previewState={previewState}
            isPlaying={isPlaying}
            currentTime={timeline.currentTime}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onSeek={handleSeek}
            onTimeUpdate={timeline.setCurrentTime}
            projectDimensions={project ? { width: project.width, height: project.height } : undefined}
          />
        }
        timeline={
          <div className="h-full flex flex-col">
            {/* Floating Action Bar */}
            <div className="absolute top-[-3rem] right-4 flex gap-2 z-50">
              <Button onClick={handleSplit} disabled={!selectedItemId} className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 disabled:opacity-50">
                <Scissors size={14} className="mr-2" /> Split
              </Button>
              <Button onClick={handleSave} isLoading={isSaving} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 text-white border-0">
                <Save size={14} className="mr-2" /> Save Project
              </Button>
            </div>

            <TimelineContainer
              tracks={timeline.tracks}
              duration={timeline.duration}
              currentTime={timeline.currentTime}
              onSeek={handleSeek}
              onItemMove={(itemId, trackId, newStart) => timeline.moveClip(trackId, itemId, newStart)}
              onItemTrim={timeline.trimClip}
              items={timeline.tracks.flatMap(t => t.items)}
              selectedItemId={selectedItemId}
              onItemClick={setSelectedItemId}
              getAssetData={getAssetData}
              onAssetDrop={handleAssetDrop}
              activeTool={activeTool}
              onSplit={handleSplitClick}
              onToggleMute={timeline.toggleTrackMute}
            />
          </div>
        }
        properties={renderInspector}
      />
      <AddAssetModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} projectId={projectId} onAssetAdded={(newAssets: LibraryAsset[]) => setLibraryAssets(newAssets)} />

      <AudioTrimmerModal
        isOpen={isTrimmerOpen}
        onClose={() => setIsTrimmerOpen(false)}
        asset={trimmerAsset}
        onAddToTimeline={(startOffset, duration) => {
          if (trimmerAsset) {
            const audioTrack = timeline.tracks.find(t => t.type === 'audio');
            if (audioTrack) {
              timeline.addClip(
                audioTrack.id,
                trimmerAsset,
                timeline.currentTime,
                { startOffset, duration }
              );
            }
          }
        }}
      />
    </>
  );
}