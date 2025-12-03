import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  Panel,
  useOnSelectionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play,
  Pause,
  Scissors,
  Download,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Loader2,
  MonitorPlay,
  X,
  Clapperboard,
  Layers,
  Save,
  FileAudio,
  Music // Added Icons
} from 'lucide-react';

import { getProject, getProjectAssets, renderSequence, updateProject } from '../api';
import type { Project } from '../types';
import { Button } from '../components/ui/Button';
import { OutputNode, type OutputNodeType } from '../remotion/nodes/OutputNode';
import { AudioNode, type AudioNodeType } from '../remotion/nodes/AudioNode'; // Imported AudioNode
import ButtonEdge from '../remotion/edges/ButtonEdge';




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


const getSequenceFromHandle = (
  nodes: Node[],
  edges: Edge[],
  targetNodeId: string,
  targetHandleId: string,
  nodeType: string
) => {
  const sequence = [];
  let currentEdge = edges.find(e => e.target === targetNodeId && e.targetHandle === targetHandleId);

  while (currentEdge) {
    const sourceNode = nodes.find(n => n.id === currentEdge!.source);
    if (sourceNode && sourceNode.type === nodeType) {
      // Add to start of array since we are traversing backwards
      sequence.unshift({
        url: sourceNode.data.url,
        // @ts-ignore - Dynamic data access
        start: sourceNode.data.startOffset || 0,
        // @ts-ignore
        end: sourceNode.data.endOffset || sourceNode.data.duration || 0,
        // @ts-ignore
        label: sourceNode.data.label
      });

      // Find the next edge pointing to this node's input (if chaining is supported)
      // For now, let's assume simple chaining: Source -> Target
      const nextEdge = edges.find(e => e.target === sourceNode.id);
      currentEdge = nextEdge;
    } else {
      break;
    }
  }
  return sequence;
};


// --- Types ---
type ClipData = {
  label: string;
  url: string;
  filmstrip: string[];
  thumbnailUrl?: string;
  sourceDuration: number;
  startOffset: number;
  endOffset: number;
  isPlaying?: boolean;
};

interface LibraryAsset {
  name: string;
  url: string;
  filmstrip: string[];
  thumbnailUrl: string;
  duration?: number;
}

type ClipNode = Node<ClipData>;
type EditorNode = ClipNode | OutputNodeType | AudioNodeType; // Updated Union Type

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
};

// --- Helpers ---
const isAudioFile = (filename: string) => {
  return /\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(filename);
};

// --- Node Components ---

