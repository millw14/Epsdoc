/**
 * Location data and geocoding for the globe view
 */

// Known locations with coordinates [lat, lng]
// Coordinates adjusted to prevent overlapping when displayed on globe
export const LOCATION_COORDS: Record<string, [number, number]> = {
  // USA - East Coast (spread out to avoid overlap)
  'New York': [41.0, -74.0],  // Slightly north to separate from others
  'New York City': [41.0, -74.0],
  'Manhattan': [40.7831, -73.9712],
  'Palm Beach': [26.7, -80.0],  // Accurate Palm Beach FL
  'Palm Beach, FL': [26.7, -80.0],
  'Florida': [28.5, -82.5],  // Central Florida - moved west to separate from Palm Beach
  'Miami': [25.76, -80.19],
  'Washington': [38.9, -77.0],
  'Washington, D.C.': [38.9, -77.0],
  'Washington DC': [38.9, -77.0],
  'Boston': [42.36, -71.06],
  'Cambridge': [42.37, -71.11],
  'Harvard': [42.38, -71.12],
  'New Jersey': [40.06, -74.41],
  'Connecticut': [41.60, -72.70],
  
  // USA - West Coast & Other
  'Los Angeles': [34.05, -118.24],
  'Las Vegas': [36.17, -115.14],
  'Santa Fe': [35.69, -105.94],
  'New Mexico': [34.52, -105.87],
  'Ohio': [40.42, -82.91],
  'Texas': [31.97, -99.90],
  'California': [36.78, -119.42],
  'Arizona': [34.05, -111.09],
  
  // Caribbean - spread out more
  'US Virgin Islands': [18.34, -64.90],
  'Virgin Islands': [18.34, -64.90],
  'Little St. James': [18.30, -64.83],  // Epstein's island
  'St. Thomas': [18.34, -64.89],
  'St. James': [18.30, -64.83],
  'Caribbean': [19.0, -69.0],  // Moved to avoid overlap with VI
  
  // Europe
  'London': [51.51, -0.13],
  'Paris': [48.86, 2.35],
  'France': [46.23, 2.21],
  'Monaco': [43.74, 7.42],
  'Switzerland': [46.82, 8.23],
  
  // Middle East & Asia
  'Israel': [31.05, 34.85],
  'Tel Aviv': [32.09, 34.78],
  'Japan': [36.20, 138.25],
  'Tokyo': [35.68, 139.65],
  
  // Other
  'Australia': [-25.27, 133.78],
  'Africa': [8.78, 34.51],
  'Morocco': [31.79, -7.09],
  
  // Generic
  'International': [0, 0],
  'Unknown': [0, 0],
};

// Parse location string and return coordinates
export function getLocationCoords(location: string): [number, number] | null {
  if (!location) return null;
  
  // Direct match
  const direct = LOCATION_COORDS[location];
  if (direct) return direct;
  
  // Partial match
  const locationLower = location.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (locationLower.includes(key.toLowerCase()) || key.toLowerCase().includes(locationLower)) {
      return coords;
    }
  }
  
  // Common patterns - more specific matches first
  if (locationLower.includes('palm beach')) {
    return LOCATION_COORDS['Palm Beach'];
  }
  if (locationLower.includes('virgin island') || locationLower.includes('st. james') || locationLower.includes('little st james')) {
    return LOCATION_COORDS['US Virgin Islands'];
  }
  if (locationLower.includes('new york') || locationLower.includes('nyc') || locationLower.includes('manhattan')) {
    return LOCATION_COORDS['New York'];
  }
  if (locationLower.includes('miami')) {
    return LOCATION_COORDS['Miami'];
  }
  if (locationLower.includes('florida') || locationLower === 'fl') {
    return LOCATION_COORDS['Florida'];
  }
  if (locationLower.includes('london') || locationLower.includes('uk') || locationLower.includes('england')) {
    return LOCATION_COORDS['London'];
  }
  if (locationLower.includes('paris')) {
    return LOCATION_COORDS['Paris'];
  }
  if (locationLower.includes('france')) {
    return LOCATION_COORDS['France'];
  }
  if (locationLower.includes('washington') || locationLower.includes('d.c.') || locationLower.includes('dc')) {
    return LOCATION_COORDS['Washington'];
  }
  if (locationLower.includes('caribbean')) {
    return LOCATION_COORDS['Caribbean'];
  }
  
  return null;
}

// Get a display name for a location
export function normalizeLocation(location: string): string {
  if (!location) return 'Unknown';
  
  const loc = location.toLowerCase();
  
  // More specific matches first
  if (loc.includes('palm beach')) return 'Palm Beach';
  if (loc.includes('virgin island') || loc.includes('little st. james') || loc.includes('st james') || loc.includes("epstein's island")) return 'US Virgin Islands';
  if (loc.includes('new york') || loc.includes('manhattan') || loc.includes('nyc')) return 'New York';
  if (loc.includes('miami')) return 'Miami';
  if (loc.includes('florida') || loc === 'fl') return 'Florida';
  if (loc.includes('london') || loc.includes('uk') || loc.includes('england')) return 'London';
  if (loc.includes('paris')) return 'Paris';
  if (loc.includes('france')) return 'France';
  if (loc.includes('washington') || loc.includes('d.c.')) return 'Washington DC';
  if (loc.includes('los angeles')) return 'Los Angeles';
  if (loc.includes('santa fe')) return 'Santa Fe';
  if (loc.includes('new mexico')) return 'New Mexico';
  if (loc.includes('harvard') || loc.includes('cambridge')) return 'Boston';
  if (loc.includes('boston')) return 'Boston';
  if (loc.includes('israel') || loc.includes('tel aviv')) return 'Israel';
  if (loc.includes('tokyo') || loc.includes('japan')) return 'Japan';
  
  // Return original if no normalization
  return location;
}
