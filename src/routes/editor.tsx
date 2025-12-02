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

import { getProject, getProjectAssets, addAsset } from '../api';
import type { Project } from '../types';
import { Button } from '../components/ui/Button';
import { useFFmpeg } from '../hooks/useFFmpeg'; // <-- NEW IMPORT
import { fetchFile } from '@ffmpeg/util';       // <-- NEW IMPORT

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
  thumbnailUrl?: string; // Added fallback
  sourceDuration: number;
  startOffset: number;
  endOffset: number;
  isPlaying?: boolean;
};

// Interface for server response asset
interface LibraryAsset {
  name: string;
  url: string;
  filmstrip: string[];
  thumbnailUrl: string;
  duration?: number;
}

type ClipNode = Node<ClipData>;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
};

// --- Custom Node: Filmstrip Node ---
const FilmstripNode = ({ data, selected }: NodeProps<ClipNode>) => {
  const duration = data.endOffset - data.startOffset;

  // Calculate how many thumbnails we can show based on width (approx)
  // For now, we'll just show up to 5 evenly spaced frames if available
  const thumbnails = useMemo(() => {
    if (data.filmstrip && data.filmstrip.length > 0) {
      return data.filmstrip.slice(0, 5);
    }
    // Fallback: If no filmstrip, use the single thumbnail repeated or just once
    if (data.thumbnailUrl) {
      return [data.thumbnailUrl];
    }
    return [];
  }, [data.filmstrip, data.thumbnailUrl]);

  return (
    <div className="relative group w-[300px]">
      {/* Input Handle - Left Side */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-yellow-500 !w-6 !h-6 !rounded-full !border-4 !border-[#1a1a1a] !-left-3 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50"
      />

      {/* Content Container */}
      <div
        className={`
          flex flex-col w-full bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300
          ${selected ? 'ring-2 ring-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-[1.02]' : 'ring-1 ring-white/10 shadow-xl hover:ring-white/30'}
          ${data.isPlaying ? 'ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : ''}
        `}
      >
        {/* Header */}
        <div className="px-3 py-2 bg-[#111] flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <span className="text-xs font-medium text-slate-300 truncate max-w-[180px]">{data.label}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">{formatTime(duration)}</span>
        </div>

        {/* Filmstrip Content */}
        <div className="h-24 bg-[#000] relative flex overflow-hidden">
          {thumbnails.length > 0 ? (
            <div className="flex w-full h-full">
              {thumbnails.map((thumb, i) => (
                <div key={i} className="flex-1 border-r border-black/20 last:border-none overflow-hidden relative">
                  <img
                    src={`http://localhost:3001${thumb}`}
                    className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                    alt={`frame-${i}`}
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-slate-800 border-t-slate-600 animate-spin" />
              <span className="text-[10px]">Processing...</span>
            </div>
          )}

          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />

          {/* Time Indicators */}
          <div className="absolute bottom-1 left-2 font-mono text-[9px] text-white/70">
            IN: {formatTime(data.startOffset)}
          </div>
          <div className="absolute bottom-1 right-2 font-mono text-[9px] text-white/70">
            OUT: {formatTime(data.endOffset)}
          </div>
        </div>
      </div>

      {/* Output Handle - Right Side */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-yellow-500 !w-6 !h-6 !rounded-full !border-4 !border-[#1a1a1a] !-right-3 top-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-50"
      />
    </div>
  );
};

const nodeTypes = { clip: FilmstripNode };

// --- Top Bar Component ---
interface TopBarProps {
  activeNode: ClipNode | undefined;
  currentTime: number;
  isPlaying: boolean;
  handleSplit: () => void;
  handlePlayPause: () => void;
  handlePlaySequence: () => void;
  onOpenUploadModal: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ activeNode, currentTime, isPlaying, handleSplit, handlePlayPause, handlePlaySequence, onOpenUploadModal }) => {
  return (
    <div className="h-16 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-30 shadow-xl">
      {/* Left: Branding / Status */}
      <div className="flex items-center gap-4">
        <div className="text-sm font-bold text-slate-200 tracking-wider uppercase">Editor</div>
        <div className="h-4 w-px bg-white/10" />
        <div className="text-xs text-slate-500">
          {activeNode ? `Active: ${activeNode.data.label}` : 'No Clip Selected'}
        </div>
      </div>

      {/* Center: Controls */}
      <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
        <div className="font-mono text-2xl font-bold text-yellow-500 tabular-nums tracking-tight min-w-[120px] text-center">
          {activeNode ? formatTime(currentTime) : "--:--.--"}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={(e) => { e.stopPropagation(); handlePlaySequence(); }}
            className="h-10 px-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white border border-white/5 font-bold"
            title="Play from Start of Sequence"
          >
            ⏮ Play All
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
            disabled={!activeNode}
            className={`h-10 px-6 rounded-full font-bold transition-all ${isPlaying ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play Clip'}
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); handleSplit(); }}
            disabled={!activeNode || (activeNode.data.endOffset - activeNode.data.startOffset) < 0.2}
            className="h-10 px-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5"
            title="Split Clip"
          >
            ✂ Split
          </Button>
        </div>
      </div>

      {/* Right: Actions (Placeholder) */}
      <div className="flex items-center gap-3">
        <Button
          onClick={onOpenUploadModal}
          className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20"
        >
          + Asset
        </Button>
        <Button className="h-8 text-xs bg-transparent border border-white/10 hover:bg-white/5 text-slate-400">
          Export
        </Button>
      </div>
    </div>
  );
}

// --- NEW: Add Asset Modal Component ---
interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onAssetAdded: (assets: LibraryAsset[]) => void;
}

const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onAssetAdded
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusText, setStatusText] = useState(''); // NEW STATE

  // --- FFmpeg Integration ---
  const { ffmpeg, loaded: ffmpegLoaded } = useFFmpeg();

  const handleFileChangeForConversion = async (inputFile: File): Promise<File> => {
    let fileToUpload = inputFile;
    setStatusText('Analyzing Codec...');

    if (ffmpegLoaded) {
      try {
        await ffmpeg.writeFile('input.mp4', await fetchFile(inputFile));

        let isH265 = false;
        const logCallback = ({ message }: { message: string }) => {
          if (message.toLowerCase().includes('hevc') || message.toLowerCase().includes('h265')) isH265 = true
        }
        ffmpeg.on('log', logCallback)
        await ffmpeg.exec(['-i', 'input.mp4'])
        ffmpeg.off('log', logCallback)

        if (isH265) {
          setStatusText('Converting to H.264...');
          // Transcode to H.264, keep audio (copy)
          await ffmpeg.exec(['-i', 'input.mp4', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'copy', 'output.mp4']);

          // FIX 1: Handle Uint8Array from readFile and create a clean ArrayBuffer for Blob
          const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
          const blob = new Blob([data as BlobPart], { type: 'video/mp4' });

          fileToUpload = new File([blob], inputFile.name.replace(/\.[^/.]+$/, "") + "_h264.mp4", { type: 'video/mp4' });
        }
      } catch (err) {
        console.warn("Client-side H.264 conversion failed, using original file.", err);
        setStatusText('Using original file...');
      }
    }

    setFile(fileToUpload);
    setStatusText(''); // Clear status after file selection/conversion attempt
    return fileToUpload;
  };
  // --- END FFmpeg Integration ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !projectId) return;

    setLoading(true);
    try {
      // Note: file might be the original or the converted one
      const updatedAssets = await addAsset(projectId, file);
      onAssetAdded(updatedAssets);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to upload and process asset');
    } finally {
      setLoading(false);
    }
  };

  // Update file state to trigger conversion analysis/processing on selection
  const handleFileChange = (inputFile: File | null) => {
    if (inputFile) {
      setFile(null); // Clear file first so component state updates
      setStatusText('Initializing...');
      handleFileChangeForConversion(inputFile);
    }
  };

  const handleFileSelectClick = () => {
    if (!loading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0] || null);
  };


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // *** FIX FOR ORIGINAL ERROR ***
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // FIX 2: Cast relatedTarget to Node to satisfy the contains() method signature.
    if (e.relatedTarget instanceof Element && !(e.currentTarget.contains(e.relatedTarget))) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-white/10">
        {/* Fixed Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Add Project Asset</h2>
            <p className="text-slate-400 text-xs">Upload a video file to the library</p>
          </div>
          <button onClick={onClose} disabled={loading} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors" title="Close">✕</button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="add-asset-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">File Selection</label>
              <div
                onClick={handleFileSelectClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                                    relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[140px]
                                    ${isDragging ? 'border-blue-500 bg-blue-500/10 scale-[0.99]' : file ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 bg-slate-950 hover:border-slate-500 hover:bg-slate-900'}
                                    ${loading ? 'opacity-50 pointer-events-none' : ''}
                                `}
              >
                <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelectChange} className="hidden" disabled={loading} />
                {file ? (
                  <div className="animate-in fade-in zoom-in duration-200">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mb-2 mx-auto text-slate-900 text-lg shadow-lg shadow-green-500/20">✓</div>
                    <p className="font-bold text-white text-sm truncate max-w-[200px]">{file.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-2 text-slate-400 text-xl">☁️</div>
                    <p className="font-bold text-slate-300 text-sm">Drag & Drop Video Here</p>
                    <p className="text-slate-500 text-xs mt-1">or click to select a file (MP4, MOV supported)</p>
                  </>
                )}
              </div>
            </div>

            {/* Status Text */}
            {statusText && (
              <div className="text-center text-sm text-blue-400 font-medium animate-pulse flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                {statusText}
              </div>
            )}
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-end gap-4 shrink-0">
          <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors text-xs">Cancel</button>
          <Button type="submit" form="add-asset-form" disabled={!file || loading} isLoading={loading} className="flex-1 max-w-[200px]">
            {loading ? 'Processing...' : 'Add to Library'}
          </Button>
        </div>
      </div>
    </div>
  );
};


function EditorApp() {
  const { projectId } = Route.useSearch();
  const { screenToFlowPosition } = useReactFlow();

  const [project, setProject] = useState<Project | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); // NEW STATE

  const [nodes, setNodes, onNodesChange] = useNodesState<ClipNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // New state for tracking selection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Hook to listen for selection changes from React Flow
  useOnSelectionChange({
    onChange: ({ nodes }) => {
      // nodes will be an array of selected nodes, or empty if nothing is selected
      setSelectedNodeId(nodes.length > 0 ? nodes[0].id : null);
    },
  });

  // --- ASSET MANAGEMENT ---
  const handleRemoveAsset = useCallback(async (assetName: string) => {
    if (!projectId) return;
    if (!confirm(`Are you sure you want to remove the asset "${assetName}" from the project library? This will not remove it from existing nodes.`)) return;

    // TODO: Implement actual backend call to delete asset from project source folder

    setLibraryAssets(prev => prev.filter(asset => asset.name !== assetName));
    alert(`Asset "${assetName}" removed from library (Backend removal pending).`);
  }, [projectId]);


  // --- UPLOAD LOGIC ---
  const handleUploadClick = () => {
    setIsUploadModalOpen(true); // NEW: Open Modal instead of triggering file input directly
  };

  const handleAssetAdded = (updatedAssets: LibraryAsset[]) => {
    setLibraryAssets(updatedAssets);
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setIsUploading(true);
    try {
      // Note: addAsset returns the *updated list* of assets, including URLs/filmstrips for the new one.
      const updatedAssets = await addAsset(projectId, file);
      setLibraryAssets(updatedAssets);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Playback Logic based on Flow State ---
  const getNextNodeId = useCallback((currentId: string): string | null => {
    const outgoingEdge = edges.find(e => e.source === currentId);
    return outgoingEdge ? outgoingEdge.target : null;
  }, [edges]);

  const getActiveNodeData = useCallback(() => {
    if (!activeNodeId) return undefined;
    return nodes.find(n => n.id === activeNodeId) as ClipNode | undefined;
  }, [activeNodeId, nodes]);

  // Update nodes when activeNodeId changes
  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, isPlaying: n.id === activeNodeId }
    })));
  }, [activeNodeId, setNodes]);

  // Load project
  useEffect(() => {
    if (projectId) {
      getProject(projectId).then(async (p) => {
        setProject(p);
        if (!p) return;
        const assets = await getProjectAssets(projectId);
        setLibraryAssets(assets);
      });
    }
  }, [projectId]);

  // Continuous playback
  const handleTimeUpdate = () => {
    if (!videoRef.current || !activeNodeId) return;

    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    const activeNode = getActiveNodeData();
    if (!activeNode) return;

    if (t >= activeNode.data.endOffset - 0.05) {
      const nextNodeId = getNextNodeId(activeNodeId);
      if (nextNodeId) {
        const nextNode = nodes.find(n => n.id === nextNodeId) as ClipNode;
        if (nextNode) {
          setActiveNodeId(nextNodeId);
          if (videoRef.current) {
            videoRef.current.src = nextNode.data.url;
            videoRef.current.currentTime = nextNode.data.startOffset;
            videoRef.current.play();
          }
        } else {
          setIsPlaying(false);
          videoRef.current.pause();
        }
      } else {
        setIsPlaying(false);
        videoRef.current.pause();
      }
    }
  };

  // Attach time update listener
  useEffect(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.addEventListener('timeupdate', handleTimeUpdate);
      return () => vid.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [activeNodeId, nodes, edges]);

  const handlePlayPause = () => {
    if (!videoRef.current || !activeNodeId) return;

    const activeNode = getActiveNodeData();
    if (!activeNode) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Ensure we are in the right time range
      if (videoRef.current.currentTime < activeNode.data.startOffset || videoRef.current.currentTime > activeNode.data.endOffset) {
        videoRef.current.currentTime = activeNode.data.startOffset;
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSplit = () => {
    const currentNode = getActiveNodeData();
    if (!currentNode || !videoRef.current || !activeNodeId) return;

    const currentPlayTime = videoRef.current.currentTime;

    if (currentPlayTime <= currentNode.data.startOffset + 0.1 || currentPlayTime >= currentNode.data.endOffset - 0.1) {
      alert("Split point too close to start or end of current clip segment.");
      return;
    }

    const clipBId = crypto.randomUUID();
    const clipBNode: ClipNode = {
      id: clipBId,
      type: 'clip',
      position: { x: currentNode.position.x + 350, y: currentNode.position.y },
      data: {
        ...currentNode.data,
        startOffset: currentPlayTime,
        endOffset: currentNode.data.endOffset,
        isPlaying: false
      }
    };

    const clipANode: ClipNode = {
      ...currentNode,
      data: { ...currentNode.data, endOffset: currentPlayTime }
    };

    const newEdge: Edge = {
      id: `e-${currentNode.id}-${clipBId}`,
      source: currentNode.id,
      target: clipBId,
      animated: true,
      style: { stroke: '#eab308', strokeWidth: 2 },
    };

    const remappedEdges = edges
      .filter(e => e.source === currentNode.id && e.target !== currentNode.id)
      .map(e => ({
        ...e,
        id: `e-${clipBId}-${e.target}`,
        source: clipBId
      }));

    const keptEdges = edges.filter(e => e.source !== currentNode.id && e.target !== currentNode.id);

    setNodes(nds => nds.filter(n => n.id !== activeNodeId).concat(clipANode, clipBNode));
    setEdges([...keptEdges, newEdge, ...remappedEdges]);

    setIsPlaying(false);
    videoRef.current.pause();
    setActiveNodeId(clipBId);
    videoRef.current.currentTime = currentPlayTime;
  };

  const onDragStart = (e: React.DragEvent, asset: LibraryAsset) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;

    const asset = JSON.parse(raw) as LibraryAsset;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    let duration = asset.duration || 10;
    if (!asset.duration) {
      const tempVideo = document.createElement('video');
      tempVideo.src = `http://localhost:3001${asset.url}`;
      duration = await new Promise<number>(resolve => {
        tempVideo.onloadedmetadata = () => resolve(tempVideo.duration);
        tempVideo.onerror = () => resolve(10);
      });
    }

    const newNode: ClipNode = {
      id: crypto.randomUUID(),
      type: 'clip',
      position,
      data: {
        label: asset.name,
        url: `http://localhost:3001${asset.url}`,
        filmstrip: asset.filmstrip,
        thumbnailUrl: asset.thumbnailUrl, // Pass thumbnail
        sourceDuration: duration,
        startOffset: 0,
        endOffset: duration,
      }
    };

    setNodes(nds => nds.concat(newNode));
  }, [screenToFlowPosition, setNodes]);

  const onConnect = useCallback((params: Connection) => {
    // Enforce linear sequence:
    // 1. Remove any existing edge starting from the source handle
    // 2. Remove any existing edge ending at the target handle
    setEdges((eds) => {
      const filtered = eds.filter(e => e.source !== params.source && e.target !== params.target);
      return addEdge({ ...params, animated: true, style: { stroke: '#eab308', strokeWidth: 2 } }, filtered);
    });
  }, [setEdges]);

  const handlePlaySequence = useCallback(() => {
    if (nodes.length === 0) return;

    // Find the start node
    // If a node is selected, find the root of its chain
    // Otherwise, find the global root (or the first one found)
    let startNodeId = selectedNodeId || activeNodeId;

    if (!startNodeId) {
      // Find a node with no incoming edges
      const nodesWithIncoming = new Set(edges.map(e => e.target));
      const rootNode = nodes.find(n => !nodesWithIncoming.has(n.id));
      if (rootNode) {
        startNodeId = rootNode.id;
      } else {
        // Circular dependency or empty? Just pick the first one
        startNodeId = nodes[0]?.id;
      }
    } else {
      // Traverse backwards to find the root
      let currentId = startNodeId;
      while (true) {
        const incomingEdge = edges.find(e => e.target === currentId);
        if (incomingEdge) {
          currentId = incomingEdge.source;
        } else {
          break;
        }
      }
      startNodeId = currentId;
    }

    if (startNodeId) {
      const startNode = nodes.find(n => n.id === startNodeId) as ClipNode;
      if (startNode) {
        setActiveNodeId(startNodeId);
        if (videoRef.current) {
          videoRef.current.src = startNode.data.url;
          videoRef.current.currentTime = startNode.data.startOffset;
          videoRef.current.play();
          setIsPlaying(true);
        }
      }
    }
  }, [nodes, edges, selectedNodeId, activeNodeId]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setActiveNodeId(node.id);
    if (videoRef.current) {
      const clipData = node.data as ClipData;
      videoRef.current.src = clipData.url;
      videoRef.current.currentTime = clipData.startOffset;
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // --- NEW: Keydown Listener for Deletion ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedNodeId && !isPlaying) {
        event.preventDefault();

        // Use the string type explicitly to avoid any ambiguity when filtering
        const nodeIdToDelete: string = selectedNodeId;

        // 1. Remove node
        setNodes(nds => nds.filter(n => n.id !== nodeIdToDelete));

        // 2. Remove connected edges
        setEdges(eds => eds.filter(e => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete));

        // 3. Deselect
        setSelectedNodeId(null);

        // 4. Reset active playing node if it was the one deleted
        if (activeNodeId === nodeIdToDelete) { // Changed check to use nodeIdToDelete
          setActiveNodeId(null);
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, activeNodeId, isPlaying, setNodes, setEdges]);


  if (!projectId || !project) return <div className="flex items-center justify-center h-screen bg-[#050505] text-white">Loading Project...</div>;

  return (
    <>
      <div className="flex flex-col h-full w-full bg-[#050505] text-white overflow-hidden font-sans">

        {/* Top Bar (Controls) */}
        <TopBar
          activeNode={getActiveNodeData()}
          currentTime={currentTime}
          isPlaying={isPlaying}
          handleSplit={handleSplit}
          handlePlayPause={handlePlayPause}
          handlePlaySequence={handlePlaySequence}
          onOpenUploadModal={() => setIsUploadModalOpen(true)} // PASS NEW HANDLER
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Library */}
          <aside className="w-[280px] bg-[#0a0a0a] border-r border-white/5 flex flex-col z-20 shrink-0">
            <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-[#0a0a0a]">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Library</h2>
              <Button // MODIFIED: Button now opens the modal
                onClick={handleUploadClick}
                disabled={isUploading}
                className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors disabled:opacity-50 h-7"
              >
                {isUploading ? 'Uploading...' : '+ Upload'}
              </Button>
              {/* Removed hidden file input as modal handles it */}
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              {isUploading && (
                <div className="bg-[#151515] rounded-lg p-4 border border-white/5 animate-pulse">
                  <div className="h-20 bg-slate-800 rounded mb-2"></div>
                  <div className="h-3 w-2/3 bg-slate-800 rounded"></div>
                  <div className="text-[10px] text-yellow-500 mt-2 text-center">Processing Video...</div>
                </div>
              )}
              {libraryAssets.map(asset => (
                <div
                  key={asset.name}
                  draggable
                  onDragStart={(e) => onDragStart(e, asset)}
                  className="group relative bg-[#151515] rounded-lg overflow-hidden border border-white/5 hover:border-yellow-500/50 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-lg hover:shadow-black/50"
                >
                  <div className="aspect-video relative bg-black">
                    {asset.thumbnailUrl ? (
                      <img
                        src={`http://localhost:3001${asset.thumbnailUrl}`}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                        alt={asset.name}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700">
                        <span className="text-[10px]">No Preview</span>
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-mono text-white/80">
                      {asset.duration ? formatTime(asset.duration) : 'VIDEO'}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-start">
                      <div className="text-xs font-medium text-slate-200 group-hover:text-yellow-500 transition-colors line-clamp-1 max-w-[180px]">{asset.name}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveAsset(asset.name); }}
                        className="p-1 -mr-1 -mt-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100"
                        title={`Remove ${asset.name} from library`}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Center: Graph */}
          <div className="flex-1 relative h-full bg-[#050505]" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.1}
              className="bg-[#050505]"
            >
              <Background color="#1a1a1a" gap={24} size={1} />
              <Panel position="bottom-center" className="bg-[#1a1a1a] px-4 py-2 rounded-full border border-white/10 shadow-xl mb-4">
                <span className="text-xs text-slate-400 font-medium">Sequence Graph</span>
              </Panel>
            </ReactFlow>
          </div>

          {/* Right Panel: Player (Large) */}
          <div className="w-[500px] bg-[#000] border-l border-white/5 flex flex-col z-20 shadow-2xl relative">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
              onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
            />
            {!activeNodeId && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-6xl mb-4 opacity-20">🎞️</div>
                <p className="text-slate-600 font-medium">No clip selected</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NEW: Render the Modal */}
      <AddAssetModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        projectId={projectId}
        onAssetAdded={handleAssetAdded}
      />
    </>
  );
}