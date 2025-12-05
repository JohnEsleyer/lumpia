import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  Panel,
  useOnSelectionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Clapperboard,
  Layers,
  Save,
  FileAudio,
  Music,
  Plus
} from 'lucide-react';
import React from 'react';

import { getProject, getProjectAssets, updateProject, addAsset } from '../api';
import type { Project } from '../types';
import { Button } from '../components/ui/Button';

// Imported Nodes & Edges
import { RenderNode, type RenderNodeType, type RenderNodeData } from '../remotion/nodes/RenderNode';
import { AudioNode, type AudioNodeType } from '../remotion/nodes/AudioNode';
import { ClipNode, type ClipNodeType, type ClipNodeData } from '../remotion/nodes/ClipNode';
import ButtonEdge from '../remotion/edges/ButtonEdge';

// Imported Inspectors
import { AudioInspector } from '../components/inspector/AudioInspector';
import { VideoInspector } from '../components/inspector/VideoInspector';

// Imported Hooks
import { usePreviewLogic } from '../hooks/usePreviewLogic';
import { getSequenceFromHandle } from '../utils/graphUtils';

// --- Routing ---
export const Route = createFileRoute('/editor')({
  component: () => (
    <ReactFlowProvider>
      <EditorApp />
    </ReactFlowProvider>
  ),
  validateSearch: (search: Record<string, unknown>): { projectId?: string } => {
    return { projectId: search.projectId as string | undefined };
  },
});

// --- Types & Helpers ---
type ClipData = ClipNodeData;

interface LibraryAsset {
  name: string;
  url: string;
  filmstrip: string[];
  thumbnailUrl: string;
  duration?: number;
}

type EditorNode = ClipNodeType | RenderNodeType | AudioNodeType;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
};

const isAudioFile = (filename: string) => /\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(filename);

