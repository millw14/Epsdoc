/**
 * GlobeGL - Optimized 3D Globe visualization using Globe.GL
 * Performance optimized: flat polygons, filtered countries, no heavy transitions
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';

interface Location {
  name: string;
  lat: number;
  lng: number;
  color: string;
  eventCount: number;
}

interface Props {
  width: number;
  height: number;
  className?: string;
  locations: Location[];
  selectedLocation: string | null;
  onLocationClick?: (name: string) => void;
  onLocationHover?: (name: string | null) => void;
}

// Map location names to country codes (ISO 3166-1 alpha-3)
const LOCATION_TO_COUNTRY: Record<string, string[]> = {
  'New York': ['USA'],
  'Palm Beach': ['USA'],
  'Florida': ['USA'],
  'Miami': ['USA'],
  'Washington DC': ['USA'],
  'New Mexico': ['USA'],
  'California': ['USA'],
  'Ohio': ['USA'],
  'Boston': ['USA'],
  'US Virgin Islands': ['VIR'],
  'Little St. James': ['VIR'],
  'Caribbean': ['VIR', 'PRI', 'CUB', 'JAM'],
  'Paris': ['FRA'],
  'France': ['FRA'],
  'London': ['GBR'],
  'United Kingdom': ['GBR'],
  'Israel': ['ISR'],
  'Morocco': ['MAR'],
  'Marrakech': ['MAR'],
  'Africa': ['MAR', 'ZAF', 'EGY'],
  'Japan': ['JPN'],
  'Mexico': ['MEX'],
  'Canada': ['CAN'],
  'Germany': ['DEU'],
  'Switzerland': ['CHE'],
  'Australia': ['AUS'],
  'Spain': ['ESP'],
  'Italy': ['ITA'],
  'Russia': ['RUS'],
  'China': ['CHN'],
  'Dubai': ['ARE'],
  'UAE': ['ARE'],
  'Brazil': ['BRA'],
};

export default function GlobeGL({
  width,
  height,
  className = '',
  locations,
  selectedLocation,
  onLocationClick,
  onLocationHover
}: Props) {
  const globeRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [allCountries, setAllCountries] = useState<any[]>([]);

  // Get all country codes that have events
  const countriesWithEvents = useMemo(() => {
    const codes = new Set<string>();
    locations.forEach(loc => {
      const locCodes = LOCATION_TO_COUNTRY[loc.name] || [];
      locCodes.forEach(c => codes.add(c));
    });
    return codes;
  }, [locations]);

  // Load and filter country GeoJSON - only keep countries with events
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => {
        // Filter to only countries with events for better performance
        const filtered = data.features.filter((f: any) => 
          countriesWithEvents.has(f.properties.ISO_A3)
        );
        setAllCountries(filtered);
      })
      .catch(err => console.error('Failed to load countries:', err));
  }, [countriesWithEvents]);

  // Get highlighted country codes based on selected location
  const highlightedCountries = useMemo(() => {
    if (!selectedLocation) return new Set<string>();
    const codes = LOCATION_TO_COUNTRY[selectedLocation] || [];
    return new Set(codes);
  }, [selectedLocation]);

  // Memoize polygon data with colors baked in for performance
  const polygonsData = useMemo(() => {
    return allCountries.map(feat => ({
      ...feat,
      _color: highlightedCountries.has(feat.properties.ISO_A3)
        ? 'rgba(220, 38, 38, 0.85)'
        : 'rgba(220, 38, 38, 0.3)'
    }));
  }, [allCountries, highlightedCountries]);

  // Format locations for points (faster than labels)
  const pointsData = useMemo(() => locations.map(loc => ({
    lat: loc.lat,
    lng: loc.lng,
    name: loc.name,
    color: loc.color,
    size: Math.min(Math.sqrt(loc.eventCount) * 0.08 + 0.15, 0.8),
    eventCount: loc.eventCount,
    isSelected: loc.name === selectedLocation
  })), [locations, selectedLocation]);

  // Animate to location when selected
  useEffect(() => {
    if (globeRef.current && selectedLocation && isReady) {
      const loc = locations.find(l => l.name === selectedLocation);
      if (loc) {
        globeRef.current.pointOfView(
          { lat: loc.lat, lng: loc.lng, altitude: 1.5 },
          800
        );
      }
    }
  }, [selectedLocation, locations, isReady]);

  // Initial setup
  useEffect(() => {
    if (globeRef.current && isReady) {
      globeRef.current.pointOfView({ lat: 30, lng: -40, altitude: 2.5 }, 0);
      
      const controls = globeRef.current.controls();
      controls.autoRotate = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 1;
      controls.zoomSpeed = 1;
    }
  }, [isReady]);

  const handlePolygonClick = useCallback((polygon: any) => {
    const countryCode = polygon?.properties?.ISO_A3;
    if (!countryCode) return;
    
    for (const [locName, codes] of Object.entries(LOCATION_TO_COUNTRY)) {
      if (codes.includes(countryCode)) {
        const loc = locations.find(l => l.name === locName);
        if (loc && onLocationClick) {
          onLocationClick(locName);
          break;
        }
      }
    }
  }, [locations, onLocationClick]);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        onGlobeReady={() => setIsReady(true)}
        
        // Dark globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundColor="#0a0a12"
        
        // Flat country polygons (no extrusion = faster)
        polygonsData={polygonsData}
        polygonCapColor={(d: any) => d._color}
        polygonSideColor={() => 'transparent'}
        polygonStrokeColor={() => 'transparent'}
        polygonAltitude={0.005}
        polygonsTransitionDuration={200}
        onPolygonClick={handlePolygonClick}
        
        // Points instead of labels (much faster)
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d: any) => d.isSelected ? '#ffffff' : d.color}
        pointAltitude={(d: any) => d.isSelected ? 0.02 : 0.005}
        pointRadius={(d: any) => d.isSelected ? d.size * 1.5 : d.size}
        pointsMerge={true}
        onPointClick={(point: any) => onLocationClick?.(point.name)}
        onPointHover={(point: any) => {
          onLocationHover?.(point ? point.name : null);
          document.body.style.cursor = point ? 'pointer' : 'default';
        }}
        
        // Minimal atmosphere
        showAtmosphere={true}
        atmosphereColor="#dc2626"
        atmosphereAltitude={0.08}
        
        animateIn={false}
      />
      
      {/* Location name overlay */}
      {selectedLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg border border-red-500/50">
          <span className="text-white font-medium">{selectedLocation}</span>
        </div>
      )}
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <div className="text-gray-400 text-sm">Loading Globe...</div>
          </div>
        </div>
      )}
    </div>
  );
}
