/**
 * Spatial Data Adapter
 * 
 * Transforms existing relationship data into spatial coordinates.
 * Non-destructive: original data flows through, spatial properties are computed on top.
 * 
 * Spatial semantics:
 * - X/Y: Force-directed layout position
 * - Z (depth): Time dimension (earlier = further back)
 * - Size: Entity importance (connection count)
 * - Distance: Relationship strength (inverse)
 */

import type { Relationship, GraphNode, GraphLink } from '../types';

// -----------------------------------------------------------------------------
// View Mode Types
// -----------------------------------------------------------------------------

export type ViewMode = 'graph' | 'depth' | 'spatial';

export interface ViewModeConfig {
  id: ViewMode;
  label: string;
  description: string;
  requiresWebGL: boolean;
}

export const VIEW_MODES: ViewModeConfig[] = [
  {
    id: 'graph',
    label: '2D',
    description: 'Classic force-directed graph',
    requiresWebGL: false,
  },
  {
    id: 'depth',
    label: '2.5D',
    description: 'Time as depth',
    requiresWebGL: true,
  },
  {
    id: 'spatial',
    label: '3D',
    description: 'Full spatial exploration',
    requiresWebGL: true,
  },
];

// -----------------------------------------------------------------------------
// Spatial Node Types
// -----------------------------------------------------------------------------

export interface SpatialNode extends GraphNode {
  // Computed spatial coordinates
  x: number;
  y: number;
  z: number;
  
  // Derived metrics
  importance: number;        // 0-1 normalized importance
  hopDistance: number;       // Distance from principal (Epstein)
  earliestTimestamp: string | null;
  latestTimestamp: string | null;
  
  // Visual properties
  radius: number;
  opacity: number;
}

export interface SpatialLink extends GraphLink {
  // Spatial properties
  sourcePosition: [number, number, number];
  targetPosition: [number, number, number];
  
  // Derived metrics
  strength: number;          // 0-1 normalized strength
  isWeakLink: boolean;       // For dashed rendering
  temporalSpan: number;      // Years between earliest and latest
}

export interface SpatialGraphData {
  nodes: SpatialNode[];
  links: SpatialLink[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  timeRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}

// -----------------------------------------------------------------------------
// Time-to-Depth Mapping
// -----------------------------------------------------------------------------

const DEPTH_SCALE = 200; // Total depth range in world units
const TIME_RANGE_START = new Date('1970-01-01').getTime();
const TIME_RANGE_END = new Date('2025-12-31').getTime();

/**
 * Maps a timestamp string to a Z-depth value.
 * Earlier dates = larger negative Z (further back in space).
 * Undated items placed at Z = 0.
 */
export function timestampToDepth(timestamp: string | null): number {
  if (!timestamp) return 0;
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 0;
    
    const t = date.getTime();
    const normalized = (t - TIME_RANGE_START) / (TIME_RANGE_END - TIME_RANGE_START);
    
    // Clamp to [0, 1] and map to depth
    const clamped = Math.max(0, Math.min(1, normalized));
    return (clamped - 0.5) * DEPTH_SCALE; // Center around 0
  } catch {
    return 0;
  }
}

/**
 * Extracts year from timestamp for display.
 */
