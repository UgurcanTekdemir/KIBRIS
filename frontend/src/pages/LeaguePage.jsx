import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import MatchCard from '../components/betting/MatchCard';
import { ArrowLeft, Trophy, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatches } from '../hooks/useMatches';

// League ID to sport_key mapping
const LEAGUE_MAP = {
  1: { sport_key: 'soccer_turkey_super_league', name: 'Süper Lig', flag: '🇹🇷', country: 'Türkiye' },
  2: { sport_key: 'soccer_epl', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'İngiltere' },
  3: { sport_key: 'soccer_spain_la_liga', name: 'La Liga', flag: '🇪🇸', country: 'İspanya' },
  4: { sport_key: 'soccer_italy_serie_a', name: 'Serie A', flag: '🇮🇹', country: 'İtalya' },
  5: { sport_key: 'soccer_germany_bundesliga', name: 'Bundesliga', flag: '🇩🇪', country: 'Almanya' },
  6: { sport_key: 'soccer_france_ligue_one', name: 'Ligue 1', flag: '🇫🇷', country: 'Fransa' },
};

const LeaguePage = () => {
  const { id } = useParams();
  const leagueId = parseInt(id, 10);
  const leagueInfo = LEAGUE_MAP[leagueId];

  // Fetch all matches and filter by league
  const { matches: allMatches, loading, error, refetch } = useMatches({ matchType: 1 });

  // Filter matches by league sport_key
  const leagueMatches = useMemo(() => {
    if (!leagueInfo || !allMatches) return [];
    
    return allMatches
      .filter(match => {
        // Match by sport_key first (most accurate)
        if (match.sportKey === leagueInfo.sport_key) {
          return true;
        }
        // Fallback: match by league name
        const matchLeague = match.league?.toLowerCase() || '';
        const targetLeague = leagueInfo.name.toLowerCase();
        return matchLeague.includes(targetLeague);
      })
      .sort((a, b) => {
        // Sort by date, then by time
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return (a.time || '').localeCompare(b.time || '');
      });
  }, [allMatches, leagueInfo]);

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

  if (!leagueInfo) {
    return (
      <div className="max-w-6xl mx-auto">
        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            Lig bulunamadı. Geçerli bir lig ID'si girin.
          </AlertDescription>
        </Alert>
        <Link to="/">
          <Button variant="outline" className="border-[#2a3a4d] text-gray-400 hover:text-white">
            <ArrowLeft size={16} className="mr-2" />
            Ana Sayfaya Dön
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/">
          <Button 
            variant="outline" 
            className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]"
          >
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Trophy size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">{leagueInfo.flag}</span>
              {leagueInfo.name}
            </h1>
            <p className="text-sm text-gray-400">
              {loading ? 'Yükleniyor...' : `${leagueMatches.length} maç bulundu`}
            </p>
          </div>
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
          {[...Array(6)].map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {leagueMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>

          {/* Empty State */}
          {leagueMatches.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <Trophy size={40} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {leagueInfo.name} için maç bulunamadı
              </h3>
              <p className="text-gray-500">
                Bu lig için şu anda maç bulunmamaktadır.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaguePage;

