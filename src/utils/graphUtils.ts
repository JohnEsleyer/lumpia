import { type Node, type Edge } from '@xyflow/react';

/**
 * Traverses backwards from a specific node handle to find the linear sequence of clips.
 * Returns an array of node data in CHRONOLOGICAL order (Start -> End).
 */
export const getConnectedSequence = (
    nodes: Node[],
    edges: Edge[],
    startNodeId: string,
    startHandleId: string | null // e.g., 'video-in' for RenderNode, null for Clips
): any[] => {
    const sequence: any[] = [];
    const visited = new Set<string>();

    // 1. Helper to find the input edge for a specific node/handle combo
    const findInputEdge = (nodeId: string, handleId: string | null) => {
        return edges.find(edge => {
            const targetMatch = edge.target === nodeId;
            // If handleId is specified, match it. If not (ClipNode), accept any connection to target.
            const handleMatch = handleId ? edge.targetHandle === handleId : true;
            return targetMatch && handleMatch;
        });
    };

    // 2. Recursive Walker
    const walkBackwards = (currentNodeId: string, entryHandleId: string | null) => {
        if (visited.has(currentNodeId)) return; // Prevent infinite loops
        visited.add(currentNodeId);

        // Find the edge connecting TO this node
        const edge = findInputEdge(currentNodeId, entryHandleId);

        if (!edge) return; // End of the line (Start of sequence)

        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) return;

        // RECURSE FIRST (Go deeper/backwards before processing current)
        // For ClipNodes, we assume the input handle is generic (null) or 'target'
        // We strictly walk back from the source node's input.
        walkBackwards(sourceNode.id, null);

        // PROCESS CURRENT (After returning from recursion, we are moving forward in time)
        const nodeData = extractNodeData(sourceNode);
        if (nodeData) {
            sequence.push(nodeData);
        }
    };

    // Start the traversal
    walkBackwards(startNodeId, startHandleId);

    return sequence;
};

// Helper to sanitize data types
const extractNodeData = (node: Node) => {
    const getNumber = (val: any, def: number) => (typeof val === 'number' && !isNaN(val) ? val : def);

    if (node.type === 'clip') {
        const data = node.data as any;
        return {
            id: node.id,
            type: 'clip',
            url: data.url,
            // Ensure we use the trimmed duration, not just file duration
            start: getNumber(data.startOffset, 0),
            end: getNumber(data.endOffset, data.sourceDuration || 10),
            volume: getNumber(data.volume, 1.0),
            playbackRate: getNumber(data.playbackRate, 1.0),
            label: data.label,
            // Add these fields
            sourceDuration: data.sourceDuration,
            filmstrip: data.filmstrip
        };
    }

    if (node.type === 'audio') {
        const data = node.data as any;
        return {
            id: node.id,
            type: 'audio',
            url: data.url,
            start: getNumber(data.startOffset, 0),
            end: getNumber(data.endOffset, data.duration || 10),
            volume: getNumber(data.volume, 1.0),
            label: data.label
        };
    }

    if (node.type === 'image') {
        const data = node.data as any;
        return {
            id: node.id,
            type: 'image',
            url: data.url,
            duration: typeof data.duration === 'number' ? data.duration : 3,
            label: data.label
        };
    }

    return null;
};