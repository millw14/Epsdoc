/**
 * NetworkView - Simple interactive graph showing all connections
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { Relationship, Stats } from '../types';
import { Search, X, MessageCircle, Loader2, Clock, MapPin, Users, FileText, ChevronLeft } from 'lucide-react';

interface Props {
  relationships: Relationship[];
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  actorRelationships: Relationship[];
  aiExplanation: string | null;
  aiLoading: boolean;
  stats: Stats | null;
}

interface Node {
  id: string;
  connections: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
}

export default function NetworkView({
  relationships, selectedNode, onNodeClick, actorRelationships, aiExplanation, aiLoading, stats
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Relationship | null>(null);
  const [eventAI, setEventAI] = useState<string | null>(null);
  const [eventAILoading, setEventAILoading] = useState(false);

  // Build graph data - show top 200 most connected
  const graphData = useMemo(() => {
    const connectionCount = new Map<string, number>();
    relationships.forEach(rel => {
      connectionCount.set(rel.actor, (connectionCount.get(rel.actor) || 0) + 1);
      connectionCount.set(rel.target, (connectionCount.get(rel.target) || 0) + 1);
    });

    // Get top 200 entities
    const topEntities = Array.from(connectionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(([name, count]) => ({ id: name, connections: count }));
    
    const topSet = new Set(topEntities.map(e => e.id));

    // Get links between top entities
    const linkMap = new Map<string, boolean>();
    const links: Link[] = [];
    relationships.forEach(rel => {
      if (topSet.has(rel.actor) && topSet.has(rel.target) && rel.actor !== rel.target) {
        const key = [rel.actor, rel.target].sort().join('|');
        if (!linkMap.has(key)) {
          linkMap.set(key, true);
          links.push({ source: rel.actor, target: rel.target });
        }
      }
    });

    return { nodes: topEntities, links };
  }, [relationships]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return graphData.nodes.filter(n => n.id.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, graphData.nodes]);

  // Connected to selected
  const connectedToSelected = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const connected = new Set<string>();
    graphData.links.forEach(link => {
      const s = typeof link.source === 'string' ? link.source : link.source.id;
      const t = typeof link.target === 'string' ? link.target : link.target.id;
      if (s === selectedNode) connected.add(t);
      if (t === selectedNode) connected.add(s);
    });
    return connected;
  }, [selectedNode, graphData.links]);

  // D3 Graph
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    svg.attr('viewBox', [0, 0, width, height]);
    svg.selectAll('*').remove();

    const nodes: Node[] = graphData.nodes.map(n => ({ ...n }));
    const links: Link[] = graphData.links.map(l => ({ ...l }));

    // Fix Epstein to center
    const epstein = nodes.find(n => n.id === 'Jeffrey Epstein');
    if (epstein) {
      epstein.fx = width / 2;
      epstein.fy = height / 2;
    }

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(60).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    const g = svg.append('g');

    // Zoom
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', e => g.attr('transform', e.transform)));

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.3);

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => Math.min(Math.sqrt(d.connections) + 4, 25))
      .attr('fill', d => {
        if (d.id === 'Jeffrey Epstein') return '#dc2626';
        if (d.connections > 100) return '#7c3aed';
        if (d.connections > 50) return '#2563eb';
        if (d.connections > 20) return '#0891b2';
        return '#475569';
      })
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, Node>()
        .on('start', (e, d) => {
          if (!e.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => {
          if (!e.active) simulation.alphaTarget(0);
          if (d.id !== 'Jeffrey Epstein') { d.fx = null; d.fy = null; }
        }))
      .on('click', (_, d) => { onNodeClick(d.id); setSelectedEvent(null); });

    // Labels for important nodes
    const label = g.append('g')
      .selectAll('text')
      .data(nodes.filter(n => n.connections > 30 || n.id === 'Jeffrey Epstein'))
      .join('text')
      .text(d => d.id.length > 15 ? d.id.slice(0, 13) + '...' : d.id)
      .attr('font-size', 9)
      .attr('fill', '#94a3b8')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'fixed bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none z-50 hidden');

    node.on('mouseenter', (e, d) => {
      tooltip.classed('hidden', false)
        .style('left', e.pageX + 10 + 'px')
        .style('top', e.pageY - 10 + 'px')
        .html(`<strong>${d.id}</strong><br/>${d.connections} connections`);
    }).on('mouseleave', () => tooltip.classed('hidden', true));

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!);
      node.attr('cx', d => d.x!).attr('cy', d => d.y!);
      label.attr('x', d => d.x!).attr('y', d => d.y! + Math.min(Math.sqrt(d.connections) + 4, 25) + 12);
    });

    // Update on selection
    const updateSelection = () => {
      node
        .attr('stroke', d => d.id === selectedNode ? '#22d3ee' : '#0f172a')
        .attr('stroke-width', d => d.id === selectedNode ? 3 : 1.5)
        .attr('opacity', d => {
          if (!selectedNode) return 1;
          if (d.id === selectedNode || connectedToSelected.has(d.id)) return 1;
          return 0.15;
        });
      link.attr('opacity', d => {
        if (!selectedNode) return 0.3;
        const s = (d.source as Node).id;
        const t = (d.target as Node).id;
        return (s === selectedNode || t === selectedNode) ? 0.8 : 0.05;
      }).attr('stroke', d => {
        const s = (d.source as Node).id;
        const t = (d.target as Node).id;
        return (s === selectedNode || t === selectedNode) ? '#22d3ee' : '#334155';
      });
    };
    updateSelection();

    return () => { simulation.stop(); tooltip.remove(); };
  }, [graphData, selectedNode, connectedToSelected, onNodeClick]);

  // Event AI
  const askAboutEvent = async (event: Relationship) => {
    setEventAILoading(true);
    setEventAI(null);
    const key = import.meta.env.VITE_GROQ_API_KEY;
    if (!key) { setEventAI("No comment."); setEventAILoading(false); return; }
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are Epstein being interrogated. Be evasive but revealing. 2 sentences max.' },
            { role: 'user', content: `Explain: ${event.timestamp || 'Unknown date'} - ${event.actor} ${event.action} ${event.target}${event.location ? ' at ' + event.location : ''}` }
          ],
          temperature: 0.7, max_tokens: 100,
        }),
      });
      const data = await res.json();
      setEventAI(data.choices?.[0]?.message?.content || "No comment.");
    } catch { setEventAI("I decline to answer."); }
    setEventAILoading(false);
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-gray-900/80 backdrop-blur border-b border-gray-800 px-4 py-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-semibold">Epstein Network</h1>
          <span className="text-gray-500 text-sm hidden sm:inline">
            {graphData.nodes.length} entities | {graphData.links.length} connections
          </span>
        </div>
        <button onClick={() => setShowSearch(true)} className="p-2 text-gray-400 hover:text-white">
          <Search className="w-5 h-5" />
        </button>
      </header>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-gray-900/90 rounded p-2 text-xs text-gray-400 space-y-1">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-600"></div> Epstein</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-violet-600"></div> 100+ links</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div> 50+ links</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-600"></div> 20+ links</div>
        </div>

        {/* Search Modal */}
        {showSearch && (
          <div className="absolute inset-0 bg-black/60 flex items-start justify-center pt-20 z-20" onClick={() => setShowSearch(false)}>
            <div className="bg-gray-900 rounded-lg w-80 shadow-xl" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 outline-none border-b border-gray-800"
                autoFocus
              />
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => { onNodeClick(r.id); setShowSearch(false); setSearchQuery(''); }}
                  className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 text-sm"
                >
                  {r.id} <span className="text-gray-500">({r.connections})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detail Panel */}
        {selectedNode && (
          <div className="absolute top-0 right-0 w-96 max-w-full h-full bg-gray-900/95 backdrop-blur border-l border-gray-800 flex flex-col z-10">
            {selectedEvent ? (
              /* Event Detail */
              <div className="flex-1 overflow-y-auto p-4">
                <button onClick={() => setSelectedEvent(null)} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <div className="bg-gray-800 rounded p-3 mb-4">
                  <div className="text-white mb-2">
                    <span className="text-cyan-400">{selectedEvent.actor}</span>
                    <span className="text-gray-500 mx-1">{selectedEvent.action}</span>
                    <span className="text-cyan-400">{selectedEvent.target}</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    {selectedEvent.timestamp && <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedEvent.timestamp}</div>}
                    {selectedEvent.location && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedEvent.location}</div>}
                  </div>
                </div>
                <div className="bg-red-950/40 border border-red-900/50 rounded p-3">
                  <div className="text-xs text-red-400 mb-2 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Epstein's Response</div>
                  {eventAILoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  ) : eventAI ? (
                    <p className="text-gray-300 text-sm italic">"{eventAI}"</p>
                  ) : (
                    <button onClick={() => askAboutEvent(selectedEvent)} className="text-blue-400 text-sm">Ask about this</button>
                  )}
                </div>
              </div>
            ) : (
              /* Person Detail */
              <>
                <div className="p-4 border-b border-gray-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedNode}</h2>
                      <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1"><Users className="w-4 h-4" />{connectedToSelected.size}</span>
                        <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{actorRelationships.length}</span>
                      </div>
                    </div>
                    <button onClick={() => onNodeClick(selectedNode)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  {aiExplanation && (
                    <div className="mt-3 bg-gray-800/50 rounded p-2">
                      <div className="text-xs text-red-400 mb-1">Epstein says:</div>
                      <p className="text-gray-300 text-sm italic">"{aiExplanation}"</p>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="text-xs text-gray-500 uppercase mb-2">Events ({actorRelationships.length})</div>
                  <div className="space-y-1">
                    {actorRelationships.slice(0, 100).map((rel, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedEvent(rel); setEventAI(null); }}
                        className="w-full text-left p-2 bg-gray-800/30 hover:bg-gray-800 rounded text-sm transition-colors"
                      >
                        <div className="text-xs text-gray-500 mb-0.5">{rel.timestamp || 'Unknown date'}</div>
                        <div>
                          <span className={rel.actor === selectedNode ? 'text-cyan-400' : 'text-white'}>{rel.actor}</span>
                          <span className="text-gray-500 mx-1">{rel.action}</span>
                          <span className={rel.target === selectedNode ? 'text-cyan-400' : 'text-white'}>{rel.target}</span>
                        </div>
                      </button>
                    ))}
                    {actorRelationships.length > 100 && (
                      <div className="text-center text-gray-600 text-xs py-2">+{actorRelationships.length - 100} more</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