const nodeTypes = { clip: ClipNode, render: RenderNode, audio: AudioNode };
const edgeTypes = { 'button-edge': ButtonEdge };

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// --- Library Panel (Updated for Grid View) ---
const LibraryPanel = ({
  assets,
  onOpenUploadModal,
  onDragStart,
  isVisible
}: {
  assets: LibraryAsset[],
  onOpenUploadModal: () => void,
  onDragStart: (e: React.DragEvent, type: string, payload: any) => void,
  isVisible: boolean
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'nodes'>('media');

  if (!isVisible) return null;

  return (
    <aside className="w-[300px] bg-[#0a0a0a] border-r border-white/5 flex flex-col z-20 shrink-0 transition-all select-none">
      <div className="flex border-b border-white/5">
        <button onClick={() => setActiveTab('media')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'media' ? 'border-yellow-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
          <span className="flex items-center justify-center gap-2"><Clapperboard size={14} /> Media</span>
        </button>
        <button onClick={() => setActiveTab('nodes')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'nodes' ? 'border-purple-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
          <span className="flex items-center justify-center gap-2"><Layers size={14} /> Nodes</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {activeTab === 'media' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Project Files</span>
              <Button onClick={onOpenUploadModal} className="h-6 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 border-0 flex items-center gap-1">
                <Plus size={12} /> Add
              </Button>
            </div>

            {assets.length === 0 && (
              <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
                <span className="text-2xl block mb-2 opacity-50">📹</span>
                <p className="text-xs text-slate-500">No media files yet</p>
              </div>
            )}

            {/* Grid Layout for Assets */}
            <div className="grid grid-cols-2 gap-3">
              {assets.map(asset => {
                const isAudio = isAudioFile(asset.name);
                return (
                  <div
                    key={asset.name}
                    draggable
                    onDragStart={(e) => onDragStart(e, isAudio ? 'asset-audio' : 'asset', asset)}
                    className={`
                        group flex flex-col gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]
                        ${isAudio
                        ? 'bg-[#111] border-emerald-900/30 hover:border-emerald-500/50 hover:shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                        : 'bg-[#151515] border-white/5 hover:border-yellow-500/50 hover:shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                      }
                    `}
                  >
                    {/* Thumbnail Area */}
                    <div className={`
                        aspect-video w-full rounded-md overflow-hidden shrink-0 relative border flex items-center justify-center 
                        ${isAudio ? 'bg-emerald-950/30 border-emerald-500/20' : 'bg-black border-white/5'}
                    `}>
                      {isAudio ? (
                        <FileAudio className="text-emerald-600 opacity-80" size={32} />
                      ) : asset.thumbnailUrl ? (
                        <img
                          src={`http://localhost:3001${asset.thumbnailUrl}`}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          alt={asset.name}
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-[10px] text-slate-600 flex flex-col items-center">
                          <Clapperboard size={20} className="mb-1 opacity-50" />
                          <span>No Prev</span>
                        </div>
                      )}

                      {/* Duration Badge */}
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-white font-bold backdrop-blur-sm shadow-sm border border-white/10">
                        {asset.duration ? formatTime(asset.duration) : '0:00'}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0">
                      <div className={`text-[10px] font-bold truncate mb-0.5 ${isAudio ? 'text-emerald-100 group-hover:text-emerald-400' : 'text-slate-300 group-hover:text-yellow-400'}`} title={asset.name}>
                        {asset.name}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider flex items-center gap-1">
                        {isAudio ? <Music size={8} /> : <Clapperboard size={8} />}
                        {isAudio ? 'Audio' : 'Video'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Processors</div>
              <div draggable onDragStart={(e) => onDragStart(e, 'node-render', {})} className="p-3 bg-[#151515] border border-purple-500/30 rounded-xl cursor-grab hover:border-purple-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all group select-none">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform"><FlaskConical size={20} /></div>
                  <div><div className="text-sm font-bold text-slate-200 group-hover:text-purple-400">Render Node</div><div className="text-[10px] text-slate-500">Stitch & Export</div></div>
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Audio</div>
              <div draggable onDragStart={(e) => onDragStart(e, 'node-audio-empty', {})} className="p-3 bg-[#151515] border border-emerald-500/30 rounded-xl cursor-grab hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all group select-none">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform"><Music size={20} /></div>
                  <div><div className="text-sm font-bold text-slate-200 group-hover:text-emerald-400">Audio Container</div><div className="text-[10px] text-slate-500">Empty Track</div></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

const TopBar = ({ activeNode, isLibraryVisible, toggleLibrary, handleExport, onSave, isSaving, lastSaved }: any) => (
  <div className="h-16 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-30 shadow-xl">
    <div className="flex items-center gap-4">
      <Button onClick={toggleLibrary} className="p-2 bg-white/5 hover:bg-white/10">{isLibraryVisible ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}</Button>
      <div className="text-sm font-bold text-slate-200">EDITOR</div>
    </div>
    <div className="flex items-center gap-3">
      {lastSaved && !isSaving && (
        <span className="text-xs text-green-500 font-medium animate-in fade-in mr-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Saved</span>
      )}
      <Button onClick={onSave} isLoading={isSaving} className="h-8 text-xs bg-indigo-600">Save</Button>
    </div>
  </div>
);

const AddAssetModal: React.FC<any> = ({ isOpen, onClose, projectId, onAssetAdded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const assets = await addAsset(projectId, file);
      onAssetAdded(assets);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to upload");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96 text-center shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-4">Upload Asset</h3>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        <Button onClick={() => fileInputRef.current?.click()} isLoading={isUploading} className="w-full">Select File</Button>
        <button onClick={onClose} className="mt-4 text-xs text-slate-500 hover:text-white">Cancel</button>
      </div>
    </div>
  );
};


// --- Main App Component ---
function EditorApp() {
  const { projectId } = Route.useSearch();
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isLibraryVisible, setIsLibraryVisible] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // EXPANDED VIEW STATE
  const [isExpanded, setIsExpanded] = useState(false);

  // React Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Video Player State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // --- PREVIEW LOGIC HOOK ---
  const previewState = usePreviewLogic(nodes, edges, activeNodeId);

  // --- FUNCTION: updateNodeData ---
  const updateNodeData = useCallback((id: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      })
    );
  }, [setNodes]);

  // --- Processing Logic (Stitching) ---
  const handleProcessOutput = useCallback(async (nodeId: string) => {
    if (!projectId) return;
    updateNodeData(nodeId, { isProcessing: true, processedUrl: undefined });

    try {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const renderNode = currentNodes.find(n => n.id === nodeId);
      if (!renderNode) throw new Error("Render node not found");

      const renderData = renderNode.data as RenderNodeData;
      const globalMix = {
        videoMixGain: renderData.videoMixGain ?? 1.0,
        audioMixGain: renderData.audioMixGain ?? 1.0
      };

      const rawVideoClips = getSequenceFromHandle(currentNodes, currentEdges, nodeId, 'video-in', 'clip');
      if (!rawVideoClips || rawVideoClips.length === 0) throw new Error("No video clips connected");

      const videoClips = rawVideoClips.map((clip: any) => ({
        url: clip.url.replace(/^https?:\/\/[^/]+/, ''),
        start: clip.start,
        end: clip.end,
        volume: clip.volume ?? 1.0,
        playbackRate: clip.playbackRate ?? 1.0
      }));

      const rawAudioClips = getSequenceFromHandle(currentNodes, currentEdges, nodeId, 'audio-in', 'audio');
      const audioClips = rawAudioClips.map((clip: any) => ({
        url: clip.url.replace(/^https?:\/\/[^/]+/, ''),
        start: clip.start,
        end: clip.end,
        volume: clip.volume ?? 1.0,
        playbackRate: clip.playbackRate ?? 1.0
      }));

      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: videoClips, audioClips, globalMix }),
      });

      if (!response.ok) throw new Error('Render request failed');
      const responseData = await response.json();

      if (responseData.url) {
        updateNodeData(nodeId, { isProcessing: false, processedUrl: responseData.url });
      } else {
        updateNodeData(nodeId, { isProcessing: false });
      }
    } catch (err: any) {
      console.error(err);
      updateNodeData(nodeId, { isProcessing: false });
      alert("Error: " + err.message);
    }
  }, [projectId, getNodes, getEdges, updateNodeData]);

  // --- Hydration ---
  useEffect(() => {
    if (projectId) {
      setIsLoadingProject(true);
      getProject(projectId).then(async (p) => {
        setProject(p);
        const assets = await getProjectAssets(projectId);
        setLibraryAssets(assets);
        if (p.editorState) {
          const hydratedNodes = (p.editorState.nodes || []).map((node: any) => {
            if (node.type === 'render' || node.type === 'output') {
              return { ...node, type: 'render', data: { ...node.data, onProcess: handleProcessOutput } };
            }
            return node;
          });
          setNodes(hydratedNodes);
          if (p.editorState.edges) setEdges(p.editorState.edges);
        }
        setIsLoadingProject(false);
      }).catch(console.error);
    }
  }, [projectId, handleProcessOutput, setNodes, setEdges]);

  // --- Auto-Save ---
  const debouncedNodes = useDebounce(nodes, 1000);
  const debouncedEdges = useDebounce(edges, 1000);
  useEffect(() => {
    if (!projectId || isLoadingProject) return;
    if (debouncedNodes.length === 0 && debouncedEdges.length === 0) return;
    const saveState = async () => {
      setIsSaving(true);
      try {
        await updateProject(projectId, { editorState: { nodes: debouncedNodes, edges: debouncedEdges } });
        setLastSaved(new Date());
      } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };
    saveState();
  }, [debouncedNodes, debouncedEdges, projectId, isLoadingProject]);

  // --- Helpers ---
  const getActiveNode = useCallback(() => {
    if (!activeNodeId) return null;
    return nodes.find(n => n.id === activeNodeId) || null;
  }, [activeNodeId, nodes]);

  useOnSelectionChange({
    onChange: ({ nodes }) => {
      const selected = nodes[0];
      setActiveNodeId(selected ? selected.id : null);
    },
  });

  const onDragStart = (e: React.DragEvent, type: string, payload: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, payload }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const { type, payload } = JSON.parse(raw);
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = crypto.randomUUID();

    if (type === 'asset') {
      const asset = payload as LibraryAsset;
      const duration = asset.duration || 10;
      setNodes(nds => nds.concat({ id, type: 'clip', position, data: { label: asset.name, url: `http://localhost:3001${asset.url}`, filmstrip: asset.filmstrip, thumbnailUrl: asset.thumbnailUrl, sourceDuration: duration, startOffset: 0, endOffset: duration, volume: 1.0, playbackRate: 1.0 } }));
    } else if (type === 'asset-audio') {
      const asset = payload as LibraryAsset;
      setNodes(nds => nds.concat({ id, type: 'audio', position, data: { label: asset.name, url: `http://localhost:3001${asset.url}`, duration: asset.duration || 10, startOffset: 0, endOffset: asset.duration || 10 } }));
    } else if (type === 'node-render') {
      setNodes(nds => nds.concat({ id, type: 'render', position, data: { label: 'Final Render', onProcess: handleProcessOutput, videoMixGain: 1.0, audioMixGain: 1.0 } }));
    } else if (type === 'node-audio-empty') {
      setNodes(nds => nds.concat({ id, type: 'audio', position, data: { label: 'Empty Audio', url: '', duration: 10, startOffset: 0, endOffset: 10 } }));
    }
  }, [screenToFlowPosition, setNodes, handleProcessOutput]);

  const handleSaveProject = async () => {
    if (!projectId) return;
    setIsSaving(true);
    setLastSaved(null);
    try {
      await updateProject(projectId, { editorState: { nodes: getNodes(), edges: getEdges() } });
      setTimeout(() => { setIsSaving(false); setLastSaved(new Date()); }, 500);
    } catch (e) { console.error(e); setIsSaving(false); alert("Save failed"); }
  };

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleSeek = (time: number) => setCurrentTime(time);

  const handleSplit = () => {
    const active = getActiveNode();
    if (!active || active.type !== 'clip') return;
    const clipData = active.data as ClipData;
    const splitTime = clipData.startOffset + currentTime;
    if (splitTime <= clipData.startOffset + 0.1 || splitTime >= clipData.endOffset - 0.1) { alert("Cannot split too close to edge"); return; }
    const leftNode: ClipNodeType = { ...active, id: crypto.randomUUID(), data: { ...clipData, endOffset: splitTime } };
    const rightNode: ClipNodeType = { ...active, id: crypto.randomUUID(), position: { x: active.position.x + 350, y: active.position.y }, data: { ...clipData, startOffset: splitTime } };
    setNodes(nds => nds.filter(n => n.id !== active.id).concat([leftNode, rightNode]));
  };

  if (isLoadingProject || !projectId) return <div className="text-white flex items-center justify-center h-full">Loading Project...</div>;

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] text-white overflow-hidden font-sans relative">
      <TopBar
        activeNode={getActiveNode()}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        isLibraryVisible={isLibraryVisible}
        toggleLibrary={() => setIsLibraryVisible(!isLibraryVisible)}
        handleExport={() => { }}
        onSave={handleSaveProject}
        isSaving={isSaving}
        lastSaved={lastSaved}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <LibraryPanel
          assets={libraryAssets}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          onDragStart={onDragStart}
          isVisible={isLibraryVisible}
        />

        {/* Graph Area */}
        <div className="flex-1 relative h-full bg-[#050505] shadow-inner" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onConnect={(params) => setEdges((eds) => addEdge({ ...params, type: 'button-edge', animated: true, style: { stroke: '#eab308', strokeWidth: 2 } }, eds))}
            fitView
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#222" gap={24} size={1} />
            <Panel position="bottom-center" className="bg-[#1a1a1a] px-4 py-2 rounded-full border border-white/10 shadow-xl mb-4 text-xs text-slate-400">Graph Editor</Panel>
          </ReactFlow>
        </div>

        {/* 
            RIGHT SIDEBAR CONTAINER
            This uses dynamic CSS classes to pop out into "Cinema Mode" 
        */}
        <div
          className={`
                bg-[#000] border-l border-white/5 flex flex-col z-40 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isExpanded
              ? 'fixed inset-4 w-auto h-auto rounded-2xl border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] z-50'
              : 'relative w-[450px] h-full'
            }
            `}
        >
          {(() => {
            const activeNode = getActiveNode();

            // 1. Audio Inspector
            if (activeNode?.type === 'audio') {
              return (
                <AudioInspector
                  projectId={projectId}
                  nodeId={activeNode.id}
                  data={activeNode.data}
                  onUpdateNode={updateNodeData}
                />
              );
            }

            // 2. Video Inspector (Unified)
            return (
              <VideoInspector
                videoRef={videoRef}
                previewState={previewState}
                isPlaying={isPlaying}
                currentTime={currentTime}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onSplit={handleSplit}
                onTimeUpdate={(time) => setCurrentTime(time)}
                onUpdateNode={updateNodeData}
                isProcessing={(activeNode?.data as any)?.isProcessing}
                processedUrl={(activeNode?.data as any)?.processedUrl}
                onProcess={() => activeNode?.id && handleProcessOutput(activeNode.id)}

                // Expansion Props
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
              />
            );
          })()}
        </div>
      </div>

      {/* Background Dimmer when expanded */}
      {isExpanded && (
        <div className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsExpanded(false)} />
      )}

      <AddAssetModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} projectId={projectId} onAssetAdded={(newAssets: LibraryAsset[]) => setLibraryAssets(newAssets)} />
    </div>
  );
}
