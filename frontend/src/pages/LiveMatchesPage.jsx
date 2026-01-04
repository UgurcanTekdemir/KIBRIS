import React, { useMemo } from 'react';
import LiveMatchCard from '../components/betting/LiveMatchCard';
import { Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLiveMatches } from '../hooks/useMatches';

const LiveMatchesPage = () => {
  // Get only live matches (isLive === true)
  const { matches, loading, error, refetch } = useLiveMatches(1);
  
  // Sort matches by minute (highest minute first) to prevent constant reordering
  // This ensures the most advanced match (highest minute) appears at the top
  const sortedMatches = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    
    return [...matches].sort((a, b) => {
      // Extract minute values, handling both number and string formats
      const getMinute = (match) => {
        if (match.minute === null || match.minute === undefined) return -1;
        if (typeof match.minute === 'number') return match.minute;
        if (typeof match.minute === 'string') {
          // Handle "45+3" format - extract base minute
          const baseMinute = parseInt(match.minute.split('+')[0], 10);
          if (!isNaN(baseMinute)) return baseMinute;
        }
        return -1;
      };
      
      const minuteA = getMinute(a);
      const minuteB = getMinute(b);
      
      // Sort descending: highest minute first
      if (minuteB !== minuteA) {
        return minuteB - minuteA;
      }
      
      // If minutes are equal, maintain stable order by ID
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [matches]);

  // Only show loading during initial fetch, not when there are no matches
  const isLoading = loading;

  // Loading skeleton component
  const MatchCardSkeleton = () => (
    <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-[#0a0e14] border-b border-[#1e2736]">
        <Skeleton className="h-4 w-32 bg-[#1a2332]" />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-full bg-[#1a2332]" />
        <Skeleton className="h-6 w-full bg-[#1a2332]" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1 bg-[#1a2332]" />
          <Skeleton className="h-12 flex-1 bg-[#1a2332]" />
          <Skeleton className="h-12 flex-1 bg-[#1a2332]" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Zap size={24} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Canlı Maçlar
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </h1>
            <p className="text-sm text-gray-400">
              {isLoading 
                ? 'Veriler çekiliyor lütfen bekleyiniz...' 
                : sortedMatches.length === 0 
                  ? 'Canlı maç yok'
                  : `${sortedMatches.length} canlı maç bulundu`}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]"
          onClick={refetch}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Info bar */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-red-500" />
          <span className="text-red-500 font-medium">CANLI MAÇLAR</span>
          <span className="text-gray-400 text-sm ml-2">
            Şu anda oynanan canlı maçlar, skorlar, olaylar ve istatistikler gösterilmektedir. Veriler gerçek zamanlı güncellenir.
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            {error}
            <Button
              variant="link"
              onClick={refetch}
              className="ml-2 text-amber-500 hover:text-amber-400 p-0 h-auto"
            >
              Tekrar dene
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Matches Grid */}
      {isLoading ? (
        <>
          {/* Loading Message */}
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
              <RefreshCw size={40} className="text-amber-500 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Veriler çekiliyor lütfen bekleyiniz</h3>
            <p className="text-gray-500 mb-4">
              Canlı maçlar ve oranlar yükleniyor...
            </p>
          </div>
          {/* Loading Skeletons */}
          <div className="md:grid md:grid-cols-2 md:gap-4 flex gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-2 md:mx-0 px-2 md:px-0">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="min-w-[85%] md:min-w-0 flex-shrink-0">
                <MatchCardSkeleton />
              </div>
            ))}
          </div>
        </>
      ) : sortedMatches.length === 0 ? (
        /* Empty State - No Live Matches */
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
            <Zap size={40} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Canlı Maç Yok</h3>
          <p className="text-gray-500 mb-4">
            Şu anda oynanan canlı maç bulunmamaktadır.
          </p>
          <p className="text-gray-400 text-sm">
            Tüm maçları görmek için <a href="/matches" className="text-amber-500 hover:text-amber-400">Maçlar</a> sayfasını ziyaret edin.
          </p>
        </div>
      ) : (
        /* Matches List */
        <div className="md:grid md:grid-cols-2 md:gap-4 flex gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-2 md:mx-0 px-2 md:px-0">
          {sortedMatches.map((match, idx) => (
            <div key={match.id || `live-${idx}-${match.homeTeam}-${match.awayTeam}`} className="min-w-[85%] md:min-w-0 flex-shrink-0">
              <LiveMatchCard match={match} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveMatchesPage;
