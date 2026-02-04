/**
 * Location data and geocoding for the globe view
 */

// Known locations with coordinates [lat, lng]
export const LOCATION_COORDS: Record<string, [number, number]> = {
  // USA
  'New York': [40.7128, -74.0060],
  'New York City': [40.7128, -74.0060],
  'Manhattan': [40.7831, -73.9712],
  'Palm Beach': [26.7056, -80.0364],
  'Palm Beach, FL': [26.7056, -80.0364],
  'Florida': [27.6648, -81.5158],
  'Miami': [25.7617, -80.1918],
  'Los Angeles': [34.0522, -118.2437],
  'Las Vegas': [36.1699, -115.1398],
  'Washington': [38.9072, -77.0369],
  'Washington, D.C.': [38.9072, -77.0369],
  'Washington DC': [38.9072, -77.0369],
  'Boston': [42.3601, -71.0589],
  'Cambridge': [42.3736, -71.1097],
  'Harvard': [42.3770, -71.1167],
  'Santa Fe': [35.6870, -105.9378],
  'New Mexico': [34.5199, -105.8701],
  'Ohio': [40.4173, -82.9071],
  'Texas': [31.9686, -99.9018],
  'California': [36.7783, -119.4179],
  'Arizona': [34.0489, -111.0937],
  'New Jersey': [40.0583, -74.4057],
  'Connecticut': [41.6032, -73.0877],
  
  // Caribbean
  'US Virgin Islands': [18.3358, -64.8963],
  'Virgin Islands': [18.3358, -64.8963],
  'Little St. James': [18.2969, -64.8256],
  'St. Thomas': [18.3381, -64.8941],
  'St. James': [18.2969, -64.8256],
  'Caribbean': [18.0, -65.0],
  
  // Europe
  'London': [51.5074, -0.1278],
  'Paris': [48.8566, 2.3522],
  'France': [46.2276, 2.2137],
  'Monaco': [43.7384, 7.4246],
  'Switzerland': [46.8182, 8.2275],
  
  // Other
  'Israel': [31.0461, 34.8516],
  'Tel Aviv': [32.0853, 34.7818],
  'Japan': [36.2048, 138.2529],
  'Tokyo': [35.6762, 139.6503],
  'Australia': [-25.2744, 133.7751],
  'Africa': [8.7832, 34.5085],
  'Morocco': [31.7917, -7.0926],
  
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
  
  // Common patterns
  if (locationLower.includes('new york') || locationLower.includes('nyc') || locationLower.includes('manhattan')) {
    return LOCATION_COORDS['New York'];
  }
  if (locationLower.includes('palm beach') || locationLower.includes('florida') || locationLower.includes(' fl')) {
    return LOCATION_COORDS['Palm Beach'];
  }
  if (locationLower.includes('virgin island') || locationLower.includes('st. james') || locationLower.includes('caribbean')) {
    return LOCATION_COORDS['Virgin Islands'];
  }
  if (locationLower.includes('london') || locationLower.includes('uk') || locationLower.includes('england')) {
    return LOCATION_COORDS['London'];
  }
  if (locationLower.includes('paris') || locationLower.includes('france')) {
    return LOCATION_COORDS['Paris'];
  }
  if (locationLower.includes('washington') || locationLower.includes('d.c.') || locationLower.includes('dc')) {
    return LOCATION_COORDS['Washington'];
  }
  
  return null;
}

// Get a display name for a location
export function normalizeLocation(location: string): string {
  if (!location) return 'Unknown';
  
  const loc = location.toLowerCase();
  
  if (loc.includes('new york') || loc.includes('manhattan') || loc.includes('nyc')) return 'New York';
  if (loc.includes('palm beach')) return 'Palm Beach';
  if (loc.includes('virgin island') || loc.includes('little st. james') || loc.includes('st james')) return 'US Virgin Islands';
  if (loc.includes('london')) return 'London';
  if (loc.includes('paris')) return 'Paris';
  if (loc.includes('washington') || loc.includes('d.c.')) return 'Washington DC';
  if (loc.includes('miami')) return 'Miami';
  if (loc.includes('los angeles') || loc.includes('la')) return 'Los Angeles';
  if (loc.includes('santa fe') || loc.includes('new mexico')) return 'New Mexico';
  if (loc.includes('harvard') || loc.includes('cambridge') || loc.includes('boston')) return 'Boston';
  
  // Return original if no normalization
  return location;
}
