import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import MatchCard from '../components/betting/MatchCard';
import { ArrowLeft, Trophy, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatches } from '../hooks/useMatches';
import { matchAPI } from '../services/api';

const LeaguePage = () => {
  const { id } = useParams();
  const leagueId = parseInt(id, 10);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [loadingLeague, setLoadingLeague] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  // Calculate 7 days (1 week) from today
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

  // Fetch all matches and filter by league
  const { matches: allMatches, loading, error, refetch } = useMatches({ matchType: 1 });

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

  // Filter matches by league_id and date (only show upcoming matches within 7 days, exclude finished)
  const leagueMatches = useMemo(() => {
    if (!leagueInfo || !allMatches) {
      if (process.env.NODE_ENV === 'development') {
        console.log('LeaguePage: No leagueInfo or allMatches', {
          hasLeagueInfo: !!leagueInfo,
          hasAllMatches: !!allMatches,
          allMatchesCount: allMatches?.length || 0
        });
      }
      return [];
    }
    
    // Normalize date format for comparison (DD.MM.YYYY to YYYY-MM-DD)
    const normalizeDate = (dateStr) => {
      if (!dateStr) return '';
      // If already in YYYY-MM-DD format, return as is
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        return dateStr;
      }
      // If in DD.MM.YYYY format, convert to YYYY-MM-DD
      if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}/)) {
        const [day, month, year] = dateStr.split('.');
        return `${year}-${month}-${day}`;
      }
      return dateStr;
    };
    
    const filtered = allMatches
      .filter(match => {
        // Match by league_id first (most accurate) - handle both string and number
        const matchLeagueId = match.leagueId;
        const leagueIdNum = parseInt(leagueInfo.id, 10);
        const matchesLeagueId = matchLeagueId === leagueInfo.id || 
                                matchLeagueId === leagueIdNum ||
                                String(matchLeagueId) === String(leagueInfo.id);
        
        // Match by league name (case-insensitive) as fallback
        const matchLeague = (match.league || '').toLowerCase();
        const leagueNameLower = (leagueInfo.name || '').toLowerCase();
        const matchesLeagueName = leagueNameLower && (
          matchLeague === leagueNameLower || 
          matchLeague.includes(leagueNameLower) ||
          leagueNameLower.includes(matchLeague)
        );
        
        if (!matchesLeagueId && !matchesLeagueName) {
          return false;
        }
        
        // Exclude finished matches
        const status = (match.status || '').toUpperCase();
        const isFinished = match.isFinished || 
                          status === 'FT' || 
                          status === 'FINISHED' || 
                          status === 'CANCELED' || 
                          status === 'CANCELLED';
        if (isFinished) return false;
        
        // Exclude postponed matches
        if (match.isPostponed || status === 'POSTPONED') return false;
        
        // Only show matches within 7 days (1 week) from today
        // Normalize date format for comparison
        const matchDate = normalizeDate(match.date || '');
        const isWithin7Days = matchDate && matchDate >= today && matchDate <= sevenDaysLater;
        
        return isWithin7Days;
      })
      .sort((a, b) => {
        // Sort by date, then by time
        const dateA = normalizeDate(a.date || '');
        const dateB = normalizeDate(b.date || '');
        if (dateA !== dateB) {
          return dateA.localeCompare(dateB);
        }
        return (a.time || '').localeCompare(b.time || '');
      });
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('LeaguePage: Filtering matches', {
        leagueInfo: {
          id: leagueInfo.id,
          name: leagueInfo.name
        },
        allMatchesCount: allMatches.length,
        filteredCount: filtered.length,
        sampleMatch: allMatches[0] ? {
          leagueId: allMatches[0].leagueId,
          league: allMatches[0].league,
          date: allMatches[0].date,
          status: allMatches[0].status
        } : null
      });
    }
    
    return filtered;
  }, [allMatches, leagueInfo, today, sevenDaysLater]);

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

