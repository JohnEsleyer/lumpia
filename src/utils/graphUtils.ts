import { type Node, type Edge } from '@xyflow/react';

/**
 * Recursively traverses the graph backwards to build a timeline sequence.
 * 
 * @param nodes All nodes in graph
 * @param edges All edges in graph
 * @param targetNodeId The node we are tracing back from
 * @param targetHandleId The specific handle (e.g. 'video-in'), or null for default
 * @param nodeTypeFilter Optional: Only include nodes of this type (e.g. 'clip')
 * @param visited Internal use to prevent infinite loops
 */
export const getSequenceFromHandle = (
    nodes: Node[],
    edges: Edge[],
    targetNodeId: string,
    targetHandleId: string | null,
    nodeTypeFilter?: string,
    visited = new Set<string>()
): any[] => {
    // 1. Infinite Loop Protection
    if (visited.has(targetNodeId)) return [];
    visited.add(targetNodeId);

    // 2. Find the incoming edge
    const edge = edges.find(e =>
        e.target === targetNodeId &&
        (targetHandleId ? e.targetHandle === targetHandleId : true)
    );

    if (!edge) return [];

    // 3. Find the Source Node
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return [];

    // 4. Extract Data (if matches filter)
    let currentItem: any = null;

    // Check filter if provided
    const typeMatch = !nodeTypeFilter || sourceNode.type === nodeTypeFilter;

    if (typeMatch) {
        if (sourceNode.type === 'clip') {
            const data = sourceNode.data as any;
            currentItem = {
                id: sourceNode.id,
                type: 'clip',
                url: data.url,
                start: data.startOffset || 0,
                end: data.endOffset || data.duration || 0,
                sourceDuration: (data.endOffset || 0) - (data.startOffset || 0),
                volume: data.volume ?? 1.0,
                playbackRate: data.playbackRate ?? 1.0,
                label: data.label,
                subtitles: data.subtitles
            };
        } else if (sourceNode.type === 'audio') {
            const data = sourceNode.data as any;
            currentItem = {
                id: sourceNode.id,
                type: 'audio',
                url: data.url,
                start: data.startOffset || 0,
                end: data.endOffset || data.duration || 0,
                label: data.label,
                volume: data.volume ?? 1.0,
                playbackRate: 1.0
            };
        }
    }

    // 5. RECURSIVE STEP
    // Pass the same filter up the chain
    // ClipNodes accept input on default handle (null)
    const parentSequence = getSequenceFromHandle(nodes, edges, sourceNode.id, null, nodeTypeFilter, visited);

    // 6. Return Combined
    if (currentItem) {
        return [...parentSequence, currentItem];
    }

    // If node was skipped (didn't match filter), just return parents
    return parentSequence;
};