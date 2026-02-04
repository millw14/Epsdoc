/**
 * SpatialGraph - Immersive 3D Network Visualization
 * Full-screen video game style with HUD overlays
 */

import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { SpatialNode, SpatialLink } from '../lib/spatial-adapter';
import type { Relationship, Stats } from '../types';
import {
  X,
  User,
  FileText,
  Network,
  Clock,
  MapPin,
  ChevronRight,
  Sparkles,
  Loader2,
  Move,
  MousePointer2,
  Search,
} from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SpatialGraphProps {
  nodes: SpatialNode[];
  links: SpatialLink[];
  selectedNode: string | null;
  onNodeClick: (nodeId: string) => void;
  selectedNodeData: SpatialNode | null;
  actorRelationships: Relationship[];
  actorTotalBeforeFilter: number;
  aiExplanation: string | null;
  aiLoading: boolean;
  stats: Stats | null;
}

// -----------------------------------------------------------------------------
// Colors
// -----------------------------------------------------------------------------

const COLORS = {
  principal: new THREE.Color('#ff0040'),
  direct: new THREE.Color('#ff6b00'),
  close: new THREE.Color('#a855f7'),
  distant: new THREE.Color('#00ff88'),
  selected: new THREE.Color('#00ffff'),
  link: new THREE.Color('#1a3a4a'),
  linkHighlight: new THREE.Color('#00ffff'),
};

function getNodeColor(node: SpatialNode, isSelected: boolean): THREE.Color {
  if (isSelected) return COLORS.selected;
  if (node.id === 'Jeffrey Epstein') return COLORS.principal;
  if (node.hopDistance === 1) return COLORS.direct;
  if (node.hopDistance <= 3) return COLORS.close;
  return COLORS.distant;
}

// -----------------------------------------------------------------------------
// Force Simulation for Node Positions
// -----------------------------------------------------------------------------

function computeNodePositions(nodes: SpatialNode[], links: SpatialLink[]): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>();
  
  // Find Jeffrey Epstein and center him
  const epsteinNode = nodes.find(n => n.id === 'Jeffrey Epstein');
  
  // Build adjacency for layout
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(n => adjacency.set(n.id, new Set()));
  
  links.forEach(link => {
    const source = typeof link.source === 'string' ? link.source : link.source;
    const target = typeof link.target === 'string' ? link.target : link.target;
    adjacency.get(source)?.add(target);
    adjacency.get(target)?.add(source);
  });
  
  // Position nodes based on hop distance and angle
  const hopGroups = new Map<number, SpatialNode[]>();
  nodes.forEach(node => {
    const hop = node.hopDistance === Infinity ? 10 : node.hopDistance;
    if (!hopGroups.has(hop)) hopGroups.set(hop, []);
    hopGroups.get(hop)!.push(node);
  });
  
  // Center node
  if (epsteinNode) {
    positions.set(epsteinNode.id, [0, 0, 0]);
  }
  
  // Position nodes in rings based on hop distance
  hopGroups.forEach((groupNodes, hop) => {
    if (hop === 0) return; // Already positioned center
    
    const radius = hop * 80 + Math.random() * 20;
    const count = groupNodes.length;
    
    groupNodes.forEach((node, i) => {
      if (positions.has(node.id)) return;
      
      const angle = (i / count) * Math.PI * 2 + (hop * 0.5);
      const variance = (Math.random() - 0.5) * 30;
      const heightVariance = (Math.random() - 0.5) * 40;
      
      const x = Math.cos(angle) * (radius + variance);
      const z = Math.sin(angle) * (radius + variance);
      const y = heightVariance + (node.importance - 0.5) * 20;
      
      positions.set(node.id, [x, y, z]);
    });
  });
  
  return positions;
}

// -----------------------------------------------------------------------------
// Camera Controls
// -----------------------------------------------------------------------------

