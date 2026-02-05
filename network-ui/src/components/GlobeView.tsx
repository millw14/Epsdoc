/**
 * GlobeView - Interactive wireframe globe showing locations and events
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Relationship, Stats } from '../types';
import { getLocationCoords, normalizeLocation } from '../lib/locations';
import GlobeGL from './ui/GlobeGL';
import { useAIChat } from '../lib/ai-explanations';
import { fetchDocumentText, fetchDocument } from '../api';
import { X, MapPin, Users, FileText, Clock, ChevronLeft, MessageCircle, Loader2, Globe, ChevronRight, HelpCircle, Send, Tag, Hash, Network, ArrowRight, BookOpen, ExternalLink, Maximize2, Minimize2, Menu } from 'lucide-react';

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
  const [showMenu, setShowMenu] = useState(true);
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

  // Convert to globe marker format for Globe.GL
  const globeMarkers = useMemo(() => {
    return locationData.map(loc => ({
      name: loc.name,
      lat: loc.coords[0],
      lng: loc.coords[1],
      eventCount: loc.events.length,
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

  // Pre-load document content when event is selected (background fetch)
  const preloadDocument = useCallback(async (event: Relationship) => {
    // Reset state for new document
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

  // Select event and preload document
  const selectEvent = useCallback((event: Relationship) => {
    setSelectedEvent(event);
    setEventAI(null);
    // Start preloading document in background
    preloadDocument(event);
  }, [preloadDocument]);

  // Open document modal (content already preloaded)
  const openDocumentModal = useCallback(() => {
    setShowDocumentModal(true);
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
    <div className="h-screen bg-ink-950 relative overflow-hidden font-mono">
      {/* Fullscreen Globe */}
      <div className="absolute inset-0">
        <GlobeGL
          width={window.innerWidth}
          height={window.innerHeight}
          className="w-full h-full"
          locations={globeMarkers}
          selectedLocation={selectedLocationName}
          onLocationClick={handleLocationClick}
          onLocationHover={setHoveredLocation}
        />
      </div>

      {/* Top Bar - Clean minimal header */}
      <header className="absolute top-0 left-0 right-0 z-20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Menu Toggle */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 bg-ink-900/95 hover:bg-ink-800 text-ink-400 hover:text-white transition-all duration-200 border-b border-ink-700"
            >
              {showMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 bg-ink-900/95 px-4 py-2 border-b border-accent-red">
              <img src="/favicon.png" alt="Webstein" className="w-5 h-5" />
              <h1 className="text-white text-sm font-medium tracking-wider uppercase">Webstein</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-ink-400 text-xs bg-ink-900/95 px-4 py-2 border-b border-ink-700 hidden md:block tracking-wide">
              <span className="text-ink-500">//</span> {locationData.length} locations <span className="text-ink-600">|</span> {totalLocatedEvents.toLocaleString()} events
            </div>
            <button
              onClick={() => setShowChatPanel(!showChatPanel)}
              className={`flex items-center gap-2 px-4 py-2 text-xs tracking-wide transition-all duration-200 ${
                showChatPanel 
                  ? 'bg-accent-red text-white border-b-2 border-white' 
                  : 'bg-ink-900/95 text-ink-400 hover:text-white border-b border-ink-700 hover:border-accent-red'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline uppercase">Interrogate</span>
            </button>
          </div>
        </div>
      </header>

      {/* Left Sidebar - Clean document list */}
      <div className={`absolute left-0 top-14 bottom-0 z-10 transition-transform duration-300 ${showMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full w-64 bg-ink-900/98 backdrop-blur-sm border-r border-ink-800 flex flex-col">
          {/* Locations List Header */}
          <div className="px-4 py-3 border-b border-ink-800">
            <div className="text-[10px] text-ink-500 uppercase tracking-widest font-medium">// Index</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {locationData.map((loc, index) => (
              <button
                key={loc.name}
                onClick={() => handleLocationClick(loc.name)}
                className={`w-full text-left px-4 py-2.5 transition-all duration-200 flex items-center justify-between group border-l-2 ${
                  selectedLocationName === loc.name 
                    ? 'bg-ink-800/50 border-l-accent-red text-white' 
                    : 'border-l-transparent hover:border-l-ink-600 hover:bg-ink-800/30 text-ink-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-ink-600 font-mono w-4">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-xs tracking-wide truncate">{loc.name}</span>
                </div>
                <span className="text-[10px] text-ink-500 font-mono">{loc.events.length}</span>
              </button>
            ))}
            
            {/* Unknown/Unmapped events */}
            {unknownLocationData && (
              <>
                <div className="border-t border-ink-800/50 my-1 mx-4"></div>
                <button
                  onClick={() => handleLocationClick('Unknown/Unspecified')}
                  className={`w-full text-left px-4 py-2.5 transition-all duration-200 flex items-center justify-between group border-l-2 ${
                    selectedLocationName === 'Unknown/Unspecified' 
                      ? 'bg-ink-800/50 border-l-amber-600 text-white' 
                      : 'border-l-transparent hover:border-l-ink-600 hover:bg-ink-800/30 text-ink-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-amber-600 font-mono">??</span>
                    <span className="text-xs tracking-wide">Unspecified</span>
                  </div>
                  <span className="text-[10px] text-ink-500 font-mono">{unknownLocationData.events.length}</span>
                </button>
              </>
            )}
          </div>
          
          {/* Footer stats */}
          <div className="px-4 py-3 border-t border-ink-800 bg-ink-900/50">
            <div className="text-[10px] text-ink-600 tracking-wide">
              <span className="text-ink-500">&gt;</span> {locationData.length} locations indexed
            </div>
          </div>
        </div>
      </div>

      {/* Hover tooltip - minimal */}
      {hoveredLocation && !selectedLocation && (
        <div className="absolute top-20 right-4 z-20 bg-ink-900/98 backdrop-blur-sm px-4 py-2 border-l-2 border-l-accent-red">
          <div className="text-white text-xs tracking-wide">{hoveredLocation}</div>
          <div className="text-ink-500 text-[10px] tracking-wider uppercase mt-0.5">Click to expand</div>
        </div>
      )}

      {/* AI Chat Panel - Typewriter style */}
      {showChatPanel && (
        <div className="absolute right-0 top-14 bottom-0 z-10 w-80 bg-ink-900/98 backdrop-blur-sm border-l border-ink-800 flex flex-col">
            <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-accent-red text-xs">&gt;</span>
                <h2 className="text-white text-xs tracking-wider uppercase">Interrogation_Log</h2>
              </div>
              <button 
                onClick={() => setShowChatPanel(false)}
                className="p-1 text-ink-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="py-6">
                  <div className="text-ink-600 text-[10px] uppercase tracking-widest mb-4 text-center">// Begin interrogation</div>
                  <div className="space-y-2 text-xs text-ink-500">
                    <p className="border-l border-ink-700 pl-3">"What happened in New York?"</p>
                    <p className="border-l border-ink-700 pl-3">"Tell me about Palm Beach"</p>
                    <p className="border-l border-ink-700 pl-3">"Who did you meet on the island?"</p>
                  </div>
                </div>
              )}
              
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`${
                    msg.role === 'user'
                      ? 'ml-4 border-l-2 border-l-ink-600'
                      : 'mr-4 border-l-2 border-l-accent-red bg-ink-800/30'
                  } pl-3 py-2`}
                >
                  <div className={`text-[10px] mb-1 tracking-wider uppercase ${
                    msg.role === 'user' ? 'text-ink-500' : 'text-accent-red'
                  }`}>
                    {msg.role === 'user' ? '> Investigator' : '> Subject'}
                  </div>
                  <p className={`text-xs leading-relaxed ${
                    msg.role === 'user' ? 'text-ink-200' : 'text-ink-300 italic'
                  }`}>
                    {msg.role === 'assistant' ? `"${msg.content}"` : msg.content}
                  </p>
                </div>
              ))}
              
              {chatLoading && (
                <div className="mr-4 border-l-2 border-l-accent-red bg-ink-800/30 pl-3 py-2">
                  <div className="text-[10px] text-accent-red tracking-wider uppercase mb-1">&gt; Subject</div>
                  <div className="flex items-center gap-2 text-ink-500 text-xs">
                    <span className="cursor-blink">Processing</span>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat input */}
            <form onSubmit={handleChatSubmit} className="p-4 border-t border-ink-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Enter query..."
                  className="flex-1 bg-ink-800/50 border-b border-ink-700 px-3 py-2 text-white text-xs tracking-wide placeholder-ink-600 focus:outline-none focus:border-accent-red transition-colors"
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3 py-2 bg-accent-red hover:bg-red-600 disabled:bg-ink-700 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-[10px] text-ink-600 hover:text-ink-400 mt-2 tracking-wide"
                >
                  // Clear log
                </button>
              )}
            </form>
          </div>
        )}

      {/* Detail Panel - Clean document style */}
      {selectedLocation && (
        <div className="absolute right-0 top-14 bottom-0 z-20 w-96 bg-ink-900/98 backdrop-blur-sm border-l border-ink-800 flex flex-col">
            {selectedEvent ? (
              /* Event Detail - Dossier style */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-800 flex-shrink-0">
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className="flex items-center gap-1 text-ink-500 hover:text-white text-[10px] tracking-wider uppercase mb-3 transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" /> Back
                  </button>
                  
                  {/* Event Title */}
                  <div className="border-l-2 border-l-accent-red pl-3 py-2">
                    <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-2">// Event Record</div>
                    <div className="text-sm text-ink-100 leading-relaxed">
                      <span className="text-accent-glow">{selectedEvent.actor}</span>
                      <span className="text-ink-500 mx-1.5">{selectedEvent.action}</span>
                      <span className="text-accent-glow">{selectedEvent.target}</span>
                    </div>
                  </div>
                </div>

                {/* Full Event Details */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Actor Info */}
                  <div className="border-l border-ink-700 pl-3 py-2">
                    <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-1">Subject_A</div>
                    <div className="text-accent-glow text-sm">{selectedEvent.actor}</div>
                    <button 
                      onClick={() => {
                        setBubbleMapPerson(selectedEvent.actor);
                        setZoomToPerson(selectedEvent.actor);
                        setShowBubbleMap(true);
                      }}
                      className="text-[10px] text-ink-500 hover:text-accent-red mt-1 flex items-center gap-1 transition-colors"
                    >
                      &gt; View network <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  
                  {/* Action */}
                  <div className="border-l border-ink-700 pl-3 py-2">
                    <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-1">Action</div>
                    <div className="text-ink-200 text-xs leading-relaxed">{selectedEvent.action}</div>
                  </div>
                  
                  {/* Target Info */}
                  <div className="border-l border-ink-700 pl-3 py-2">
                    <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-1">Subject_B</div>
                    <div className="text-accent-glow text-sm">{selectedEvent.target}</div>
                    <button 
                      onClick={() => {
                        setBubbleMapPerson(selectedEvent.target);
                        setZoomToPerson(selectedEvent.target);
                        setShowBubbleMap(true);
                      }}
                      className="text-[10px] text-ink-500 hover:text-accent-red mt-1 flex items-center gap-1 transition-colors"
                    >
                      &gt; View network <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  
                  {/* Date & Location */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border-l border-ink-700 pl-3 py-2">
                      <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-1">Date</div>
                      <div className="text-ink-200 text-xs font-mono">{selectedEvent.timestamp || '—'}</div>
                    </div>
                    <div className="border-l border-ink-700 pl-3 py-2">
                      <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-1">Location</div>
                      <div className="text-ink-200 text-xs">{selectedEvent.location || '—'}</div>
                    </div>
                  </div>
                  
                  {/* Document Reference */}
                  <div className="bg-ink-800/40 p-3 border-l-2 border-l-ink-600">
                    <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-2">Document_Ref</div>
                    <div className="text-ink-300 font-mono text-[11px]">{selectedEvent.doc_id}</div>
                    <div className="text-ink-600 text-[10px] mt-1">ID: {selectedEvent.id}</div>
                    <button
                      onClick={openDocumentModal}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent-red hover:bg-red-600 text-white text-xs tracking-wide transition-colors"
                    >
                      {documentLoading ? (
                        <>
                          <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : documentAILoading ? (
                        <>
                          <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : documentAI ? (
                        <span>&gt; View Analysis [Ready]</span>
                      ) : (
                        <span>&gt; View Document</span>
                      )}
                    </button>
                  </div>
                  
                  {/* Tags */}
                  {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                    <div className="border-l border-ink-700 pl-3 py-2">
                      <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedEvent.tags.map((tag, i) => (
                          <span 
                            key={i}
                            className="px-2 py-0.5 bg-ink-800 text-ink-400 text-[10px] tracking-wide"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* AI Interrogation */}
                  <div className="bg-ink-800/30 border-l-2 border-l-accent-red p-3">
                    <div className="text-[10px] text-accent-red uppercase tracking-widest mb-2">&gt; Interrogation</div>
                    {eventAILoading ? (
                      <div className="text-ink-500 text-xs cursor-blink">Processing</div>
                    ) : eventAI ? (
                      <p className="text-ink-300 text-xs italic leading-relaxed">"{eventAI}"</p>
                    ) : (
                      <button
                        onClick={() => askAboutEvent(selectedEvent)}
                        className="text-accent-red hover:text-accent-glow text-xs transition-colors"
                      >
                        &gt; Query subject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Location Detail */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-800 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-accent-red text-xs">&gt;</span>
                      <h2 className="text-sm font-medium text-white tracking-wide">{selectedLocation.name}</h2>
                    </div>
                    <button 
                      onClick={() => setSelectedLocationName(null)}
                      className="p-1 text-ink-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {selectedLocation.isUnknown && (
                    <p className="text-ink-500 text-[10px] tracking-wide mb-2">
                      // Events without geographic coordinates
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-[10px] text-ink-500 tracking-wide">
                    <span>{selectedLocation.events.length} records</span>
                    <span className="text-ink-700">|</span>
                    <span>{selectedLocation.people.size} subjects</span>
                  </div>
                  
                  {/* Bubble Map Button for Unknown Location */}
                  {selectedLocation.isUnknown && (
                    <button
                      onClick={() => {
                        setShowBubbleMap(true);
                        setBubbleMapPerson(null);
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-red hover:bg-red-600 text-white text-xs tracking-wide transition-colors"
                    >
                      <Network className="w-3.5 h-3.5" />
                      <span>&gt; Open Network Map</span>
                    </button>
                  )}
                </div>

                {/* People at this location */}
                <div className="px-4 py-3 border-b border-ink-800 flex-shrink-0">
                  <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-2">Subjects</div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {Array.from(selectedLocation.people).slice(0, 30).map(person => (
                      <span 
                        key={person}
                        className={`px-1.5 py-0.5 text-[10px] tracking-wide ${
                          person === 'Jeffrey Epstein' 
                            ? 'bg-accent-red/30 text-accent-glow' 
                            : 'bg-ink-800 text-ink-400'
                        }`}
                      >
                        {person}
                      </span>
                    ))}
                    {selectedLocation.people.size > 30 && (
                      <span className="px-1.5 py-0.5 text-[10px] text-ink-600">
                        +{selectedLocation.people.size - 30}
                      </span>
                    )}
                  </div>
                </div>

                {/* Events at this location */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-3">
                    Records [{selectedLocation.events.length}]
                  </div>
                  <div className="space-y-1">
                    {selectedLocation.events.slice(0, 100).map((event, i) => (
                      <button
                        key={i}
                        onClick={() => selectEvent(event)}
                        className="w-full text-left px-3 py-2 hover:bg-ink-800/50 transition-colors group border-l border-transparent hover:border-l-ink-600"
                      >
                        <div className="flex items-center justify-between text-[10px] text-ink-600 mb-1">
                          <span className="font-mono">{event.timestamp || '----'}</span>
                          <ChevronRight className="w-3 h-3 text-ink-700 group-hover:text-accent-red transition-colors" />
                        </div>
                        <div className="text-xs leading-relaxed">
                          <span className="text-accent-glow">{event.actor}</span>
                          <span className="text-ink-600 mx-1">{event.action.slice(0, 30)}{event.action.length > 30 ? '...' : ''}</span>
                          <span className="text-accent-glow">{event.target}</span>
                        </div>
                      </button>
                    ))}
                    {selectedLocation.events.length > 100 && (
                      <div className="text-center text-ink-600 text-[10px] py-2 tracking-wide">
                        +{selectedLocation.events.length - 100} more records
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Bubble Map Modal - Typewriter style */}
      {showBubbleMap && (
        <div className="fixed inset-0 z-50 bg-ink-950 flex flex-col font-mono">
          {/* Header */}
          <div className="flex-shrink-0 bg-ink-900 border-b border-ink-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-accent-red text-xs">&gt;</span>
              <h2 className="text-white text-xs tracking-wider uppercase">Network_Analysis</h2>
              <span className="text-ink-600 text-[10px] tracking-wide">
                {bubbleMapData.nodes.length} nodes | {bubbleMapData.links.length} links
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 bg-ink-800 px-2 py-1">
                <button
                  onClick={() => animateBubbleView(Math.max(0.1, bubbleZoom * 0.7), undefined, undefined, 250)}
                  className="px-2 py-1 text-ink-500 hover:text-white text-sm"
                >
                  −
                </button>
                <span className="text-ink-500 text-[10px] w-12 text-center font-mono">{Math.round(bubbleZoom * 100)}%</span>
                <button
                  onClick={() => animateBubbleView(Math.min(5, bubbleZoom * 1.4), undefined, undefined, 250)}
                  className="px-2 py-1 text-ink-500 hover:text-white text-sm"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => animateBubbleView(1, 0, 0, 500)}
                className="px-3 py-1.5 bg-ink-800 text-ink-500 hover:text-white text-[10px] tracking-wide transition-colors"
              >
                Reset
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
                className="p-2 text-ink-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
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
              <div className="absolute bottom-4 left-4 bg-ink-900/95 px-4 py-2 border-l-2 border-l-ink-700">
                <div className="text-[10px] text-ink-500 tracking-wide">// Scroll: zoom | Drag: pan | Click: select</div>
              </div>
            </div>
            
            {/* Selected Person Panel */}
            {bubbleMapPerson && (
              <div className="w-80 flex-shrink-0 bg-ink-900 border-l border-ink-800 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-800">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm text-white tracking-wide">{bubbleMapPerson}</h3>
                    <button 
                      onClick={() => setBubbleMapPerson(null)}
                      className="p-1 text-ink-500 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-ink-600 tracking-wide">
                    {selectedPersonEvents.length} associated records
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2">
                    {selectedPersonEvents.slice(0, 50).map((event, i) => (
                      <div
                        key={i}
                        className="p-2 border-l border-ink-700 hover:border-l-accent-red transition-colors"
                      >
                        {/* Event Header */}
                        <div className="text-xs leading-relaxed mb-1">
                          <span className={event.actor === bubbleMapPerson ? 'text-accent-glow' : 'text-ink-400'}>
                            {event.actor}
                          </span>
                          <span className="text-ink-600 mx-1">{event.action.slice(0, 20)}...</span>
                          <span className={event.target === bubbleMapPerson ? 'text-accent-glow' : 'text-ink-400'}>
                            {event.target}
                          </span>
                        </div>
                        
                        {/* Event Details */}
                        <div className="flex items-center gap-3 text-[10px] text-ink-600">
                          <span className="font-mono">{event.timestamp || '----'}</span>
                          <span className="font-mono truncate">{event.doc_id}</span>
                        </div>
                      </div>
                    ))}
                    
                    {selectedPersonEvents.length > 50 && (
                      <div className="text-center text-ink-600 text-[10px] py-2 tracking-wide">
                        +{selectedPersonEvents.length - 50} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Modal - Typewriter/Dossier style */}
      {showDocumentModal && (
        <div className="fixed inset-0 z-[60] bg-ink-950/95 flex items-center justify-center p-4 font-mono">
          <div className="bg-ink-900 max-w-4xl w-full max-h-[90vh] flex flex-col border border-ink-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-accent-red text-xs">&gt;</span>
                  <h2 className="text-white text-sm tracking-wider uppercase">Document_Analysis</h2>
                </div>
                {documentMeta && (
                  <div className="text-ink-500 text-[10px] tracking-wide font-mono pl-4">{documentMeta.doc_id} | {documentMeta.category}</div>
                )}
              </div>
              <button
                onClick={() => setShowDocumentModal(false)}
                className="p-2 text-ink-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI Epstein Summary */}
            <div className="px-5 py-4 border-b border-ink-800 bg-ink-800/30 border-l-2 border-l-accent-red mx-5 my-4">
              <div className="text-[10px] text-accent-red uppercase tracking-widest mb-3">&gt; Subject_Response</div>
              {documentAILoading ? (
                <div className="text-ink-500 text-xs cursor-blink">Processing document...</div>
              ) : documentAI ? (
                <p className="text-ink-200 text-xs italic leading-relaxed">"{documentAI}"</p>
              ) : (
                <p className="text-ink-600 text-xs italic">No response recorded</p>
              )}
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="text-[10px] text-ink-600 uppercase tracking-widest mb-3">// Raw_Document</div>
              {documentLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-ink-500 text-xs cursor-blink">Loading...</div>
                </div>
              ) : documentText ? (
                <div className="bg-ink-800/30 p-5 border-l border-ink-700">
                  <div className="text-ink-300 text-xs whitespace-pre-wrap leading-relaxed max-h-[350px] overflow-y-auto">
                    {documentText}
                  </div>
                </div>
              ) : (
                <div className="text-ink-600 text-center py-8 text-xs">
                  // Document unavailable
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-ink-800 flex justify-end">
              <button
                onClick={() => setShowDocumentModal(false)}
                className="px-4 py-2 bg-ink-800 hover:bg-ink-700 text-ink-300 text-xs tracking-wide transition-colors"
              >
                [Close]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
