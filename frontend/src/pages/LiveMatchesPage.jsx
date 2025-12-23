import React from 'react';
import MatchCard from '../components/betting/MatchCard';
import { Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLiveMatches } from '../hooks/useMatches';

const LiveMatchesPage = () => {
  const { matches, loading, error, refetch } = useLiveMatches(1);

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
              {loading ? 'Yükleniyor...' : `${matches.length} maç şu anda canlı`}
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

      {/* Live indicator bar */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-red-500 font-medium">CANLI YAYIN</span>
          <span className="text-gray-400 text-sm ml-2">
            Oranlar gerçek zamanlı güncelleniyor (30 saniyede bir otomatik yenileniyor)
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
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} showFullMarkets />
            ))}
          </div>

          {/* Empty State */}
          {matches.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <Zap size={40} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Şu anda canlı maç yok</h3>
              <p className="text-gray-500">Yakında başlayacak maçları kontrol edin</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LiveMatchesPage;