const FilmstripNode = ({ id, data, selected }: NodeProps<ClipNode>) => {
  const { setNodes } = useReactFlow();
  const duration = data.endOffset - data.startOffset;

  const thumbnails = useMemo(() => {
    if (data.filmstrip && data.filmstrip.length > 0) return data.filmstrip.slice(0, 5);
    if (data.thumbnailUrl) return [data.thumbnailUrl];
    return [];
  }, [data.filmstrip, data.thumbnailUrl]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  };

  return (
    <div className="relative group w-[300px]">
      <Handle type="target" position={Position.Left} className="!bg-yellow-500 !w-6 !h-6 !rounded-full !border-4 !border-[#1a1a1a] !-left-3 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50" />
      <div className={`flex flex-col w-full bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 ${selected ? 'ring-2 ring-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-[1.02]' : 'ring-1 ring-white/10 shadow-xl hover:ring-white/30'} ${data.isPlaying ? 'ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : ''}`}>
        <div className="px-3 py-2 bg-[#111] flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <span className="text-xs font-medium text-slate-300 truncate max-w-[180px]">{data.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500">{formatTime(duration)}</span>
            <button onClick={handleDelete} className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-white/5" title="Delete Clip">
              <X size={12} />
            </button>
          </div>
        </div>
        <div className="h-24 bg-[#000] relative flex overflow-hidden">
          {thumbnails.length > 0 ? (
            <div className="flex w-full h-full">
              {thumbnails.map((thumb, i) => (
                <div key={i} className="flex-1 border-r border-black/20 last:border-none overflow-hidden relative">
                  <img src={`http://localhost:3001${thumb}`} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" alt={`frame-${i}`} draggable={false} />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[10px]">Processing...</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
          <div className="absolute bottom-1 left-2 font-mono text-[9px] text-white/70">IN: {formatTime(data.startOffset)}</div>
          <div className="absolute bottom-1 right-2 font-mono text-[9px] text-white/70">OUT: {formatTime(data.endOffset)}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-yellow-500 !w-6 !h-6 !rounded-full !border-4 !border-[#1a1a1a] !-right-3 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50" />
    </div>
  );
};

// Update nodeTypes to include 'audio'
const nodeTypes = { clip: FilmstripNode, output: OutputNode, audio: AudioNode };
const edgeTypes = { 'button-edge': ButtonEdge };

// --- Library Panel ---

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
      {/* Tab Headers */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 
                    ${activeTab === 'media' ? 'border-yellow-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <span className="flex items-center justify-center gap-2"><Clapperboard size={14} /> Media</span>
        </button>
        <button
          onClick={() => setActiveTab('nodes')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 
                    ${activeTab === 'nodes' ? 'border-purple-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <span className="flex items-center justify-center gap-2"><Layers size={14} /> Nodes</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {activeTab === 'media' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Project Files</span>
              <Button onClick={onOpenUploadModal} className="h-6 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 border-0">
                + Add File
              </Button>
            </div>

            {assets.length === 0 && (
              <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
                <span className="text-2xl block mb-2 opacity-50">📹</span>
                <p className="text-xs text-slate-500">No media files yet</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              {assets.map(asset => {
                const isAudio = isAudioFile(asset.name);
                return (
                  <div
                    key={asset.name}
                    draggable
                    onDragStart={(e) => onDragStart(e, isAudio ? 'asset-audio' : 'asset', asset)}
                    className={`
                      group flex gap-3 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all hover:shadow-lg hover:shadow-black/50
                      ${isAudio
                        ? 'bg-[#111] border-emerald-900/30 hover:border-emerald-500/50 hover:bg-[#151515]'
                        : 'bg-[#151515] border-white/5 hover:border-yellow-500/50 hover:bg-[#1a1a1a]'
                      }
                    `}
                  >
                    <div className={`
                      w-20 h-12 rounded-md overflow-hidden shrink-0 relative border flex items-center justify-center
                      ${isAudio ? 'bg-emerald-950/30 border-emerald-500/20' : 'bg-black border-white/5'}
                    `}>
                      {isAudio ? (
                        <FileAudio className="text-emerald-600 opacity-80" size={20} />
                      ) : (
                        asset.thumbnailUrl ? (
                          <img src={`http://localhost:3001${asset.thumbnailUrl}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={asset.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600 text-[10px]">No Prev</div>
                        )
                      )}

                      <div className="absolute bottom-0 right-0 bg-black/80 px-1 rounded-tl-md text-[8px] font-mono text-white">
                        {asset.duration ? formatTime(asset.duration) : '0:00'}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className={`text-xs font-bold truncate transition-colors ${isAudio ? 'text-emerald-100 group-hover:text-emerald-400' : 'text-slate-200 group-hover:text-yellow-400'}`}>
                        {asset.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                        {isAudio ? 'Audio Track' : 'Video Clip'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Processors Section */}
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Processors</div>
              <div
                draggable
                onDragStart={(e) => onDragStart(e, 'node-output', {})}
                className="p-3 bg-[#151515] border border-purple-500/30 rounded-xl cursor-grab active:cursor-grabbing hover:bg-[#1a1a1a] hover:border-purple-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all group select-none"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                    <FlaskConical size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200 group-hover:text-purple-400 transition-colors">Output Node</div>
                    <div className="text-[10px] text-slate-500">Render & Preview</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed bg-black/20 p-2 rounded border border-white/5">
                  Final destination for your sequence. Connect clips here to render.
                </div>
              </div>
            </div>

            {/* Audio Section (New) */}
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Audio</div>
              <div
                draggable
                onDragStart={(e) => onDragStart(e, 'node-audio-empty', {})}
                className="p-3 bg-[#151515] border border-emerald-500/30 rounded-xl cursor-grab active:cursor-grabbing hover:bg-[#1a1a1a] hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all group select-none"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                    <Music size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">Audio Clip</div>
                    <div className="text-[10px] text-slate-500">Sound / Music</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed bg-black/20 p-2 rounded border border-white/5">
                  Generic audio container. Drag to graph.
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </aside>
  );
};

// --- Top Bar ---
const TopBar = ({
  activeNode,
  onOpenUploadModal,
  isLibraryVisible,
  toggleLibrary,
  handleExport,
  onSave,
  isSaving,
  lastSaved
}: any) => (
  <div className="h-16 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-30 shadow-xl">
    <div className="flex items-center gap-4">
      <Button onClick={toggleLibrary} className={`p-2 rounded-md transition-colors ${isLibraryVisible ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
        {isLibraryVisible ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </Button>
      <div className="text-sm font-bold text-slate-200 tracking-wider uppercase">Editor</div>
      <div className="h-4 w-px bg-white/10" />
      <div className="text-xs text-slate-500">{activeNode ? `Active: ${activeNode.data.label}` : 'No Clip Selected'}</div>
    </div>

    <div className="flex items-center gap-3">
      {lastSaved && !isSaving && (
        <span className="text-xs text-green-500 font-medium animate-in fade-in mr-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Saved
        </span>
      )}

      <Button
        onClick={onSave}
        isLoading={isSaving}
        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 flex items-center gap-2"
      >
        <Save size={14} /> Save
      </Button>

      <Button onClick={handleExport} className="h-8 text-xs bg-transparent border border-white/10 hover:bg-white/5 text-slate-400 flex items-center gap-2">
        <Download size={14} /> Export
      </Button>
    </div>
  </div>
);

// --- Modals ---
const AddAssetModal: React.FC<any> = ({ isOpen, onClose, projectId, onAssetAdded }) => isOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">Modal Stub</div> : null;

// --- Progress Bar ---
const ProgressBar = ({ currentTime, duration, onSeek }: { currentTime: number, duration: number, onSeek: (time: number) => void }) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateTime = (e: React.MouseEvent | MouseEvent) => {
    if (!progressBarRef.current || duration === 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    return percentage * duration;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    onSeek(calculateTime(e));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        onSeek(calculateTime(e));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, onSeek]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={progressBarRef}
      className="absolute top-0 left-0 right-0 h-1 bg-white/10 cursor-pointer group hover:h-2 transition-all z-30"
      onMouseDown={handleMouseDown}
    >
      <div
        className="h-full bg-yellow-500 relative"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
      </div>
    </div>
  );
};

// --- Main App Component ---

function EditorApp() {
  const { projectId } = Route.useSearch();
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();

  const [project, setProject] = useState<Project | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isLibraryVisible, setIsLibraryVisible] = useState(true);

  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Handle Node Selection & Preview
  useOnSelectionChange({
    onChange: ({ nodes }) => {
      const selected = nodes[0];
      setSelectedNodeId(selected ? selected.id : null);

      if (selected) {
        setActiveNodeId(selected.id);
        if (selected.type === 'output') {
          const outData = selected.data as any;
          if (outData.processedUrl && videoRef.current) {
            videoRef.current.src = `http://localhost:3001${outData.processedUrl}`;
            videoRef.current.pause();
            setIsPlaying(false);
          }
        } else if (selected.type === 'clip') {
          const clipData = selected.data as ClipData;
          if (videoRef.current) {
            const currentSrc = videoRef.current.src;
            const newSrc = clipData.url;

            if (currentSrc !== newSrc) {
              videoRef.current.src = newSrc;
              videoRef.current.currentTime = clipData.startOffset;
            }
          }
        }
        // TODO: Handle Audio Preview in the future
      } else {
        setActiveNodeId(null);
      }
    },
  });

  const handleProcessOutput = useCallback(async (nodeId: string) => {
    if (!projectId) return;

    // Set processing state
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isProcessing: true } } : n));

    try {
      const edges = getEdges();
      const nodes = getNodes();

      // 1. Get Video Sequence
      const videoClips = getSequenceFromHandle(nodes, edges, nodeId, 'video-in', 'clip');

      // 2. Get Audio Sequence (New Logic)
      const audioClips = getSequenceFromHandle(nodes, edges, nodeId, 'audio-in', 'audio');

      if (videoClips.length === 0) {
        throw new Error("No video sequence connected to the Video Input!");
      }

      console.log("Sending to render:", { videoClips, audioClips });

      // 3. Send to Backend
      // We rely on the generic 'renderSequence' API, but we'll modify it to accept audioClips
      // Note: You might need to update api.ts if strict typing is enforced, but JSON body allows it.
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: videoClips,
          audioClips: audioClips // Add this field
        }),
      });

      if (!response.ok) throw new Error('Render request failed');
      const result = await response.json();

      // 4. Update Node with Result
      setNodes(nds => nds.map(n => n.id === nodeId ? {
        ...n,
        data: {
          ...n.data,
          isProcessing: false,
          processedUrl: result.url
        }
      } : n));

      // 5. Auto-play result
      if (videoRef.current) {
        videoRef.current.src = `http://localhost:3001${result.url}`;
        videoRef.current.play();
        setIsPlaying(true);
        setActiveNodeId(nodeId);
      }

    } catch (e: any) {
      console.error("Processing failed", e);
      alert(`Processing failed: ${e.message}`);
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isProcessing: false } } : n));
    }
  }, [projectId, getEdges, getNodes, setNodes]);


  const onDragStart = (e: React.DragEvent, type: string, payload: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, payload }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;

    const { type, payload } = JSON.parse(raw);
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    if (type === 'asset') {
      const asset = payload as LibraryAsset;
      let duration = asset.duration || 10;
      const newNode: ClipNode = {
        id: crypto.randomUUID(),
        type: 'clip',
        position,
        data: {
          label: asset.name,
          url: `http://localhost:3001${asset.url}`,
          filmstrip: asset.filmstrip,
          thumbnailUrl: asset.thumbnailUrl,
          sourceDuration: duration,
          startOffset: 0,
          endOffset: duration,
        }
      };
      setNodes(nds => nds.concat(newNode));
    } else if (type === 'asset-audio') {
      // NEW: Audio Node Creation Logic
      const asset = payload as LibraryAsset;
      let duration = asset.duration || 10;

      const newNode: AudioNodeType = {
        id: crypto.randomUUID(),
        type: 'audio',
        position,
        data: {
          label: asset.name,
          url: `http://localhost:3001${asset.url}`,
          duration: duration,
          startOffset: 0,
          endOffset: duration
        }
      };
      setNodes(nds => nds.concat(newNode));
    } else if (type === 'node-output') {
      const newNode: OutputNodeType = {
        id: crypto.randomUUID(),
        type: 'output',
        position,
        style: { background: 'transparent', border: 'none', width: 'auto', padding: 0 },
        data: {
          label: 'Final Render',
          onProcess: handleProcessOutput
        }
      };
      setNodes(nds => nds.concat(newNode));
    } else if (type === 'node-audio-empty') {
      const newNode: AudioNodeType = {
        id: crypto.randomUUID(),
        type: 'audio',
        position,
        data: {
          label: 'Empty Audio',
          url: '', // Empty URL indicates placeholder
          duration: 10,
          startOffset: 0,
          endOffset: 10
        }
      };
      setNodes(nds => nds.concat(newNode));
    }
  }, [screenToFlowPosition, setNodes, handleProcessOutput]);

  const getActiveNodeData = useCallback(() => {
    if (!activeNodeId) return undefined;
    const node = nodes.find(n => n.id === activeNodeId);
    if (node && node.type === 'clip') return node as ClipNode;
    // We could return AudioNodeData here if we wanted to show specific audio tools
    return undefined;
  }, [activeNodeId, nodes]);

  // Loading Logic
  useEffect(() => {
    if (projectId) {
      setIsLoadingProject(true);
      getProject(projectId).then(async (p) => {
        setProject(p);
        const assets = await getProjectAssets(projectId);
        setLibraryAssets(assets);

        // Restore Editor State if exists
        if (p.editorState) {
          if (p.editorState.nodes) setNodes(p.editorState.nodes);
          if (p.editorState.edges) setEdges(p.editorState.edges);
        }

        setIsLoadingProject(false);
      }).catch(console.error);
    }
  }, [projectId]);

  // Saving Logic
  const handleSaveProject = async () => {
    if (!projectId) return;
    setIsSaving(true);
    setLastSaved(null);

    const editorState = {
      nodes: getNodes(),
      edges: getEdges()
    };

    try {
      await updateProject(projectId, { editorState });
      setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
        setTimeout(() => setLastSaved(null), 3000);
      }, 500);
    } catch (e) {
      console.error("Failed to save project", e);
      setIsSaving(false);
      alert("Failed to save project state.");
    }
  };

  // Player Controls
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSplit = () => {
    if (!activeNodeId) return;
    const node = nodes.find(n => n.id === activeNodeId);
    if (!node || node.type !== 'clip') return;

    const clipData = node.data as ClipData;
    const splitTime = currentTime;

    if (splitTime <= clipData.startOffset + 0.1 || splitTime >= clipData.endOffset - 0.1) {
      alert("Cannot split too close to the edge");
      return;
    }

    const leftNode: ClipNode = {
      ...node,
      id: crypto.randomUUID(),
      data: {
        ...clipData,
        endOffset: splitTime
      }
    };

    const rightNode: ClipNode = {
      ...node,
      id: crypto.randomUUID(),
      position: { x: node.position.x + 350, y: node.position.y },
      data: {
        ...clipData,
        startOffset: splitTime
      }
    };

    setNodes(nds => nds.filter(n => n.id !== activeNodeId).concat([leftNode, rightNode]));

    const incoming = edges.filter(e => e.target === activeNodeId);
    const outgoing = edges.filter(e => e.source === activeNodeId);
    const newEdges: Edge[] = [];

    incoming.forEach(e => {
      newEdges.push({ ...e, id: crypto.randomUUID(), target: leftNode.id });
    });

    outgoing.forEach(e => {
      newEdges.push({ ...e, id: crypto.randomUUID(), source: rightNode.id });
    });

    newEdges.push({
      id: crypto.randomUUID(),
      source: leftNode.id,
      target: rightNode.id,
      type: 'button-edge',
      animated: true,
      style: { stroke: '#eab308', strokeWidth: 2 }
    });

    setEdges(eds => eds.filter(e => e.source !== activeNodeId && e.target !== activeNodeId).concat(newEdges));
    setActiveNodeId(rightNode.id);
  };

  const handleExport = () => { };
  const handleUploadClick = () => setIsUploadModalOpen(true);
  const handleAssetAdded = (updatedAssets: LibraryAsset[]) => setLibraryAssets(updatedAssets);

  if (isLoadingProject || !projectId) return <div className="text-white">Loading...</div>;

  return (
    <>
      <div className="flex flex-col h-full w-full bg-[#050505] text-white overflow-hidden font-sans">
        <TopBar
          activeNode={getActiveNodeData()}
          onOpenUploadModal={handleUploadClick}
          isLibraryVisible={isLibraryVisible}
          toggleLibrary={() => setIsLibraryVisible(!isLibraryVisible)}
          handleExport={handleExport}
          onSave={handleSaveProject}
          isSaving={isSaving}
          lastSaved={lastSaved}
        />

        <div className="flex flex-1 overflow-hidden">
          <LibraryPanel
            assets={libraryAssets}
            onOpenUploadModal={handleUploadClick}
            onDragStart={onDragStart}
            isVisible={isLibraryVisible}
          />

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
            >
              <Background color="#222" gap={24} size={1} />
              <Panel position="bottom-center" className="bg-[#1a1a1a] px-4 py-2 rounded-full border border-white/10 shadow-xl mb-4 text-xs text-slate-400">Graph Editor</Panel>
            </ReactFlow>
          </div>

          <div className="w-[450px] bg-[#000] border-l border-white/5 flex flex-col z-20 shadow-2xl relative">
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) setDuration(videoRef.current.duration);
                }}
                onClick={handlePlayPause}
              />
              {!activeNodeId && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-700"><MonitorPlay size={48} className="mb-2 opacity-30" /><span className="text-sm">Select a clip to preview</span></div>}
            </div>

            {/* Player Controls */}
            <div className="h-16 bg-[#0a0a0a] border-t border-white/5 px-4 flex items-center justify-between shrink-0 relative">
              <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} />
              <div className="flex items-center gap-2">
                <Button onClick={handlePlayPause} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all">
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </Button>
                <div className="flex flex-col ml-2">
                  <span className="text-lg font-mono font-bold text-yellow-500 leading-none">{formatTime(currentTime)}</span>
                  <span className="text-[10px] font-mono text-slate-600 leading-none mt-1">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSplit}
                  disabled={!activeNodeId || (getActiveNodeData() === undefined)}
                  className="h-8 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-bold border border-white/5"
                  title="Split Clip at Current Time"
                >
                  <Scissors size={14} /> Split
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AddAssetModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} projectId={projectId} onAssetAdded={handleAssetAdded} />
    </>
  );
}