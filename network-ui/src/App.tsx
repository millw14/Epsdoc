import { useState, useEffect } from 'react';
import { fetchStats, fetchRelationships, fetchTagClusters } from './api';
import type { Stats, Relationship, TagCluster } from './types';
import GlobeView from './components/GlobeView';

function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledClusterIds, setEnabledClusterIds] = useState<Set<number>>(new Set());
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        setError(null);
        const [clusters, statsData] = await Promise.all([
          fetchTagClusters(),
          fetchStats()
        ]);
        setEnabledClusterIds(new Set(clusters.map(c => c.id)));
        setStats(statsData);
        setEnabledCategories(new Set(statsData.categories.map(c => c.category)));
        setIsInitialized(true);
      } catch (err) {
        console.error('Init error:', err);
        setError('Cannot connect to server. Run: npx tsx api_server.ts');
        setLoading(false);
      }
    };
    init();
  }, []);

  // Load relationships
  useEffect(() => {
    if (!isInitialized) return;
    
    const load = async () => {
      setLoading(true);
      try {
        // Load more data to get locations
        const response = await fetchRelationships(
          15000,
          Array.from(enabledClusterIds),
          Array.from(enabledCategories),
          [1980, 2025],
          true,
          '',
          4
        );
        setRelationships(response.relationships);
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isInitialized, enabledClusterIds, enabledCategories]);

  if (error) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-400 text-lg mb-2">Connection Error</div>
          <div className="text-gray-500 text-sm mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-400 text-sm">Loading network data...</div>
          <div className="text-gray-600 text-xs mt-1">This may take a moment</div>
        </div>
      </div>
    );
  }

  return <GlobeView relationships={relationships} stats={stats} />;
}

export default App;
