import { useState, useEffect } from 'react';
import { fetchStats, fetchRelationships, fetchTagClusters } from './api';
import type { Stats, Relationship, TagCluster } from './types';
import GlobeView from './components/GlobeView';
import { Monitor, Smartphone, AlertTriangle, X } from 'lucide-react';

function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledClusterIds, setEnabledClusterIds] = useState<Set<number>>(new Set());
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [dismissedWarning, setDismissedWarning] = useState(false);

  // Check if mobile device
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || window.innerWidth < 768;
    
    // Check if user already dismissed the warning this session
    const dismissed = sessionStorage.getItem('mobileWarningDismissed');
    if (isMobile && !dismissed) {
      setShowMobileWarning(true);
    }
  }, []);

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
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-400 text-sm">Loading network data...</div>
          <div className="text-gray-600 text-xs mt-1">This may take a moment</div>
        </div>
      </div>
    );
  }

  const handleDismissWarning = () => {
    sessionStorage.setItem('mobileWarningDismissed', 'true');
    setShowMobileWarning(false);
    setDismissedWarning(true);
  };

  return (
    <>
      <GlobeView relationships={relationships} stats={stats} />
      
      {/* Mobile Warning Modal */}
      {showMobileWarning && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full border border-red-900/50 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-red-950/50 p-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-900/50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Mobile Device Detected</h2>
                  <p className="text-red-300/80 text-sm">Performance Warning</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                <Smartphone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    This application processes <span className="text-red-400 font-semibold">15,000+ relationships</span> and <span className="text-red-400 font-semibold">thousands of documents</span> with interactive visualizations.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                <Monitor className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    For the <span className="text-green-400 font-semibold">best experience</span>, we recommend using a <span className="text-white font-semibold">desktop or laptop computer</span> with a larger screen.
                  </p>
                </div>
              </div>

              <div className="bg-amber-950/30 border border-amber-900/30 rounded-lg p-3">
                <p className="text-amber-200/80 text-xs leading-relaxed">
                  Mobile devices may experience slower loading times, reduced interactivity, and potential crashes due to memory constraints.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-800 flex flex-col gap-2">
              <button
                onClick={handleDismissWarning}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
              >
                Continue Anyway
              </button>
              <p className="text-gray-600 text-xs text-center">
                This warning won't appear again this session
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
