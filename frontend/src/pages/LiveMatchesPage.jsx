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

  // Check if matches have loaded with odds (markets)
  const hasMatchesWithOdds = useMemo(() => {
    if (loading) return false;
    if (!matches || matches.length === 0) return false;
    // Check if at least one match has markets with valid odds
    return matches.some(match => {
      if (!match.markets || !Array.isArray(match.markets)) return false;
      return match.markets.some(market => {
        if (!market.options || !Array.isArray(market.options)) return false;
        return market.options.some(opt => {
          const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
          return oddsValue > 0;
        });
      });
    });
  }, [matches, loading]);
  
  // Show loading until matches with odds are loaded
  const isLoading = loading || !hasMatchesWithOdds;

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
                : matches.length === 0 
                  ? 'Şu an canlı maç bulunmamaktadır'
                  : `${matches.length} canlı maç bulundu`}
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
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        </>
      ) : matches.length === 0 ? (
        /* Empty State - No Live Matches */
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
            <Zap size={40} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Şu an canlı maç bulunmamaktadır</h3>
          <p className="text-gray-500 mb-4">
            Şu anda oynanan canlı maç bulunmamaktadır.
          </p>
          <p className="text-gray-400 text-sm">
            Tüm maçları görmek için <a href="/matches" className="text-amber-500 hover:text-amber-400">Maçlar</a> sayfasını ziyaret edin.
          </p>
        </div>
      ) : (
        /* Matches List */
        <div className="grid gap-4 md:grid-cols-2">
          {matches.map((match, idx) => (
            <LiveMatchCard key={match.id || `live-${idx}-${match.homeTeam}-${match.awayTeam}`} match={match} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveMatchesPage;