function CameraControls() {
  const { camera, gl } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, up: false, down: false });
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const isLocked = useRef(false);
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') moveState.current.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') moveState.current.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveState.current.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') moveState.current.right = true;
      if (e.code === 'Space') moveState.current.up = true;
      if (e.code === 'ShiftLeft') moveState.current.down = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') moveState.current.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') moveState.current.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveState.current.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') moveState.current.right = false;
      if (e.code === 'Space') moveState.current.up = false;
      if (e.code === 'ShiftLeft') moveState.current.down = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked.current) return;
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= e.movementX * 0.002;
      euler.current.x -= e.movementY * 0.002;
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };

    const onPointerLockChange = () => {
      isLocked.current = document.pointerLockElement === gl.domElement;
    };

    const onClick = (e: MouseEvent) => {
      // Only lock if clicking on the canvas, not on UI
      if (e.target === gl.domElement && !isLocked.current) {
        gl.domElement.requestPointerLock();
      }
    };

    camera.position.set(0, 100, 350);
    camera.lookAt(0, 0, 0);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    gl.domElement.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      gl.domElement.removeEventListener('click', onClick);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const speed = 200;
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    
    camera.getWorldDirection(direction);
    right.crossVectors(direction, camera.up).normalize();

    velocity.current.set(0, 0, 0);
    
    if (moveState.current.forward) velocity.current.addScaledVector(direction, speed * delta);
    if (moveState.current.backward) velocity.current.addScaledVector(direction, -speed * delta);
    if (moveState.current.left) velocity.current.addScaledVector(right, -speed * delta);
    if (moveState.current.right) velocity.current.addScaledVector(right, speed * delta);
    if (moveState.current.up) velocity.current.y += speed * delta;
    if (moveState.current.down) velocity.current.y -= speed * delta;

    camera.position.add(velocity.current);
  });

  return null;
}

// -----------------------------------------------------------------------------
// Node Mesh
// -----------------------------------------------------------------------------

interface NodeMeshProps {
  node: SpatialNode;
  position: [number, number, number];
  isSelected: boolean;
  isConnected: boolean;
  onClick: () => void;
  onHover: (node: SpatialNode | null) => void;
}