export function extractYear(timestamp: string | null): number | null {
  if (!timestamp) return null;
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date.getFullYear();
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Importance Calculation
// -----------------------------------------------------------------------------

/**
 * Calculates node importance based on connection count.
 * Uses logarithmic scaling to prevent extreme outliers.
 */
export function calculateImportance(
  connectionCount: number,
  maxConnections: number
): number {
  if (maxConnections <= 1) return 0.5;
  
  const logVal = Math.log(connectionCount + 1);
  const logMax = Math.log(maxConnections + 1);
  
  return logVal / logMax;
}

/**
 * Maps importance to visual radius.
 */
export function importanceToRadius(importance: number): number {
  const MIN_RADIUS = 0.5;
  const MAX_RADIUS = 4;
  
  return MIN_RADIUS + importance * (MAX_RADIUS - MIN_RADIUS);
}

// -----------------------------------------------------------------------------
// Link Strength Calculation
// -----------------------------------------------------------------------------

/**
 * Calculates link strength based on multiple occurrences.
 */
export function calculateLinkStrength(count: number, maxCount: number): number {
  if (maxCount <= 1) return 0.5;
  return Math.min(1, count / maxCount);
}

// -----------------------------------------------------------------------------
// Main Adapter Function
// -----------------------------------------------------------------------------

interface AdapterOptions {
  mode: ViewMode;
  centerNode?: string; // ID of node to center on (default: Jeffrey Epstein)
}

/**
 * Transforms 2D graph data into spatial coordinates.
 * This is the main entry point for the adapter.
 */
export function adaptToSpatialGraph(
  nodes: GraphNode[],
  links: GraphLink[],
  relationships: Relationship[],
  options: AdapterOptions
): SpatialGraphData {
  const { mode, centerNode = 'Jeffrey Epstein' } = options;
  
  // Build relationship lookup for timestamps
  const nodeTimestamps = new Map<string, string[]>();
  relationships.forEach(rel => {
    if (rel.timestamp) {
      if (!nodeTimestamps.has(rel.actor)) {
        nodeTimestamps.set(rel.actor, []);
      }
      if (!nodeTimestamps.has(rel.target)) {
        nodeTimestamps.set(rel.target, []);
      }
      nodeTimestamps.get(rel.actor)!.push(rel.timestamp);
      nodeTimestamps.get(rel.target)!.push(rel.timestamp);
    }
  });
  
  // Calculate max connections for normalization
  const maxConnections = Math.max(...nodes.map(n => n.val), 1);
  
  // Build link count map
  const linkCounts = new Map<string, number>();
  links.forEach(link => {
    const key = `${link.source}|||${link.target}`;
    linkCounts.set(key, (linkCounts.get(key) || 0) + 1);
  });
  const maxLinkCount = Math.max(...Array.from(linkCounts.values()), 1);
  
  // Calculate hop distances via BFS
  const hopDistances = calculateHopDistances(nodes, links, centerNode);
  
  // Transform nodes
  const spatialNodes: SpatialNode[] = nodes.map(node => {
    const timestamps = nodeTimestamps.get(node.id) || [];
    const sortedTimestamps = timestamps.sort();
    
    const importance = calculateImportance(node.val, maxConnections);
    const hopDistance = hopDistances.get(node.id) ?? Infinity;
    
    // Calculate Z based on mode and earliest timestamp
    let z = 0;
    if (mode !== 'graph') {
      const avgTimestamp = sortedTimestamps.length > 0
        ? sortedTimestamps[Math.floor(sortedTimestamps.length / 2)]
        : null;
      z = timestampToDepth(avgTimestamp);
    }
    
    return {
      ...node,
      x: (node as any).x ?? 0,
      y: (node as any).y ?? 0,
      z,
      importance,
      hopDistance,
      earliestTimestamp: sortedTimestamps[0] || null,
      latestTimestamp: sortedTimestamps[sortedTimestamps.length - 1] || null,
      radius: importanceToRadius(importance),
      opacity: hopDistance <= 3 ? 1 : Math.max(0.3, 1 - (hopDistance - 3) * 0.15),
    };
  });
  
  // Build node position lookup
  const nodePositions = new Map<string, SpatialNode>();
  spatialNodes.forEach(node => nodePositions.set(node.id, node));
  
  // Transform links
  const spatialLinks: SpatialLink[] = links.map(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source;
    const targetId = typeof link.target === 'string' ? link.target : link.target;
    
    const sourceNode = nodePositions.get(sourceId);
    const targetNode = nodePositions.get(targetId);
    
    const key = `${sourceId}|||${targetId}`;
    const count = linkCounts.get(key) || 1;
    const strength = calculateLinkStrength(count, maxLinkCount);
    
    return {
      ...link,
      sourcePosition: [
        sourceNode?.x ?? 0,
        sourceNode?.y ?? 0,
        sourceNode?.z ?? 0,
      ] as [number, number, number],
      targetPosition: [
        targetNode?.x ?? 0,
        targetNode?.y ?? 0,
        targetNode?.z ?? 0,
      ] as [number, number, number],
      strength,
      isWeakLink: strength < 0.3,
      temporalSpan: 0, // Computed elsewhere if needed
    };
  });
  
  // Calculate bounds
  const bounds = {
    minX: Math.min(...spatialNodes.map(n => n.x)),
    maxX: Math.max(...spatialNodes.map(n => n.x)),
    minY: Math.min(...spatialNodes.map(n => n.y)),
    maxY: Math.max(...spatialNodes.map(n => n.y)),
    minZ: Math.min(...spatialNodes.map(n => n.z)),
    maxZ: Math.max(...spatialNodes.map(n => n.z)),
  };
  
  // Calculate time range
  const allTimestamps = relationships
    .map(r => r.timestamp)
    .filter((t): t is string => t !== null)
    .map(t => new Date(t))
    .filter(d => !isNaN(d.getTime()));
  
  const timeRange = {
    earliest: allTimestamps.length > 0
      ? new Date(Math.min(...allTimestamps.map(d => d.getTime())))
      : null,
    latest: allTimestamps.length > 0
      ? new Date(Math.max(...allTimestamps.map(d => d.getTime())))
      : null,
  };
  
  return {
    nodes: spatialNodes,
    links: spatialLinks,
    bounds,
    timeRange,
  };
}

/**
 * BFS to calculate hop distances from center node.
 */
function calculateHopDistances(
  nodes: GraphNode[],
  links: GraphLink[],
  centerNode: string
): Map<string, number> {
  const distances = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();
  
  // Build adjacency list
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source;
    const targetId = typeof link.target === 'string' ? link.target : link.target;
    
    adjacency.get(sourceId)?.add(targetId);
    adjacency.get(targetId)?.add(sourceId);
  });
  
  // BFS from center
  const queue: string[] = [];
  if (adjacency.has(centerNode)) {
    distances.set(centerNode, 0);
    queue.push(centerNode);
  }
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(current)!;
    
    const neighbors = adjacency.get(current) || new Set();
    neighbors.forEach(neighbor => {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    });
  }
  
  return distances;
}

// -----------------------------------------------------------------------------
// WebGL Detection
// -----------------------------------------------------------------------------

let webGLSupported: boolean | null = null;

/**
 * Checks if WebGL is available for 3D rendering.
 */
export function isWebGLSupported(): boolean {
  if (webGLSupported !== null) return webGLSupported;
  
  try {
    const canvas = document.createElement('canvas');
    webGLSupported = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    webGLSupported = false;
  }
  
  return webGLSupported;
}

/**
 * Returns the best available view mode based on device capabilities.
 */
export function getDefaultViewMode(): ViewMode {
  // Mobile devices default to 2D
  const isMobile = window.innerWidth < 1024;
  if (isMobile) return 'graph';
  
  // Non-WebGL browsers default to 2D
  if (!isWebGLSupported()) return 'graph';
  
  return 'graph'; // Default to 2D, let user opt into 3D
}
