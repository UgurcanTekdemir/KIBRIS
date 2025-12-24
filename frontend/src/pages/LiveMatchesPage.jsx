import React, { useMemo } from 'react';
import MatchCard from '../components/betting/MatchCard';
import { Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLiveMatches } from '../hooks/useMatches';

const LiveMatchesPage = () => {
  // Use StatPal API for live matches
  const { matches, loading, error, refetch } = useLiveMatches(1);
  
  // Sort matches: live first, then by date/time
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      // Live matches first
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      
      // Then sort by date, then by time
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [matches]);

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
              {loading ? 'Yükleniyor...' : `${sortedMatches.length} canlı maç bulundu`}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]"
          onClick={refetch}
          disabled={loading}
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Info bar - only show if no live matches */}
      {!loading && sortedMatches.length === 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="text-blue-500 font-medium">CANLI MAÇLAR</span>
            <span className="text-gray-400 text-sm ml-2">
              Şu anda devam eden canlı maç bulunmamaktadır.
            </span>
          </div>
        </div>
      )}

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
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {sortedMatches.map((match) => (
              <MatchCard key={match.id} match={match} showFullMarkets />
            ))}
          </div>

          {/* Empty State */}
          {sortedMatches.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <Zap size={40} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Şu anda canlı maç yok</h3>
              <p className="text-gray-500 mb-4">
                Devam eden canlı maç bulunmamaktadır.
              </p>
              <p className="text-gray-400 text-sm">
                Tüm maçları görmek için <a href="/matches" className="text-amber-500 hover:text-amber-400">Maçlar</a> sayfasını ziyaret edin.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LiveMatchesPage;
