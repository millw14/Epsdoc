/**
 * GlobeView - Interactive wireframe globe showing locations and events
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Relationship, Stats } from '../types';
import { getLocationCoords, normalizeLocation } from '../lib/locations';
import RotatingEarth from './ui/wireframe-dotted-globe';
import { useAIChat } from '../lib/ai-explanations';
import { fetchDocumentText, fetchDocument } from '../api';
import { X, MapPin, Users, FileText, Clock, ChevronLeft, MessageCircle, Loader2, Globe, ChevronRight, HelpCircle, Send, Tag, Hash, Network, ArrowRight, BookOpen, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  relationships: Relationship[];
  stats: Stats | null;
}

interface LocationData {
  name: string;
  coords: [number, number] | null;
  events: Relationship[];
  people: Set<string>;
  isUnknown?: boolean;
}

export default function GlobeView({ relationships, stats }: Props) {
  const [selectedLocationName, setSelectedLocationName] = useState<string | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Relationship | null>(null);
  const [eventAI, setEventAI] = useState<string | null>(null);
  const [eventAILoading, setEventAILoading] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showBubbleMap, setShowBubbleMap] = useState(false);
  const [bubbleMapPerson, setBubbleMapPerson] = useState<string | null>(null);
  const [bubbleZoom, setBubbleZoom] = useState(1);
  const [bubblePan, setBubblePan] = useState({ x: 0, y: 0 });
  const [zoomToPerson, setZoomToPerson] = useState<string | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [documentMeta, setDocumentMeta] = useState<{ doc_id: string; category: string; summary?: string } | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentAI, setDocumentAI] = useState<string | null>(null);
  const [documentAILoading, setDocumentAILoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const bubbleCanvasRef = useRef<HTMLCanvasElement>(null);
  const bubbleNodesRef = useRef<Array<{ name: string; x: number; y: number; radius: number; connections: number }>>([]);
  const zoomAnimationRef = useRef<number | null>(null);

  // Smooth zoom animation helper
  const animateBubbleView = useCallback((
    targetZoom: number,
    targetPanX?: number,
    targetPanY?: number,
    duration = 400
  ) => {
    // Cancel any existing animation
    if (zoomAnimationRef.current) {
      cancelAnimationFrame(zoomAnimationRef.current);
    }
    
    const startZoom = bubbleZoom;
    const startPanX = bubblePan.x;
    const startPanY = bubblePan.y;
    const finalPanX = targetPanX ?? startPanX;
    const finalPanY = targetPanY ?? startPanY;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentZoom = startZoom + (targetZoom - startZoom) * easeOut;
      const currentPanX = startPanX + (finalPanX - startPanX) * easeOut;
      const currentPanY = startPanY + (finalPanY - startPanY) * easeOut;
      
      setBubbleZoom(currentZoom);
      setBubblePan({ x: currentPanX, y: currentPanY });
      
      if (progress < 1) {
        zoomAnimationRef.current = requestAnimationFrame(animate);
      } else {
        zoomAnimationRef.current = null;
      }
    };
    
    zoomAnimationRef.current = requestAnimationFrame(animate);
  }, [bubbleZoom, bubblePan]);
  
  const { messages, loading: chatLoading, ask: askChat, clear: clearChat } = useAIChat();

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group events by location (including unknown locations)
  const { locationData, unknownLocationData } = useMemo(() => {
    const locations = new Map<string, LocationData>();
    const unknownEvents: Relationship[] = [];
    const unknownPeople = new Set<string>();
    
    relationships.forEach(rel => {
      // Handle events without location or with unmappable location
      if (!rel.location) {
        unknownEvents.push(rel);
        unknownPeople.add(rel.actor);
        unknownPeople.add(rel.target);
        return;
      }
      
      const normalized = normalizeLocation(rel.location);
      const coords = getLocationCoords(rel.location);
      
      // If we can't map the location to coordinates, add to unknown
      if (!coords) {
        unknownEvents.push(rel);
        unknownPeople.add(rel.actor);
        unknownPeople.add(rel.target);
        return;
      }
      
      if (!locations.has(normalized)) {
        locations.set(normalized, {
          name: normalized,
          coords,
          events: [],
          people: new Set()
        });
      }
      
      const loc = locations.get(normalized)!;
      loc.events.push(rel);
      loc.people.add(rel.actor);
      loc.people.add(rel.target);
    });
    
    const sortedLocations = Array.from(locations.values()).sort((a, b) => b.events.length - a.events.length);
    
    const unknown: LocationData | null = unknownEvents.length > 0 ? {
      name: 'Unknown/Unspecified',
      coords: null,
      events: unknownEvents,
      people: unknownPeople,
      isUnknown: true
    } : null;
    
    return { locationData: sortedLocations, unknownLocationData: unknown };
  }, [relationships]);

  // Convert to globe marker format
  const globeMarkers = useMemo(() => {
    return locationData.map(loc => ({
      name: loc.name,
      coords: loc.coords,
      eventCount: loc.events.length,
      peopleCount: loc.people.size,
      color: loc.name === 'US Virgin Islands' ? '#dc2626' :
             loc.name === 'New York' ? '#7c3aed' :
             loc.name === 'Palm Beach' ? '#f59e0b' : '#dc2626'
    }));
  }, [locationData]);

  // Get selected location data
  const selectedLocation = useMemo(() => {
    if (!selectedLocationName) return null;
    if (selectedLocationName === 'Unknown/Unspecified') return unknownLocationData;
    return locationData.find(l => l.name === selectedLocationName) || null;
  }, [selectedLocationName, locationData, unknownLocationData]);

  const totalLocatedEvents = useMemo(() => 
    locationData.reduce((sum, loc) => sum + loc.events.length, 0)
  , [locationData]);

  const totalUnknownEvents = unknownLocationData?.events.length || 0;

  // Compute bubble map data for unknown events
  const bubbleMapData = useMemo(() => {
    if (!unknownLocationData) return { nodes: [], links: [] };
    
    const events = unknownLocationData.events;
    const peopleMap = new Map<string, { name: string; connections: number; events: Relationship[] }>();
    const links: { source: string; target: string; events: Relationship[] }[] = [];
    const linkMap = new Map<string, Relationship[]>();
    
    events.forEach(event => {
      // Track people
      if (!peopleMap.has(event.actor)) {
        peopleMap.set(event.actor, { name: event.actor, connections: 0, events: [] });
      }
      if (!peopleMap.has(event.target)) {
        peopleMap.set(event.target, { name: event.target, connections: 0, events: [] });
      }
      
      peopleMap.get(event.actor)!.events.push(event);
      peopleMap.get(event.target)!.events.push(event);
      peopleMap.get(event.actor)!.connections++;
      peopleMap.get(event.target)!.connections++;
      
      // Track links
      const linkKey = [event.actor, event.target].sort().join('|||');
      if (!linkMap.has(linkKey)) {
        linkMap.set(linkKey, []);
      }
      linkMap.get(linkKey)!.push(event);
    });
    
    linkMap.forEach((events, key) => {
      const [source, target] = key.split('|||');
      links.push({ source, target, events });
    });
    
    // Show ALL nodes, sorted by connections
    const nodes = Array.from(peopleMap.values())
      .sort((a, b) => b.connections - a.connections);
    
    return { nodes, links };
  }, [unknownLocationData]);

  // Get events for selected person in bubble map
  const selectedPersonEvents = useMemo(() => {
    if (!bubbleMapPerson || !unknownLocationData) return [];
    return unknownLocationData.events.filter(
      e => e.actor === bubbleMapPerson || e.target === bubbleMapPerson
    );
  }, [bubbleMapPerson, unknownLocationData]);

  // Initialize bubble map node positions (only once when data changes)
  useEffect(() => {
    if (bubbleMapData.nodes.length === 0) return;
    
    // Use a larger virtual canvas for layout
    const layoutWidth = 3000;
    const layoutHeight = 3000;
    const centerX = layoutWidth / 2;
    const centerY = layoutHeight / 2;
    
    // Position nodes in a spiral layout for better distribution
    const nodes = bubbleMapData.nodes.map((node, i) => {
      const angle = i * 0.5;
      const spiralRadius = 50 + i * 3;
      return {
        name: node.name,
        connections: node.connections,
        x: centerX + Math.cos(angle) * spiralRadius,
        y: centerY + Math.sin(angle) * spiralRadius,
        radius: Math.min(Math.sqrt(node.connections) * 6 + 8, 35)
      };
    });
    
    // Force simulation with more iterations for better layout
    for (let iter = 0; iter < 100; iter++) {
      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = nodes[i].radius + nodes[j].radius + 15;
          if (dist < minDist) {
            const force = (minDist - dist) / dist * 0.3;
            nodes[i].x -= dx * force;
            nodes[i].y -= dy * force;
            nodes[j].x += dx * force;
            nodes[j].y += dy * force;
          }
        }
      }
      
      // Gentle attraction to center
      nodes.forEach(node => {
        node.x += (centerX - node.x) * 0.005;
        node.y += (centerY - node.y) * 0.005;
      });
    }
    
    bubbleNodesRef.current = nodes;
  }, [bubbleMapData]);

  // Auto-zoom to person when zoomToPerson changes - with smooth animation
  useEffect(() => {
    if (!zoomToPerson || bubbleNodesRef.current.length === 0) return;
    
    const node = bubbleNodesRef.current.find(n => n.name === zoomToPerson);
    if (!node) {
      setZoomToPerson(null);
      return;
    }
    
    const canvas = bubbleCanvasRef.current;
    if (!canvas) {
      setZoomToPerson(null);
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const targetZoom = 2.8;
    const targetPanX = rect.width / 2 - node.x * targetZoom;
    const targetPanY = rect.height / 2 - node.y * targetZoom;
    
    animateBubbleView(targetZoom, targetPanX, targetPanY, 800);
    setZoomToPerson(null);
  }, [zoomToPerson, animateBubbleView]);

  // Render bubble map
  useEffect(() => {
    if (!showBubbleMap || !bubbleCanvasRef.current || bubbleNodesRef.current.length === 0) return;
    
    const canvas = bubbleCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const nodes = bubbleNodesRef.current;
    const nodeMap = new Map(nodes.map(n => [n.name, n]));
    
    // Apply transform
    ctx.save();
    ctx.translate(bubblePan.x, bubblePan.y);
    ctx.scale(bubbleZoom, bubbleZoom);
    
    // Draw links
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.15)';
    ctx.lineWidth = 1 / bubbleZoom;
    bubbleMapData.links.forEach(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (source && target) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
    });
    
    // Draw nodes
    nodes.forEach(node => {
      const isSelected = node.name === bubbleMapPerson;
      const isEpstein = node.name === 'Jeffrey Epstein';
      
      // Glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = isEpstein ? 'rgba(220, 38, 38, 0.3)' : 
                      isSelected ? 'rgba(220, 38, 38, 0.5)' : 'rgba(220, 38, 38, 0.1)';
      ctx.fill();
      
      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = isEpstein ? '#7f1d1d' : isSelected ? '#b91c1c' : '#450a0a';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ef4444' : isEpstein ? '#fca5a5' : '#991b1b';
      ctx.lineWidth = (isSelected ? 3 : 2) / bubbleZoom;
      ctx.stroke();
      
      // Label (scale font based on zoom)
      const fontSize = Math.max(8, Math.min(12, 10 / Math.sqrt(bubbleZoom)));
      ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const maxLen = Math.floor(15 * bubbleZoom);
      const name = node.name.length > maxLen ? node.name.slice(0, maxLen - 1) + '...' : node.name;
      ctx.fillText(name, node.x, node.y);
      
      // Connection count (show when zoomed in enough)
      if (bubbleZoom > 0.8) {
        ctx.font = `${8 / Math.sqrt(bubbleZoom)}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(`${node.connections}`, node.x, node.y + node.radius + 10);
      }
    });
    
    ctx.restore();
    
    // Draw zoom controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Zoom: ${Math.round(bubbleZoom * 100)}%`, 10, height - 10);
    
  }, [showBubbleMap, bubbleMapData, bubbleMapPerson, bubbleZoom, bubblePan]);

  // Bubble map mouse interactions
  useEffect(() => {
    if (!showBubbleMap || !bubbleCanvasRef.current) return;
    
    const canvas = bubbleCanvasRef.current;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Zoom centered on mouse position
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(5, bubbleZoom * zoomFactor));
      
      // Adjust pan to keep mouse position fixed
      const worldX = (mouseX - bubblePan.x) / bubbleZoom;
      const worldY = (mouseY - bubblePan.y) / bubbleZoom;
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;
      
      setBubbleZoom(newZoom);
      setBubblePan({ x: newPanX, y: newPanY });
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      
      setBubblePan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };
    
    const handleMouseUp = () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    };
    
    const handleClick = (e: MouseEvent) => {
      if (isDragging) return;
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Convert to world coordinates
      const worldX = (mouseX - bubblePan.x) / bubbleZoom;
      const worldY = (mouseY - bubblePan.y) / bubbleZoom;
      
      // Find clicked node
      for (const node of bubbleNodesRef.current) {
        const dx = worldX - node.x;
        const dy = worldY - node.y;
        if (dx * dx + dy * dy < node.radius * node.radius) {
          setBubbleMapPerson(node.name === bubbleMapPerson ? null : node.name);
          return;
        }
      }
    };
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('click', handleClick);
    canvas.style.cursor = 'grab';
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('click', handleClick);
    };
  }, [showBubbleMap, bubbleZoom, bubblePan, bubbleMapPerson]);

  // Handle location click from globe
  const handleLocationClick = useCallback((name: string) => {
    setSelectedLocationName(name);
    setSelectedEvent(null);
    setEventAI(null);
  }, []);

  // Open document modal and fetch content with AI summary
  const openDocumentModal = useCallback(async (event: Relationship) => {
    setShowDocumentModal(true);
    setDocumentText(null);
    setDocumentMeta(null);
    setDocumentAI(null);
    setDocumentLoading(true);
    setDocumentAILoading(true);

    try {
      // Fetch document text and metadata in parallel
      const [textResult, docMeta] = await Promise.all([
        fetchDocumentText(event.doc_id),
        fetchDocument(event.doc_id).catch(() => null)
      ]);

      setDocumentText(textResult.text);
      setDocumentMeta(docMeta ? {
        doc_id: docMeta.doc_id,
        category: docMeta.category,
        summary: docMeta.one_sentence_summary
      } : { doc_id: event.doc_id, category: 'Unknown' });
      setDocumentLoading(false);

      // Now ask AI Epstein to summarize based on document content
      const key = import.meta.env.VITE_GROQ_API_KEY;
      if (!key) {
        setDocumentAI("I have nothing to say without my lawyer present.");
        setDocumentAILoading(false);
        return;
      }

      // Truncate document text to fit in context
      const truncatedText = textResult.text.slice(0, 8000);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { 
              role: 'system', 
              content: `You are Jeffrey Epstein being interrogated about a specific document. You have READ this document and must base your answers ONLY on what's in it. Be evasive but let details from the document slip out. Speak in first person. Reference specific names, dates, and details FROM THE DOCUMENT. 3-4 sentences.`
            },
            { 
              role: 'user', 
              content: `Mr. Epstein, we have this document (${event.doc_id}) that mentions "${event.actor} ${event.action} ${event.target}". Here is the full document:\n\n---\n${truncatedText}\n---\n\nWhat can you tell us about this document and what it reveals about your activities?`
            }
          ],
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      const data = await response.json();
      setDocumentAI(data.choices?.[0]?.message?.content || "I don't recall that document.");
    } catch (error) {
      console.error('Error fetching document:', error);
      setDocumentText('Failed to load document content.');
      setDocumentAI("I'm invoking my Fifth Amendment rights.");
    } finally {
      setDocumentLoading(false);
      setDocumentAILoading(false);
    }
  }, []);

  // Handle chat submit
  const handleChatSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    
    askChat(chatInput, relationships);
    setChatInput('');
  }, [chatInput, chatLoading, askChat, relationships]);

  // Ask AI about event
  const askAboutEvent = useCallback(async (event: Relationship) => {
    setEventAILoading(true);
    setEventAI(null);
    
    const key = import.meta.env.VITE_GROQ_API_KEY;
    if (!key) {
      setEventAI("I have nothing to say about that.");
      setEventAILoading(false);
      return;
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { 
              role: 'system', 
              content: 'You are Jeffrey Epstein being interrogated about a specific event. Be evasive but let some details slip. Speak in first person. 2-3 sentences max. Reference the location and people involved.'
            },
            { 
              role: 'user', 
              content: `Mr. Epstein, explain what happened: "${event.actor} ${event.action} ${event.target}" on ${event.timestamp || 'an unknown date'} at ${event.location || 'an unknown location'}.`
            }
          ],
          temperature: 0.7,
          max_tokens: 120,
        }),
      });

      const data = await response.json();
      setEventAI(data.choices?.[0]?.message?.content || "No comment.");
    } catch {
      setEventAI("I decline to answer that question.");
    } finally {
      setEventAILoading(false);
    }
  }, []);

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-gray-900/80 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Webstein" className="w-8 h-8" />
            <h1 className="text-white font-semibold text-lg">Webstein</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-gray-500 text-sm hidden sm:block">
              {locationData.length} locations | {totalLocatedEvents.toLocaleString()} mapped events
              {totalUnknownEvents > 0 && ` | ${totalUnknownEvents.toLocaleString()} unmapped`}
            </div>
            <button
              onClick={() => setShowChatPanel(!showChatPanel)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showChatPanel 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Ask Epstein</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Globe Container */}
        <div className="flex-1 relative flex items-center justify-center p-2">
          <RotatingEarth
            width={isFullscreen ? 1200 : 900}
            height={isFullscreen ? 800 : 650}
            className="max-w-full max-h-full"
            locations={globeMarkers}
            selectedLocation={selectedLocationName}
            onLocationClick={handleLocationClick}
            onLocationHover={setHoveredLocation}
          />
          
          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-4 right-4 p-2 bg-gray-900/90 hover:bg-gray-800 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors z-10"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          
          {/* Legend */}
          <div className={`absolute bottom-4 left-4 bg-gray-900/95 rounded-lg p-4 text-sm backdrop-blur border border-gray-800 ${isFullscreen ? 'hidden' : ''}`}>
            <div className="text-gray-400 text-xs uppercase mb-3">Click locations to explore</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-600"></div>
                <span className="text-gray-300">US Virgin Islands</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-violet-600"></div>
                <span className="text-gray-300">New York</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                <span className="text-gray-300">Palm Beach</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-gray-300">Other locations</span>
              </div>
            </div>
            <div className="text-gray-600 text-xs mt-3 pt-3 border-t border-gray-800">
              Drag to rotate | Click a location to zoom | Scroll to zoom
            </div>
          </div>

          {/* Location List */}
          <div className={`absolute top-4 left-4 bg-gray-900/95 rounded-lg overflow-hidden w-64 backdrop-blur border border-gray-800 ${isFullscreen ? 'hidden' : ''}`}
            <div className="p-3 border-b border-gray-800">
              <div className="text-xs text-gray-500 uppercase">Locations</div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {locationData.slice(0, 15).map(loc => (
                <button
                  key={loc.name}
                  onClick={() => handleLocationClick(loc.name)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-800/80 transition-colors flex items-center justify-between group ${
                    selectedLocationName === loc.name ? 'bg-red-900/30 border-l-2 border-l-red-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      loc.name === 'US Virgin Islands' ? 'bg-red-500' :
                      loc.name === 'New York' ? 'bg-violet-500' :
                      loc.name === 'Palm Beach' ? 'bg-amber-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-gray-200 text-sm">{loc.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 text-xs">{loc.events.length}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-red-400" />
                  </div>
                </button>
              ))}
              
              {/* Unknown/Unmapped events */}
              {unknownLocationData && (
                <>
                  <div className="border-t border-gray-800 my-1"></div>
                  <button
                    onClick={() => handleLocationClick('Unknown/Unspecified')}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-800/80 transition-colors flex items-center justify-between group ${
                      selectedLocationName === 'Unknown/Unspecified' ? 'bg-amber-900/30 border-l-2 border-l-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-400 text-sm">Unknown/Unspecified</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-xs">{unknownLocationData.events.length}</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-amber-400" />
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredLocation && !selectedLocation && (
            <div className="absolute top-4 right-4 bg-gray-900/95 rounded-lg p-3 backdrop-blur border border-gray-800">
              <div className="text-white font-medium">{hoveredLocation}</div>
              <div className="text-gray-500 text-sm">Click to view events</div>
            </div>
          )}
        </div>

        {/* AI Chat Panel */}
        {showChatPanel && !isFullscreen && (
          <div className="w-80 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-red-400" />
                <h2 className="text-white font-semibold">Interrogate Epstein</h2>
              </div>
              <button 
                onClick={() => setShowChatPanel(false)}
                className="p-1 text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-4">
                    Ask questions about locations, people, or events
                  </p>
                  <div className="space-y-2 text-xs text-gray-600">
                    <p>"What happened in New York?"</p>
                    <p>"Tell me about your visits to Palm Beach"</p>
                    <p>"Who did you meet on the island?"</p>
                  </div>
                </div>
              )}
              
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`${
                    msg.role === 'user'
                      ? 'bg-red-900/30 border-red-800 ml-6'
                      : 'bg-red-950/30 border-red-900/50 mr-6'
                  } border rounded-lg p-3`}
                >
                  <div className={`text-xs mb-1 ${
                    msg.role === 'user' ? 'text-red-500' : 'text-red-300'
                  }`}>
                    {msg.role === 'user' ? 'Investigator' : 'Epstein'}
                  </div>
                  <p className={`text-sm ${
                    msg.role === 'user' ? 'text-white' : 'text-gray-300 italic'
                  }`}>
                    {msg.role === 'assistant' ? `"${msg.content}"` : msg.content}
                  </p>
                </div>
              ))}
              
              {chatLoading && (
                <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 mr-6">
                  <div className="text-xs text-red-400 mb-1">Epstein</div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm italic">thinking...</span>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat input */}
            <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-xs text-gray-500 hover:text-gray-400 mt-2"
                >
                  Clear conversation
                </button>
              )}
            </form>
          </div>
        )}

        {/* Detail Panel */}
        {selectedLocation && !isFullscreen && (
          <div className="w-96 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
            {selectedEvent ? (
              /* Event Detail - Full Information */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex-shrink-0">
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-3"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back to {selectedLocation.name}
                  </button>
                  
                  {/* Event Title */}
                  <div className="bg-gray-800 rounded-lg p-4 mb-4">
                    <div className="text-xs text-gray-500 uppercase mb-2">Event</div>
                    <div className="text-lg text-white">
                      <span className="text-red-400 font-medium">{selectedEvent.actor}</span>
                      <span className="text-gray-400 mx-2">{selectedEvent.action}</span>
                      <span className="text-red-400 font-medium">{selectedEvent.target}</span>
                    </div>
                  </div>
                </div>

                {/* Full Event Details */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Actor Info */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-xs text-gray-500 uppercase mb-2 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Actor
                    </div>
                    <div className="text-red-400 font-medium text-lg">{selectedEvent.actor}</div>
                    <button 
                      onClick={() => {
                        setBubbleMapPerson(selectedEvent.actor);
                        setZoomToPerson(selectedEvent.actor);
                        setShowBubbleMap(true);
                      }}
                      className="text-xs text-gray-500 hover:text-red-400 mt-1 flex items-center gap-1"
                    >
                      View connections <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Action */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-xs text-gray-500 uppercase mb-2">Action</div>
                    <div className="text-white">{selectedEvent.action}</div>
                  </div>
                  
                  {/* Target Info */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-xs text-gray-500 uppercase mb-2 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Target
                    </div>
                    <div className="text-red-400 font-medium text-lg">{selectedEvent.target}</div>
                    <button 
                      onClick={() => {
                        setBubbleMapPerson(selectedEvent.target);
                        setZoomToPerson(selectedEvent.target);
                        setShowBubbleMap(true);
                      }}
                      className="text-xs text-gray-500 hover:text-red-400 mt-1 flex items-center gap-1"
                    >
                      View connections <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Date & Location */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                      <div className="text-xs text-gray-500 uppercase mb-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Date
                      </div>
                      <div className="text-white">{selectedEvent.timestamp || 'Not specified'}</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                      <div className="text-xs text-gray-500 uppercase mb-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Location
                      </div>
                      <div className="text-white">{selectedEvent.location || 'Not specified'}</div>
                    </div>
                  </div>
                  
                  {/* Document Reference */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-xs text-gray-500 uppercase mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Document Reference
                    </div>
                    <div className="text-white font-mono text-sm">{selectedEvent.doc_id}</div>
                    <div className="text-gray-500 text-xs mt-1">Event ID: {selectedEvent.id}</div>
                    <button
                      onClick={() => openDocumentModal(selectedEvent)}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
                    >
                      <BookOpen className="w-4 h-4" />
                      View Document & AI Summary
                    </button>
                  </div>
                  
                  {/* Tags */}
                  {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                      <div className="text-xs text-gray-500 uppercase mb-2 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Tags
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedEvent.tags.map((tag, i) => (
                          <span 
                            key={i}
                            className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* AI Interrogation */}
                  <div className="bg-red-950/40 border border-red-900/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-xs text-red-400 mb-2">
                      <MessageCircle className="w-4 h-4" />
                      "What happened here?"
                    </div>
                    {eventAILoading ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                      </div>
                    ) : eventAI ? (
                      <p className="text-gray-300 italic">"{eventAI}"</p>
                    ) : (
                      <button
                        onClick={() => askAboutEvent(selectedEvent)}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        Ask Epstein about this event
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Location Detail */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {selectedLocation.isUnknown ? (
                        <HelpCircle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <MapPin className="w-5 h-5 text-red-400" />
                      )}
                      <h2 className="text-xl font-bold text-white">{selectedLocation.name}</h2>
                    </div>
                    <button 
                      onClick={() => setSelectedLocationName(null)}
                      className="p-1 text-gray-500 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {selectedLocation.isUnknown && (
                    <p className="text-gray-500 text-sm mb-2">
                      Events without a specific geographic location
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" /> {selectedLocation.events.length} events
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" /> {selectedLocation.people.size} people
                    </span>
                  </div>
                  
                  {/* Bubble Map Button for Unknown Location */}
                  {selectedLocation.isUnknown && (
                    <button
                      onClick={() => {
                        setShowBubbleMap(true);
                        setBubbleMapPerson(null);
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                      <Network className="w-4 h-4" />
                      View Network Map
                    </button>
                  )}
                </div>

                {/* People at this location */}
                <div className="p-4 border-b border-gray-800 flex-shrink-0">
                  <div className="text-xs text-gray-500 uppercase mb-2">Key people</div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {Array.from(selectedLocation.people).slice(0, 30).map(person => (
                      <span 
                        key={person}
                        className={`px-2 py-0.5 rounded text-xs ${
                          person === 'Jeffrey Epstein' 
                            ? 'bg-red-900/50 text-red-300' 
                            : 'bg-gray-800 text-gray-300'
                        }`}
                      >
                        {person}
                      </span>
                    ))}
                    {selectedLocation.people.size > 30 && (
                      <span className="px-2 py-0.5 text-xs text-gray-500">
                        +{selectedLocation.people.size - 30} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Events at this location */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="text-xs text-gray-500 uppercase mb-3">
                    Events ({selectedLocation.events.length})
                  </div>
                  <div className="space-y-2">
                    {selectedLocation.events.slice(0, 100).map((event, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedEvent(event); setEventAI(null); }}
                        className="w-full text-left p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors group"
                      >
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {event.timestamp || 'Unknown date'}
                          </span>
                          <ChevronRight className="w-4 h-4 group-hover:text-red-400" />
                        </div>
                        <div className="text-sm">
                          <span className="text-red-400">{event.actor}</span>
                          <span className="text-gray-500 mx-1">{event.action}</span>
                          <span className="text-red-400">{event.target}</span>
                        </div>
                      </button>
                    ))}
                    {selectedLocation.events.length > 100 && (
                      <div className="text-center text-gray-600 text-xs py-2">
                        +{selectedLocation.events.length - 100} more events
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bubble Map Modal */}
      {showBubbleMap && (
        <div className="fixed inset-0 z-50 bg-gray-950/95 flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-red-400" />
              <h2 className="text-white font-semibold">Network Map - Unspecified Locations</h2>
              <span className="text-gray-500 text-sm">
                {bubbleMapData.nodes.length} people | {bubbleMapData.links.length} connections
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1">
                <button
                  onClick={() => animateBubbleView(Math.max(0.1, bubbleZoom * 0.7), undefined, undefined, 250)}
                  className="px-2 py-1 text-gray-400 hover:text-white text-lg font-bold"
                >
                  −
                </button>
                <span className="text-gray-400 text-sm w-16 text-center">{Math.round(bubbleZoom * 100)}%</span>
                <button
                  onClick={() => animateBubbleView(Math.min(5, bubbleZoom * 1.4), undefined, undefined, 250)}
                  className="px-2 py-1 text-gray-400 hover:text-white text-lg font-bold"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => animateBubbleView(1, 0, 0, 500)}
                className="px-3 py-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-sm"
              >
                Reset View
              </button>
              <button
                onClick={() => {
                  if (zoomAnimationRef.current) {
                    cancelAnimationFrame(zoomAnimationRef.current);
                  }
                  setShowBubbleMap(false);
                  setBubbleMapPerson(null);
                  setBubbleZoom(1);
                  setBubblePan({ x: 0, y: 0 });
                }}
                className="p-2 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 flex min-h-0">
            {/* Canvas */}
            <div className="flex-1 relative">
              <canvas 
                ref={bubbleCanvasRef}
                className="w-full h-full"
              />
              <div className="absolute bottom-4 left-4 bg-gray-900/90 rounded-lg p-3 text-xs text-gray-400">
                <div>Scroll to zoom | Drag to pan | Click on a person to see events</div>
              </div>
            </div>
            
            {/* Selected Person Panel */}
            {bubbleMapPerson && (
              <div className="w-96 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">{bubbleMapPerson}</h3>
                    <button 
                      onClick={() => setBubbleMapPerson(null)}
                      className="p-1 text-gray-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-400">
                    {selectedPersonEvents.length} events without location data
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {selectedPersonEvents.slice(0, 50).map((event, i) => (
                      <div
                        key={i}
                        className="p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                      >
                        {/* Event Header */}
                        <div className="text-sm mb-2">
                          <span className={event.actor === bubbleMapPerson ? 'text-red-400 font-medium' : 'text-gray-300'}>
                            {event.actor}
                          </span>
                          <span className="text-gray-500 mx-1">{event.action}</span>
                          <span className={event.target === bubbleMapPerson ? 'text-red-400 font-medium' : 'text-gray-300'}>
                            {event.target}
                          </span>
                        </div>
                        
                        {/* Event Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1 text-gray-500">
                            <Clock className="w-3 h-3" />
                            {event.timestamp || 'Unknown date'}
                          </div>
                          <div className="flex items-center gap-1 text-gray-500">
                            <Hash className="w-3 h-3" />
                            {event.doc_id}
                          </div>
                        </div>
                        
                        {/* Tags */}
                        {event.tags && event.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {event.tags.slice(0, 5).map((tag, j) => (
                              <span key={j} className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                                {tag}
                              </span>
                            ))}
                            {event.tags.length > 5 && (
                              <span className="text-gray-600 text-xs">+{event.tags.length - 5}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {selectedPersonEvents.length > 50 && (
                      <div className="text-center text-gray-600 text-xs py-2">
                        +{selectedPersonEvents.length - 50} more events
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Modal */}
      {showDocumentModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-700 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-red-400" />
                <div>
                  <h2 className="text-white font-semibold">Document Analysis</h2>
                  {documentMeta && (
                    <div className="text-gray-500 text-sm">{documentMeta.doc_id} • {documentMeta.category}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDocumentModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Epstein Summary */}
            <div className="p-4 border-b border-gray-800 bg-red-950/30">
              <div className="flex items-center gap-2 text-xs text-red-400 mb-2">
                <MessageCircle className="w-4 h-4" />
                Epstein's Response (based on document)
              </div>
              {documentAILoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="italic">Reading document...</span>
                </div>
              ) : documentAI ? (
                <p className="text-gray-200 italic leading-relaxed">"{documentAI}"</p>
              ) : (
                <p className="text-gray-500 italic">No response available</p>
              )}
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs text-gray-500 uppercase mb-3 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Document Content
              </div>
              {documentLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto mb-2" />
                    <div className="text-gray-500 text-sm">Loading document...</div>
                  </div>
                </div>
              ) : documentText ? (
                <div className="bg-gray-950 rounded-lg p-4 border border-gray-800">
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                    {documentText}
                  </pre>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">
                  Document content unavailable
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setShowDocumentModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
