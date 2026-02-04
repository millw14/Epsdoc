import { useState, useEffect, useRef } from 'react';
import { searchActors } from '../api';
import type { Stats, Actor, TagCluster } from '../types';
import {
  Network,
  FileText,
  Users,
  X,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Filter,
  Tag,
  FolderOpen,
} from 'lucide-react';

interface SidebarProps {
  stats: Stats | null;
  selectedActor: string | null;
  onActorSelect: (actor: string | null) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  maxHops: number | null;
  onMaxHopsChange: (maxHops: number | null) => void;
  minDensity: number;
  onMinDensityChange: (density: number) => void;
  tagClusters: TagCluster[];
  enabledClusterIds: Set<number>;
  onToggleCluster: (clusterId: number) => void;
  enabledCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  yearRange: [number, number];
  onYearRangeChange: (range: [number, number]) => void;
  includeUndated: boolean;
  onIncludeUndatedChange: (include: boolean) => void;
  keywords: string;
  onKeywordsChange: (keywords: string) => void;
}

export default function Sidebar({
  stats,
  selectedActor,
  onActorSelect,
  limit,
  onLimitChange,
  maxHops,
  onMaxHopsChange,
  minDensity,
  onMinDensityChange,
  tagClusters,
  enabledClusterIds,
  onToggleCluster,
  enabledCategories,
  onToggleCategory,
  yearRange,
  onYearRangeChange,
  includeUndated,
  onIncludeUndatedChange,
  keywords,
  onKeywordsChange
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Actor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [contentFiltersExpanded, setContentFiltersExpanded] = useState(false);
  const [graphSettingsExpanded, setGraphSettingsExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [localYearRange, setLocalYearRange] = useState<[number, number]>(yearRange);
  const [localLimit, setLocalLimit] = useState(limit);
  const [localKeywords, setLocalKeywords] = useState(keywords);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const limitDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [minSliderZIndex, setMinSliderZIndex] = useState(4);
  const [maxSliderZIndex, setMaxSliderZIndex] = useState(3);

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchActors(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Sync external yearRange changes to local state
  useEffect(() => {
    setLocalYearRange(yearRange);
  }, [yearRange]);

  // Sync external limit changes to local state
  useEffect(() => {
    setLocalLimit(limit);
  }, [limit]);

  // Sync external keywords changes to local state
  useEffect(() => {
    setLocalKeywords(keywords);
  }, [keywords]);

  // Debounce year range changes
  const handleYearRangeChange = (newRange: [number, number]) => {
    setLocalYearRange(newRange);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for 2 seconds
    debounceTimerRef.current = setTimeout(() => {
      onYearRangeChange(newRange);
    }, 2000);
  };

  // Debounce limit changes
  const handleLimitChange = (newLimit: number) => {
    setLocalLimit(newLimit);

    // Clear existing timer
    if (limitDebounceTimerRef.current) {
      clearTimeout(limitDebounceTimerRef.current);
    }

    // Set new timer for 2 seconds
    limitDebounceTimerRef.current = setTimeout(() => {
      onLimitChange(newLimit);
    }, 2000);
  };

  // Cleanup debounce timers
  useEffect(() => {
    return () => {
      if (limitDebounceTimerRef.current) {
        clearTimeout(limitDebounceTimerRef.current);
      }
    };
  }, []);

  // Handle mouse movement over slider to dynamically adjust z-index based on proximity
  const handleSliderMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const sliderWidth = rect.width;

    // Calculate positions of the two handles as percentages
    const minPosition = ((localYearRange[0] - 1970) / (2025 - 1970)) * sliderWidth;
    const maxPosition = ((localYearRange[1] - 1970) / (2025 - 1970)) * sliderWidth;

    // Calculate distance from mouse to each handle
    const distanceToMin = Math.abs(mouseX - minPosition);
    const distanceToMax = Math.abs(mouseX - maxPosition);

    // Put the closer handle on top
    if (distanceToMin < distanceToMax) {
      setMinSliderZIndex(4);
      setMaxSliderZIndex(3);
    } else {
      setMinSliderZIndex(3);
      setMaxSliderZIndex(4);
    }
  };

  // Handle keyword search submission
  const handleKeywordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onKeywordsChange(localKeywords);
  };

  return (
    <div className="w-80 bg-gray-950/95 border-r border-cyan-900/30 flex flex-col h-screen overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-900/50 flex-shrink-0 bg-gradient-to-r from-cyan-950/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Network className="w-6 h-6 text-cyan-400" />
            <div className="absolute inset-0 w-6 h-6 bg-cyan-400/20 blur-md"></div>
          </div>
          <div>
            <h1 className="font-bold text-cyan-400 tracking-wide" style={{ fontSize: '18px' }}>
              NETWORK EXPLORER
            </h1>
            <p className="text-[10px] text-cyan-600 font-mono tracking-widest">INVESTIGATIVE SYSTEM v2.0</p>
          </div>
        </div>
      </div>

      {/* Stats - HUD Style */}
      {stats && (
        <div className="p-4 border-b border-cyan-900/30 flex-shrink-0">
          <div className="text-[10px] text-cyan-600 font-mono tracking-widest mb-2">DATABASE METRICS</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center gap-2 font-mono text-xs">
                <FileText className="w-3.5 h-3.5 text-cyan-600" />
                DOCUMENTS
              </span>
              <span className="font-mono text-cyan-400 text-xs">
                {stats.totalDocuments.count.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center gap-2 font-mono text-xs">
                <Network className="w-3.5 h-3.5 text-cyan-600" />
                CONNECTIONS
              </span>
              <span className="font-mono text-cyan-400 text-xs">
                {stats.totalTriples.count.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center gap-2 font-mono text-xs">
                <Users className="w-3.5 h-3.5 text-cyan-600" />
                ENTITIES
              </span>
              <span className="font-mono text-cyan-400 text-xs">
                {stats.totalActors.count.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Actor Indicator */}
      {selectedActor && (
        <div className="p-4 border-b border-cyan-900/30 flex-shrink-0">
          <div className="flex items-center justify-between bg-cyan-950/50 border border-cyan-500/30 rounded-lg p-3">
            <div>
              <div className="text-[10px] text-cyan-600 font-mono tracking-wider mb-1">TARGET SELECTED</div>
              <div className="font-medium text-cyan-400 font-mono">{selectedActor}</div>
            </div>
            <button
              onClick={() => onActorSelect(null)}
              className="p-1.5 bg-red-600 hover:bg-red-700 rounded transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Controls Accordion - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Graph Settings Section */}
        <div className="p-4 border-b border-cyan-900/30">
          <button
            onClick={() => setGraphSettingsExpanded(!graphSettingsExpanded)}
            className="w-full flex items-center justify-between text-sm font-mono mb-3 hover:text-cyan-400 transition-colors"
          >
            <span className="flex items-center gap-2 text-gray-300">
              <SlidersHorizontal className="w-4 h-4 text-cyan-600" />
              RENDER SETTINGS
            </span>
            {graphSettingsExpanded ? <ChevronDown className="w-4 h-4 text-cyan-600" /> : <ChevronRight className="w-4 h-4 text-cyan-600" />}
          </button>
          {graphSettingsExpanded && (
            <>
              {/* Limit Slider */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Relationships to display: {localLimit.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="100"
                  max="25000"
                  step="500"
                  value={localLimit}
                  onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Hop Distance Slider */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Maximum hops from Jeffrey Epstein: {maxHops === null ? 'Any' : maxHops}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={maxHops === null ? 6 : maxHops}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      onMaxHopsChange(value === 6 ? null : value);
                    }}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>Any</span>
                </div>
              </div>

              {/* Network Density Slider */}
              <div className="mb-0">
                <label className="block text-sm text-gray-400 mb-2">
                  Network density threshold: {minDensity}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={minDensity}
                  onChange={(e) => onMinDensityChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Show actors with at least this percentage of average connections for their hop distance
                </p>
              </div>
            </>
          )}
        </div>

        {/* Filters Section */}
        <div className="p-4 border-b border-cyan-900/30">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full flex items-center justify-between text-sm font-mono mb-3 hover:text-cyan-400 transition-colors"
          >
            <span className="flex items-center gap-2 text-gray-300">
              <Filter className="w-4 h-4 text-cyan-600" />
              DATA FILTERS
            </span>
            {filtersExpanded ? <ChevronDown className="w-4 h-4 text-cyan-600" /> : <ChevronRight className="w-4 h-4 text-cyan-600" />}
          </button>
          {filtersExpanded && (
            <>
              {/* Time Range Slider */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Time range: {localYearRange[0]} - {localYearRange[1]}
                </label>
                <div className="relative pt-1">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>1970</span>
                    <span>2025</span>
                  </div>
                  <div className="relative h-6" onMouseMove={handleSliderMouseMove}>
                    {/* Max year slider */}
                    <input
                      type="range"
                      min="1970"
                      max="2025"
                      step="1"
                      value={localYearRange[1]}
                      onChange={(e) => {
                        const newMax = parseInt(e.target.value);
                        if (newMax >= localYearRange[0]) {
                          handleYearRangeChange([localYearRange[0], newMax]);
                        }
                      }}
                      className="absolute top-2 w-full h-2 bg-transparent appearance-none cursor-pointer"
                      style={{
                        zIndex: maxSliderZIndex,
                        pointerEvents: 'auto',
                      }}
                    />
                    {/* Min year slider */}
                    <input
                      type="range"
                      min="1970"
                      max="2025"
                      step="1"
                      value={localYearRange[0]}
                      onChange={(e) => {
                        const newMin = parseInt(e.target.value);
                        if (newMin <= localYearRange[1]) {
                          handleYearRangeChange([newMin, localYearRange[1]]);
                        }
                      }}
                      className="absolute top-2 w-full h-2 bg-transparent appearance-none cursor-pointer"
                      style={{
                        zIndex: minSliderZIndex,
                        pointerEvents: 'auto',
                      }}
                    />
                    {/* Track background */}
                    <div className="absolute top-2 w-full h-2 bg-gray-700 rounded-lg pointer-events-none" style={{ zIndex: 1 }}>
                      <div
                        className="absolute h-2 bg-blue-600 rounded-lg"
                        style={{
                          left: `${((localYearRange[0] - 1970) / (2025 - 1970)) * 100}%`,
                          right: `${100 - ((localYearRange[1] - 1970) / (2025 - 1970)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Include undated events checkbox */}
                <div className="mt-3 flex items-center">
                  <input
                    type="checkbox"
                    id="includeUndated"
                    checked={includeUndated}
                    onChange={(e) => onIncludeUndatedChange(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="includeUndated" className="ml-2 text-sm text-gray-400 cursor-pointer">
                    Include undated events
                  </label>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4 relative">
                <label className="text-xs text-gray-500 mb-2 flex items-center gap-2 font-mono">
                  <Search className="w-3.5 h-3.5 text-cyan-600" />
                  SEARCH ENTITIES
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter target name..."
                  className="w-full px-3 py-2 bg-gray-900 border border-cyan-900/50 rounded text-sm font-mono focus:outline-none focus:border-cyan-500 text-cyan-400 placeholder-gray-600"
                />

                {/* Search Results */}
                {searchQuery.trim().length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isSearching ? (
                      <div className="px-3 py-2 text-sm text-gray-400">
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((actor) => (
                        <button
                          key={actor.name}
                          onClick={() => {
                            onActorSelect(actor.name);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-600 transition-colors border-b border-gray-600 last:border-b-0"
                        >
                          <div className="font-medium text-white">{actor.name}</div>
                          <div className="text-xs text-gray-400">
                            {actor.connection_count} relationships
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-400">
                        No actors found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Keyword Filter */}
              <form onSubmit={handleKeywordSubmit} className="mb-0">
                <label className="block text-sm text-gray-400 mb-2">
                  Keyword filter:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localKeywords}
                    onChange={(e) => setLocalKeywords(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleKeywordSubmit()}
                    placeholder="e.g., massage, aircraft, island"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Go
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated keywords (fuzzy match)
                </p>
              </form>
            </>
          )}
        </div>

        {/* Tag Cluster Filters */}
        <div className="p-4 border-b border-cyan-900/30">
        <button
          onClick={() => setContentFiltersExpanded(!contentFiltersExpanded)}
          className="w-full flex items-center justify-between text-sm font-mono mb-3 hover:text-cyan-400 transition-colors"
        >
          <span className="flex items-center gap-2 text-gray-300">
            <Tag className="w-4 h-4 text-cyan-600" />
            CONTENT TAGS
          </span>
          {contentFiltersExpanded ? <ChevronDown className="w-4 h-4 text-cyan-600" /> : <ChevronRight className="w-4 h-4 text-cyan-600" />}
        </button>
        {contentFiltersExpanded && (
          <>
            <div className="flex gap-1.5 mb-3">
              <button
                onClick={() => {
                  tagClusters.forEach(cluster => {
                    if (!enabledClusterIds.has(cluster.id)) {
                      onToggleCluster(cluster.id);
                    }
                  });
                }}
                className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                style={{ fontSize: '9px' }}
              >
                Select All
              </button>
              <button
                onClick={() => {
                  tagClusters.forEach(cluster => {
                    if (enabledClusterIds.has(cluster.id)) {
                      onToggleCluster(cluster.id);
                    }
                  });
                }}
                className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                style={{ fontSize: '9px' }}
              >
                Deselect All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagClusters.map((cluster) => {
                const isEnabled = enabledClusterIds.has(cluster.id);
                return (
                  <button
                    key={cluster.id}
                    onClick={() => onToggleCluster(cluster.id)}
                    className={`px-2 py-1 rounded font-mono transition-colors ${
                      isEnabled
                        ? 'bg-cyan-600/30 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-600/40'
                        : 'bg-gray-800 text-gray-500 border border-gray-700 hover:border-gray-600'
                    }`}
                    style={{ fontSize: '9px' }}
                    title={`${cluster.tagCount} tags: ${cluster.exemplars.join(', ')}`}
                  >
                    {cluster.name.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

        {/* Categories */}
        {stats && (
          <div className="p-4">
          <button
            onClick={() => setCategoriesExpanded(!categoriesExpanded)}
            className="w-full flex items-center justify-between text-sm font-mono mb-3 hover:text-cyan-400 transition-colors"
          >
            <span className="flex items-center gap-2 text-gray-300">
              <FolderOpen className="w-4 h-4 text-cyan-600" />
              DOCUMENT TYPES
            </span>
            {categoriesExpanded ? <ChevronDown className="w-4 h-4 text-cyan-600" /> : <ChevronRight className="w-4 h-4 text-cyan-600" />}
          </button>
          {categoriesExpanded && (
            <>
              <div className="flex gap-1.5 mb-3">
                <button
                  onClick={() => {
                    stats.categories.forEach(cat => {
                      if (!enabledCategories.has(cat.category)) {
                        onToggleCategory(cat.category);
                      }
                    });
                  }}
                  className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  style={{ fontSize: '9px' }}
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    stats.categories.forEach(cat => {
                      if (enabledCategories.has(cat.category)) {
                        onToggleCategory(cat.category);
                      }
                    });
                  }}
                  className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  style={{ fontSize: '9px' }}
                >
                  Deselect All
                </button>
              </div>
              <div className="space-y-1">
                {stats.categories.slice(0, 10).map((cat) => {
                  const isEnabled = enabledCategories.has(cat.category);
                  return (
                    <button
                      key={cat.category}
                      onClick={() => onToggleCategory(cat.category)}
                      className={`w-full flex justify-between items-center rounded px-3 py-2 text-xs font-mono transition-colors ${
                        isEnabled
                          ? 'bg-cyan-600/30 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-600/40'
                          : 'bg-gray-800 text-gray-500 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className="uppercase tracking-wider">
                        {cat.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-cyan-500">
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
