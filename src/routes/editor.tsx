import { createFileRoute, useNavigate } from '@tanstack/react-router';
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
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Panel,
  useOnSelectionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { getProject, getProjectAssets, addAsset, deleteAsset, exportProject, renderSequence } from '../api';
import type { Project } from '../types';
import { Button } from '../components/ui/Button';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { fetchFile } from '@ffmpeg/util';
import { OutputNode, type OutputNodeType } from '../remotion/nodes/OutputNode';

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
type EditorNode = ClipNode | OutputNodeType;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
};

const FilmstripNode = ({ data, selected }: NodeProps<ClipNode>) => {
  const duration = data.endOffset - data.startOffset;

  const thumbnails = useMemo(() => {
    if (data.filmstrip && data.filmstrip.length > 0) return data.filmstrip.slice(0, 5);
    if (data.thumbnailUrl) return [data.thumbnailUrl];
    return [];
  }, [data.filmstrip, data.thumbnailUrl]);

  return (
    <div className="relative group w-[300px]">
      <Handle type="target" position={Position.Left} className="!bg-yellow-500 !w-6 !h-6 !rounded-full !border-4 !border-[#1a1a1a] !-left-3 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50" />
      <div className={`flex flex-col w-full bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 ${selected ? 'ring-2 ring-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-[1.02]' : 'ring-1 ring-white/10 shadow-xl hover:ring-white/30'} ${data.isPlaying ? 'ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : ''}`}>
        <div className="px-3 py-2 bg-[#111] flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <span className="text-xs font-medium text-slate-300 truncate max-w-[180px]">{data.label}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">{formatTime(duration)}</span>
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
              <div className="w-6 h-6 rounded-full border-2 border-slate-800 border-t-slate-600 animate-spin" />
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

const nodeTypes = { clip: FilmstripNode, output: OutputNode };

// TopBar (placeholder to reduce file size display)
const TopBar = ({ activeNode, currentTime, isPlaying, handleSplit, handlePlayPause, handlePlaySequence, onOpenUploadModal, isLibraryVisible, toggleLibrary, handleExport }: any) => (
  <div className="h-16 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-30 shadow-xl">
    <div className="flex items-center gap-4">
      <Button onClick={toggleLibrary} className={`p-2 rounded-md transition-colors ${isLibraryVisible ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </Button>
      <div className="text-sm font-bold text-slate-200 tracking-wider uppercase">Editor</div>
      <div className="h-4 w-px bg-white/10" />
      <div className="text-xs text-slate-500">{activeNode ? `Active: ${activeNode.data.label}` : 'No Clip Selected'}</div>
    </div>
    <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
      <div className="font-mono text-2xl font-bold text-yellow-500 tabular-nums tracking-tight min-w-[120px] text-center">{activeNode ? formatTime(currentTime) : "--:--.--"}</div>
      <div className="flex items-center gap-2">
        <Button onClick={(e) => { e.stopPropagation(); handlePlaySequence(); }} className="h-10 px-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white border border-white/5 font-bold">⏮ Play All</Button>
        <Button onClick={(e) => { e.stopPropagation(); handlePlayPause(); }} disabled={!activeNode} className={`h-10 px-6 rounded-full font-bold transition-all ${isPlaying ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>{isPlaying ? '⏸ Pause' : '▶ Play Clip'}</Button>
        <Button onClick={(e) => { e.stopPropagation(); handleSplit(); }} disabled={!activeNode || (activeNode.data.endOffset - activeNode.data.startOffset) < 0.2} className="h-10 px-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5">✂ Split</Button>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <Button onClick={onOpenUploadModal} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20">+ Asset</Button>
      <Button onClick={handleExport} className="h-8 text-xs bg-transparent border border-white/10 hover:bg-white/5 text-slate-400">Export</Button>
    </div>
  </div>
);

// Modals
const AddAssetModal: React.FC<any> = ({ isOpen, onClose, projectId, onAssetAdded }) => isOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">Modal Stub</div> : null;
const ExportLoadingModal = ({ isOpen }: { isOpen: boolean }) => null;

function EditorApp() {
  const { projectId } = Route.useSearch();
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();

  const [project, setProject] = useState<Project | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isLibraryVisible, setIsLibraryVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<'media' | 'nodes'>('media');

  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useOnSelectionChange({
    onChange: ({ nodes }) => {
      setSelectedNodeId(nodes.length > 0 ? nodes[0].id : null);
      if (nodes.length > 0 && nodes[0].type === 'output') {
        const outData = nodes[0].data as any;
        if (outData.processedUrl && videoRef.current) {
          videoRef.current.src = `http://localhost:3001${outData.processedUrl}`;
          videoRef.current.pause();
          setIsPlaying(false);
          setActiveNodeId(nodes[0].id);
        }
      }
    },
  });

  const handleProcessOutput = useCallback(async (nodeId: string) => {
    if (!projectId) return;

    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isProcessing: true } } : n));

    try {
      const edges = getEdges();
      const nodes = getNodes();
      const videoEdge = edges.find(e => e.target === nodeId && e.targetHandle === 'video-in');

      if (!videoEdge) throw new Error("No video sequence connected to the Video Input!");

      const backwardsSequence = [];
      let currentId: string | null = videoEdge.source;

      while (currentId) {
        const node = nodes.find(n => n.id === currentId);
        if (node && node.type === 'clip') {
          const clipData = node.data as ClipData;
          backwardsSequence.push({
            url: clipData.url,
            start: clipData.startOffset,
            end: clipData.endOffset
          });
          const incomingEdge = edges.find(e => e.target === currentId);
          currentId = incomingEdge ? incomingEdge.source : null;
        } else {
          break;
        }
      }

      const forwardSequence = backwardsSequence.reverse();
      if (forwardSequence.length === 0) throw new Error("No clips found in the connected sequence.");

      const result = await renderSequence(projectId, forwardSequence);

      setNodes(nds => nds.map(n => n.id === nodeId ? {
        ...n,
        data: {
          ...n.data,
          isProcessing: false,
          processedUrl: result.url
        }
      } : n));

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
    } else if (type === 'node-output') {
      const newNode: OutputNodeType = {
        id: crypto.randomUUID(),
        type: 'output',
        position,
        // FIX: Remove white rectangle by making the container transparent
        style: { background: 'transparent', border: 'none', width: 'auto', padding: 0 },
        data: {
          label: 'Final Render',
          onProcess: handleProcessOutput
        }
      };
      setNodes(nds => nds.concat(newNode));
    }
  }, [screenToFlowPosition, setNodes, handleProcessOutput]);

  const getActiveNodeData = useCallback(() => {
    if (!activeNodeId) return undefined;
    const node = nodes.find(n => n.id === activeNodeId);
    if (node && node.type === 'clip') return node as ClipNode;
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
        setIsLoadingProject(false);
      }).catch(console.error);
    }
  }, [projectId]);

  // Stubs for controls (use previous implementation)
  const handleSplit = () => { };
  const handlePlayPause = () => { if (videoRef.current) { isPlaying ? videoRef.current.pause() : videoRef.current.play(); setIsPlaying(!isPlaying); } };
  const handlePlaySequence = () => { };
  const handleExport = () => { };
  const handleUploadClick = () => setIsUploadModalOpen(true);
  const handleAssetAdded = (updatedAssets: LibraryAsset[]) => setLibraryAssets(updatedAssets);

  if (isLoadingProject || !projectId) return <div className="text-white">Loading...</div>;

  return (
    <>
      <div className="flex flex-col h-full w-full bg-[#050505] text-white overflow-hidden font-sans">
        <TopBar
          activeNode={getActiveNodeData()}
          currentTime={currentTime}
          isPlaying={isPlaying}
          handleSplit={handleSplit}
          handlePlayPause={handlePlayPause}
          handlePlaySequence={handlePlaySequence}
          onOpenUploadModal={handleUploadClick}
          isLibraryVisible={isLibraryVisible}
          toggleLibrary={() => setIsLibraryVisible(!isLibraryVisible)}
          handleExport={handleExport}
        />

        <div className="flex flex-1 overflow-hidden">
          {isLibraryVisible && (
            <aside className="w-[300px] bg-[#0a0a0a] border-r border-white/5 flex flex-col z-20 shrink-0 transition-all">
              <div className="flex border-b border-white/5">
                <button onClick={() => setActiveTab('media')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'media' ? 'border-yellow-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Media</button>
                <button onClick={() => setActiveTab('nodes')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'nodes' ? 'border-purple-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Nodes</button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {activeTab === 'media' ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Project Assets</span>
                      <Button onClick={handleUploadClick} className="h-6 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-500">+ Add</Button>
                    </div>
                    {libraryAssets.map(asset => (
                      <div key={asset.name} draggable onDragStart={(e) => onDragStart(e, 'asset', asset)} className="group flex gap-3 p-2 rounded-lg bg-[#151515] border border-white/5 hover:border-yellow-500/50 cursor-grab hover:bg-[#1a1a1a] transition-all">
                        <div className="w-16 h-10 bg-black rounded overflow-hidden shrink-0">
                          {asset.thumbnailUrl ? <img src={`http://localhost:3001${asset.thumbnailUrl}`} className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-200 truncate">{asset.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{asset.duration ? formatTime(asset.duration) : 'UNK'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Process Nodes</div>
                    <div draggable onDragStart={(e) => onDragStart(e, 'node-output', {})} className="p-3 bg-[#151515] border border-purple-500/30 rounded-xl cursor-grab hover:bg-[#1a1a1a] hover:border-purple-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all group">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">⚗️</div>
                        <div>
                          <div className="text-sm font-bold text-slate-200 group-hover:text-purple-400 transition-colors">Output Node</div>
                          <div className="text-[10px] text-slate-500">Render & Preview</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 pl-11">Stitches connected clips into a single video file.</div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}

          <div className="flex-1 relative h-full bg-[#050505] shadow-inner" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} onConnect={(params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#eab308', strokeWidth: 2 } }, eds))} fitView minZoom={0.1}>
              <Background color="#222" gap={24} size={1} />
              <Panel position="bottom-center" className="bg-[#1a1a1a] px-4 py-2 rounded-full border border-white/10 shadow-xl mb-4 text-xs text-slate-400">Graph Editor</Panel>
            </ReactFlow>
          </div>

          <div className="w-[450px] bg-[#000] border-l border-white/5 flex flex-col z-20 shadow-2xl relative">
            <video ref={videoRef} className="w-full h-full object-contain" onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }} onClick={handlePlayPause} />
            {!activeNodeId && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-700"><span className="text-4xl mb-2 opacity-30">📺</span><span className="text-sm">Select a clip to preview</span></div>}
          </div>
        </div>
      </div>
      <AddAssetModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} projectId={projectId} onAssetAdded={handleAssetAdded} />
    </>
  );
}