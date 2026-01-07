import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import MatchCard from '../components/betting/MatchCard';
import { ArrowLeft, Trophy, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatches } from '../hooks/useMatches';
import { matchAPI } from '../services/api';
import { getDateFromToday, normalizeDateForComparison, getMatchDate, isMatchFinished, isMatchPostponed } from '../utils/dateHelpers';
import { sortMatchesByDateTime } from '../utils/matchHelpers';

const LeaguePage = () => {
  const { id } = useParams();
  const leagueId = parseInt(id, 10);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [loadingLeague, setLoadingLeague] = useState(true);

  // Fetch league info from backend
  useEffect(() => {
    async function fetchLeagueInfo() {
      try {
        setLoadingLeague(true);
        const leaguesData = await matchAPI.getLeagues();
        
        // Find league by ID
        const league = leaguesData.find(l => {
          const id = l.id || l.league_id || l.main_id;
          return id === leagueId;
        });
        
        if (league) {
          // Handle nested country structure
          const countryName = league.country?.name || 
                             (typeof league.country === 'string' ? league.country : '') ||
                             league.country_name || '';
          
          // Handle image_path - check multiple possible fields
          const imagePath = league.image_path || 
                           league.logo || 
                           league.image || 
                           league.logo_path ||
                           null;
          
          setLeagueInfo({
            id: league.id || league.league_id || league.main_id,
            name: league.name || league.league_name || 'Bilinmeyen Lig',
            country: countryName,
            flag: getCountryFlag(countryName),
            image_path: imagePath,
            season: league.current_season?.name || league.season || '',
            active: league.active !== undefined ? league.active : true,
          });
        } else {
          setLeagueInfo(null);
        }
      } catch (error) {
        console.error('Error fetching league info:', error);
        setLeagueInfo(null);
      } finally {
        setLoadingLeague(false);
      }
    }
    
    if (leagueId) {
      fetchLeagueInfo();
    }
  }, [leagueId]);

  // Helper function to get country flag emoji
  function getCountryFlag(country) {
    const flagMap = {
      'Türkiye': '🇹🇷',
      'Turkey': '🇹🇷',
      'İngiltere': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'İspanya': '🇪🇸',
      'Spain': '🇪🇸',
      'İtalya': '🇮🇹',
      'Italy': '🇮🇹',
      'Almanya': '🇩🇪',
      'Germany': '🇩🇪',
      'Fransa': '🇫🇷',
      'France': '🇫🇷',
    };
    return flagMap[country] || '🏆';
  }

  // Fetch matches filtered by league_id from backend (today to 4 days future)
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const fourDaysLater = useMemo(() => getDateFromToday(4), []);
  
  const { matches: allMatches, loading, error, refetch } = useMatches({
    date_from: today,
    date_to: fourDaysLater,
    league_id: leagueId
  });

  // Check if matches have loaded with odds (markets)
  const hasMatchesWithOdds = useMemo(() => {
    if (loading) return false;
    if (!allMatches || allMatches.length === 0) return false;
    // Check if at least one match has markets with valid odds
    return allMatches.some(match => {
      if (!match.markets || !Array.isArray(match.markets)) return false;
      return match.markets.some(market => {
        if (!market.options || !Array.isArray(market.options)) return false;
        return market.options.some(opt => {
          const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
          return oddsValue > 0;
        });
      });
    });
  }, [allMatches, loading]);
  
  // Show loading until league info is loaded, but don't wait for odds
  // (matches can be shown even without odds)
  const isLoading = loadingLeague || loading;

  // Filter and sort matches (backend already filters by league_id)
  const leagueMatches = useMemo(() => {
    if (!allMatches || allMatches.length === 0) {
      return [];
    }
    
    // Backend already filters by league_id, so we just filter out finished/postponed matches
    // and matches outside date range
    const filtered = allMatches.filter(match => {
      // Exclude finished/postponed matches (but keep live matches)
      if (isMatchFinished(match) || isMatchPostponed(match)) {
        // Keep live matches even if they might be marked as finished
        if (!match.isLive) {
          return false;
        }
      }
      
      // Exclude matches outside the date range (today to 4 days later)
      const matchDate = normalizeDateForComparison(getMatchDate(match));
      if (matchDate && (matchDate < today || matchDate > fourDaysLater)) {
        return false;
      }
      
      return true;
    });
    
    // Sort using helper function
    return sortMatchesByDateTime(filtered);
  }, [allMatches, today, fourDaysLater]);

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

  if (loadingLeague) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-12 w-12 rounded-xl bg-[#1a2332]" />
          <div>
            <Skeleton className="h-8 w-48 mb-2 bg-[#1a2332]" />
            <Skeleton className="h-4 w-32 bg-[#1a2332]" />
          </div>
        </div>
      </div>
    );
  }

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/leagues">
            <Button 
              variant="outline" 
              className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]"
            >
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {/* League Logo or Flag */}
            {leagueInfo.image_path ? (
              <div className="w-12 h-12 rounded-xl bg-[#1a2332] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2736]">
                <img 
                  src={leagueInfo.image_path} 
                  alt={leagueInfo.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling?.classList.remove('hidden');
                  }}
                />
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center hidden">
                  <Trophy size={24} className="text-amber-500" />
                </div>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Trophy size={24} className="text-amber-500" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">{leagueInfo.flag}</span>
                {leagueInfo.name}
              </h1>
              <p className="text-sm text-gray-400">
                {leagueInfo.country && `${leagueInfo.country} • `}
                {isLoading ? 'Oranlar yükleniyor...' : `${leagueMatches.length} maç bulundu`}
              </p>
            </div>
          </div>
        </div>
        <Link to={`/league-standings/${leagueId}`}>
          <Button 
            variant="outline" 
            className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500"
          >
            <Calendar size={16} className="mr-2" />
            Puan Durumu
          </Button>
        </Link>
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
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {leagueMatches.map((match, idx) => (
              <MatchCard key={match.id || `league-${idx}-${match.homeTeam}-${match.awayTeam}`} match={match} />
            ))}
          </div>

          {/* Empty State */}
          {leagueMatches.length === 0 && !isLoading && (
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

