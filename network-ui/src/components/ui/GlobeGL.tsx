/**
 * GlobeGL - 3D Globe visualization using Globe.GL with country polygons
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
  'Los Angeles': ['USA'],
  'Las Vegas': ['USA'],
  'US Virgin Islands': ['VIR'],
  'Little St. James': ['VIR'],
  'Caribbean': ['VIR', 'PRI', 'CUB', 'JAM', 'HTI', 'DOM', 'BHS'],
  'Paris': ['FRA'],
  'France': ['FRA'],
  'London': ['GBR'],
  'United Kingdom': ['GBR'],
  'UK': ['GBR'],
  'Israel': ['ISR'],
  'Morocco': ['MAR'],
  'Marrakech': ['MAR'],
  'Marrakech, Morocco': ['MAR'],
  'Africa': ['MAR', 'ZAF', 'EGY', 'KEN', 'NGA'],
  'Japan': ['JPN'],
  'Tokyo': ['JPN'],
  'Mexico': ['MEX'],
  'Canada': ['CAN'],
  'Germany': ['DEU'],
  'Switzerland': ['CHE'],
  'Monaco': ['MCO'],
  'Australia': ['AUS'],
  'Spain': ['ESP'],
  'Italy': ['ITA'],
  'Rome': ['ITA'],
  'Russia': ['RUS'],
  'China': ['CHN'],
  'Hong Kong': ['HKG', 'CHN'],
  'Dubai': ['ARE'],
  'UAE': ['ARE'],
  'Saudi Arabia': ['SAU'],
  'Sweden': ['SWE'],
  'Norway': ['NOR'],
  'Denmark': ['DNK'],
  'Netherlands': ['NLD'],
  'Belgium': ['BEL'],
  'Austria': ['AUT'],
  'Greece': ['GRC'],
  'Turkey': ['TUR'],
  'Thailand': ['THA'],
  'Singapore': ['SGP'],
  'Brazil': ['BRA'],
  'Argentina': ['ARG'],
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
  const [countries, setCountries] = useState<any>({ features: [] });
  const [hovered, setHovered] = useState<string | null>(null);

  // Load country GeoJSON
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => {
        setCountries(data);
      })
      .catch(err => console.error('Failed to load countries:', err));
  }, []);

  // Get highlighted country codes based on selected location
  const highlightedCountries = useMemo(() => {
    if (!selectedLocation) return new Set<string>();
    const codes = LOCATION_TO_COUNTRY[selectedLocation] || [];
    return new Set(codes);
  }, [selectedLocation]);

  // Get countries with events (for base coloring)
  const countriesWithEvents = useMemo(() => {
    const codes = new Set<string>();
    locations.forEach(loc => {
      const locCodes = LOCATION_TO_COUNTRY[loc.name] || [];
      locCodes.forEach(c => codes.add(c));
    });
    return codes;
  }, [locations]);

  // Format locations for labels
  const labelsData = useMemo(() => locations.map(loc => ({
    lat: loc.lat,
    lng: loc.lng,
    name: loc.name,
    color: loc.color,
    eventCount: loc.eventCount,
    isSelected: loc.name === selectedLocation
  })), [locations, selectedLocation]);

  // Animate to location when selected - smooth zoom
  useEffect(() => {
    if (globeRef.current && selectedLocation && isReady) {
      const loc = locations.find(l => l.name === selectedLocation);
      if (loc) {
        // Smooth camera animation with longer duration
        globeRef.current.pointOfView(
          { lat: loc.lat, lng: loc.lng, altitude: 1.0 },
          1200 // Longer duration for smoother feel
        );
      }
    }
  }, [selectedLocation, locations, isReady]);

  // Initial setup with smooth controls - no auto rotation
  useEffect(() => {
    if (globeRef.current && isReady) {
      globeRef.current.pointOfView({ lat: 30, lng: -40, altitude: 2.2 }, 0);
      
      const controls = globeRef.current.controls();
      controls.autoRotate = false; // Disabled for smoother experience
      
      // Smoother controls
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 0.5;
      controls.zoomSpeed = 0.8;
    }
  }, [isReady]);

  // Get polygon color based on state
  const getPolygonColor = useCallback((feat: any) => {
    const countryCode = feat.properties.ISO_A3;
    const isHighlighted = highlightedCountries.has(countryCode);
    const hasEvents = countriesWithEvents.has(countryCode);
    const isHovered = hovered === countryCode;
    
    if (isHighlighted) {
      return 'rgba(220, 38, 38, 0.9)'; // Red for selected
    }
    if (isHovered) {
      return 'rgba(220, 38, 38, 0.5)'; // Lighter red for hover
    }
    if (hasEvents) {
      return 'rgba(220, 38, 38, 0.25)'; // Subtle red for countries with events
    }
    return 'rgba(30, 60, 90, 0.4)'; // Dark blue for others
  }, [highlightedCountries, countriesWithEvents, hovered]);

  // Get polygon altitude (extrude selected countries)
  const getPolygonAltitude = useCallback((feat: any) => {
    const countryCode = feat.properties.ISO_A3;
    const isHighlighted = highlightedCountries.has(countryCode);
    return isHighlighted ? 0.06 : 0.01;
  }, [highlightedCountries]);

  const handlePolygonClick = useCallback((polygon: any) => {
    const countryCode = polygon?.properties?.ISO_A3;
    if (!countryCode) return;
    
    // Find a location in this country
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

  const handlePolygonHover = useCallback((polygon: any) => {
    const countryCode = polygon?.properties?.ISO_A3 || null;
    setHovered(countryCode);
    document.body.style.cursor = polygon ? 'pointer' : 'default';
  }, []);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        onGlobeReady={() => setIsReady(true)}
        
        // Dark globe base
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        // Country polygons - borderless, smooth transitions
        polygonsData={countries.features}
        polygonCapColor={getPolygonColor}
        polygonSideColor={() => 'rgba(150, 50, 50, 0.1)'}
        polygonStrokeColor={() => 'transparent'}
        polygonAltitude={getPolygonAltitude}
        polygonsTransitionDuration={600}
        onPolygonClick={handlePolygonClick}
        onPolygonHover={handlePolygonHover}
        
        // Location labels with smooth transitions
        labelsData={labelsData}
        labelLat="lat"
        labelLng="lng"
        labelText="name"
        labelSize={(d: any) => d.isSelected ? 1.8 : 0.9}
        labelDotRadius={(d: any) => d.isSelected ? 1.0 : 0.5}
        labelColor={(d: any) => d.isSelected ? '#ffffff' : d.color}
        labelResolution={3}
        labelAltitude={(d: any) => d.isSelected ? 0.1 : 0.02}
        labelsTransitionDuration={500}
        onLabelClick={(label: any) => {
          if (onLocationClick) {
            onLocationClick(label.name);
          }
        }}
        onLabelHover={(label: any) => {
          if (onLocationHover) {
            onLocationHover(label ? label.name : null);
          }
          document.body.style.cursor = label ? 'pointer' : 'default';
        }}
        
        // No atmosphere border
        showAtmosphere={false}
        
        // Animation
        animateIn={true}
      />
      
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