function NodeMesh({ node, position, isSelected, isConnected, onClick, onHover }: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  const color = useMemo(() => getNodeColor(node, isSelected), [node, isSelected]);
  const scale = useMemo(() => {
    let s = Math.max(1, node.radius * 2);
    if (isSelected) s *= 1.5;
    if (hovered) s *= 1.2;
    return s;
  }, [node.radius, isSelected, hovered]);

  useFrame((state) => {
    if (meshRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 + position[0] * 0.1) * 0.1;
      meshRef.current.scale.setScalar(scale * pulse);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(node); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); onHover(null); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 1 : hovered ? 0.6 : 0.3}
          metalness={0.4}
          roughness={0.3}
          transparent
          opacity={isSelected || isConnected || hovered ? 1 : 0.7}
        />
      </mesh>
      
      {/* Glow ring for selected */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[scale * 1.5, 0.15, 8, 32]} />
          <meshBasicMaterial color={COLORS.selected} transparent opacity={0.6} />
        </mesh>
      )}
      
      {/* Label */}
      {(node.importance > 0.15 || hovered || isSelected) && (
        <Html position={[0, scale + 2, 0]} center style={{ pointerEvents: 'none' }}>
          <div className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap ${
            isSelected ? 'bg-cyan-500 text-black font-bold' : 
            hovered ? 'bg-black/90 text-cyan-400 border border-cyan-500/50' : 
            'bg-black/70 text-gray-300'
          }`}>
            {node.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// -----------------------------------------------------------------------------
// Links
// -----------------------------------------------------------------------------

function Links({ links, selectedNode, nodePositions }: { 
  links: SpatialLink[]; 
  selectedNode: string | null; 
  nodePositions: Map<string, [number, number, number]>;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    links.forEach(link => {
      const source = typeof link.source === 'string' ? link.source : link.source;
      const target = typeof link.target === 'string' ? link.target : link.target;
      const s = nodePositions.get(source);
      const t = nodePositions.get(target);
      if (s && t) positions.push(...s, ...t);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [links, nodePositions]);

  const highlightGeometry = useMemo(() => {
    if (!selectedNode) return null;
    const positions: number[] = [];
    links.forEach(link => {
      const source = typeof link.source === 'string' ? link.source : link.source;
      const target = typeof link.target === 'string' ? link.target : link.target;
      if (source !== selectedNode && target !== selectedNode) return;
      const s = nodePositions.get(source);
      const t = nodePositions.get(target);
      if (s && t) positions.push(...s, ...t);
    });
    if (positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [links, selectedNode, nodePositions]);

  return (
    <>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={COLORS.link} transparent opacity={0.25} />
      </lineSegments>
      {highlightGeometry && (
        <lineSegments geometry={highlightGeometry}>
          <lineBasicMaterial color={COLORS.linkHighlight} transparent opacity={0.8} linewidth={2} />
        </lineSegments>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Grid
// -----------------------------------------------------------------------------

function Grid() {
  return (
    <group position={[0, -80, 0]}>
      <gridHelper args={[2000, 80, '#0a2535', '#061520']} />
    </group>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function SpatialGraph({
  nodes,
  links,
  selectedNode,
  onNodeClick,
  selectedNodeData,
  actorRelationships,
  actorTotalBeforeFilter,
  aiExplanation,
  aiLoading,
  stats,
}: SpatialGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<SpatialNode | null>(null);
  const [showInspector, setShowInspector] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  // Compute positions
  const nodePositions = useMemo(() => computeNodePositions(nodes, links), [nodes, links]);
  
  // Connected nodes
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const connected = new Set<string>();
    links.forEach(link => {
      const source = typeof link.source === 'string' ? link.source : link.source;
      const target = typeof link.target === 'string' ? link.target : link.target;
      if (source === selectedNode) connected.add(target);
      if (target === selectedNode) connected.add(source);
    });
    return connected;
  }, [selectedNode, links]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return nodes.filter(n => n.name.toLowerCase().includes(q)).slice(0, 10);
  }, [searchQuery, nodes]);

  // Close inspector when no selection
  useEffect(() => {
    if (selectedNode) setShowInspector(true);
  }, [selectedNode]);

  return (
    <div className="w-full h-full relative">
      {/* 3D Canvas */}
      <Canvas camera={{ fov: 70, near: 0.1, far: 5000 }} gl={{ antialias: true }}>
        <color attach="background" args={['#000008']} />
        <fog attach="fog" args={['#000510', 200, 1200]} />
        
        <ambientLight intensity={0.3} />
        <pointLight position={[200, 200, 200]} intensity={0.6} color="#00ffff" />
        <pointLight position={[-200, -100, 100]} intensity={0.4} color="#ff0080" />
        
        <Stars radius={400} depth={80} count={2000} factor={4} fade speed={0.3} />
        <CameraControls />
        <Grid />
        
        <Links links={links} selectedNode={selectedNode} nodePositions={nodePositions} />
        
        {nodes.map(node => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          return (
            <NodeMesh
              key={node.id}
              node={node}
              position={pos}
              isSelected={node.id === selectedNode}
              isConnected={connectedNodes.has(node.id)}
              onClick={() => onNodeClick(node.id)}
              onHover={setHoveredNode}
            />
          );
        })}
      </Canvas>

      {/* HUD - Top Left Stats */}
      <div className="absolute top-4 left-4 font-mono text-xs space-y-1 pointer-events-none">
        <div className="text-cyan-500 flex items-center gap-2">
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
          SYSTEM ONLINE
        </div>
        {stats && (
          <>
            <div className="text-gray-500">NODES: <span className="text-cyan-400">{nodes.length.toLocaleString()}</span></div>
            <div className="text-gray-500">LINKS: <span className="text-cyan-400">{links.length.toLocaleString()}</span></div>
            <div className="text-gray-500">DATABASE: <span className="text-cyan-400">{stats.totalDocuments.count.toLocaleString()}</span> docs</div>
          </>
        )}
      </div>

      {/* HUD - Controls */}
      <div className="absolute bottom-4 left-4 font-mono text-xs pointer-events-none">
        <div className="bg-black/80 border border-gray-800 rounded p-3 space-y-1.5">
          <div className="text-cyan-500 font-bold mb-2">CONTROLS</div>
          <div className="text-gray-400 flex items-center gap-2"><Move className="w-3 h-3" /> WASD - Move</div>
          <div className="text-gray-400 flex items-center gap-2"><MousePointer2 className="w-3 h-3" /> Click - Look</div>
          <div className="text-gray-400"><span className="text-gray-600">[SPACE]</span> Up <span className="text-gray-600">[SHIFT]</span> Down</div>
          <div className="text-gray-600 text-[10px] mt-1">ESC to release cursor</div>
        </div>
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-4 h-4 border border-cyan-500/40 rounded-full flex items-center justify-center">
          <div className="w-1 h-1 bg-cyan-500/60 rounded-full"></div>
        </div>
      </div>

      {/* Search Button */}
      <button
        onClick={() => setShowSearch(!showSearch)}
        className="absolute top-4 right-4 p-2 bg-black/80 border border-gray-700 rounded hover:border-cyan-500 transition-colors"
      >
        <Search className="w-5 h-5 text-cyan-400" />
      </button>

      {/* Search Panel */}
      {showSearch && (
        <div className="absolute top-16 right-4 w-72 bg-black/95 border border-gray-800 rounded-lg overflow-hidden">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities..."
            className="w-full px-4 py-3 bg-transparent text-cyan-400 font-mono text-sm placeholder-gray-600 outline-none border-b border-gray-800"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              {searchResults.map(node => (
                <button
                  key={node.id}
                  onClick={() => { onNodeClick(node.id); setShowSearch(false); setSearchQuery(''); }}
                  className="w-full px-4 py-2 text-left hover:bg-cyan-500/10 transition-colors"
                >
                  <div className="font-mono text-sm text-gray-200">{node.name}</div>
                  <div className="font-mono text-xs text-gray-500">{node.val} connections</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hover Info */}
      {hoveredNode && !selectedNode && (
        <div className="absolute top-16 left-4 bg-black/90 border border-cyan-500/30 rounded p-3 font-mono max-w-xs">
          <div className="text-cyan-400 font-bold truncate">{hoveredNode.name}</div>
          <div className="text-gray-500 text-xs mt-1">Connections: <span className="text-white">{hoveredNode.val}</span></div>
          <div className="text-gray-500 text-xs">Distance: <span className="text-white">{hoveredNode.hopDistance} hops</span></div>
          <div className="text-gray-600 text-[10px] mt-2">Click to inspect</div>
        </div>
      )}

      {/* Inspector Panel */}
      {selectedNode && selectedNodeData && showInspector && (
        <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-2rem)] bg-black/95 border border-cyan-900/50 rounded-lg overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-cyan-900/30 bg-gradient-to-r from-cyan-950/30 to-transparent flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/20 rounded border border-cyan-500/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-cyan-600 font-mono">TARGET</div>
                  <div className="font-mono font-bold text-cyan-400 truncate">{selectedNodeData.name}</div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    {selectedNodeData.hopDistance === 0 ? 'PRINCIPAL' : `${selectedNodeData.hopDistance} HOPS`}
                  </div>
                </div>
              </div>
              <button onClick={() => { onNodeClick(selectedNode); setShowInspector(false); }} className="p-1 hover:bg-cyan-500/10 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex gap-4 mt-3 text-xs font-mono">
              <div className="flex items-center gap-1"><Network className="w-3 h-3 text-cyan-500" /> <span className="text-gray-500">LINKS:</span> <span className="text-cyan-400">{connectedNodes.size}</span></div>
              <div className="flex items-center gap-1"><FileText className="w-3 h-3 text-cyan-500" /> <span className="text-gray-500">REFS:</span> <span className="text-cyan-400">{actorRelationships.length}</span></div>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="p-3 border-b border-cyan-900/30 bg-purple-950/20 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] font-mono text-purple-400">AI ANALYSIS</span>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                <Loader2 className="w-3 h-3 animate-spin" /> Processing...
              </div>
            ) : aiExplanation ? (
              <p className="text-xs text-gray-400 font-mono leading-relaxed">{aiExplanation}</p>
            ) : (
              <p className="text-xs text-gray-600 font-mono">Awaiting data...</p>
            )}
          </div>

          {/* Connections List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {actorRelationships.slice(0, 20).map((rel, i) => (
                <div key={i} className="p-2 hover:bg-cyan-500/5 rounded transition-colors">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mb-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {rel.timestamp || 'Undated'}
                    </span>
                    {rel.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {rel.location}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono">
                    <span className={rel.actor === selectedNode ? 'text-cyan-400' : 'text-gray-300'}>{rel.actor}</span>
                    <span className="text-gray-600 mx-1">{rel.action}</span>
                    <span className={rel.target === selectedNode ? 'text-cyan-400' : 'text-gray-300'}>{rel.target}</span>
                  </div>
                </div>
              ))}
              {actorRelationships.length > 20 && (
                <div className="text-center text-xs text-gray-600 font-mono py-2">
                  +{actorRelationships.length - 20} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
