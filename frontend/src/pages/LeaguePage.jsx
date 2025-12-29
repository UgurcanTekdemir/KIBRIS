import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import MatchCard from '../components/betting/MatchCard';
import { ArrowLeft, Trophy, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatches } from '../hooks/useMatches';
import { getLeagues } from '../services/football';

// Helper function to get country flag emoji
const getCountryFlag = (country) => {
  if (!country) return '🏆';
  
  const countryLower = country.toLowerCase();
  
  const flagMap = {
    'turkey': '🇹🇷', 'türkiye': '🇹🇷',
    'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'ingiltere': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'united kingdom': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'uk': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'spain': '🇪🇸', 'ispanya': '🇪🇸',
    'italy': '🇮🇹', 'italya': '🇮🇹',
    'germany': '🇩🇪', 'almanya': '🇩🇪',
    'france': '🇫🇷', 'fransa': '🇫🇷',
    'netherlands': '🇳🇱', 'hollanda': '🇳🇱',
    'portugal': '🇵🇹', 'portekiz': '🇵🇹',
    'belgium': '🇧🇪', 'belçika': '🇧🇪',
    'austria': '🇦🇹', 'avusturya': '🇦🇹',
    'denmark': '🇩🇰', 'danimarka': '🇩🇰',
    'croatia': '🇭🇷', 'hrvatska': '🇭🇷',
    'czech republic': '🇨🇿', 'çek cumhuriyeti': '🇨🇿', 'czechia': '🇨🇿',
    'bulgaria': '🇧🇬', 'bulgaristan': '🇧🇬',
    'brazil': '🇧🇷', 'brezilya': '🇧🇷',
    'argentina': '🇦🇷', 'arjantin': '🇦🇷',
    'international': '🌍', 'uefa': '🇪🇺', 'world': '🌍',
  };

  for (const [key, flag] of Object.entries(flagMap)) {
    if (countryLower.includes(key)) {
      return flag;
    }
  }

  return '🏆';
};

const LeaguePage = () => {
  const { id } = useParams();
  const leagueId = parseInt(id, 10);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [leagueLoading, setLeagueLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  // Calculate 7 days (1 week) from today
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Fetch league info from API
  useEffect(() => {
    const fetchLeagueInfo = async () => {
      try {
        setLeagueLoading(true);
        const response = await getLeagues();
        
        // Handle response format
        let leaguesData = [];
        if (response && typeof response === 'object') {
          if (response.data && Array.isArray(response.data)) {
            leaguesData = response.data;
          } else if (response.success && response.data && Array.isArray(response.data)) {
            leaguesData = response.data;
          } else if (Array.isArray(response)) {
            leaguesData = response;
          }
        }
        
        // Find the league by ID
        const league = leaguesData.find(l => l.id === leagueId);
        
        if (league) {
          // Extract country name
          let countryName = '';
          if (league.country) {
            if (typeof league.country === 'string') {
              countryName = league.country;
            } else if (league.country.name) {
              countryName = league.country.name;
            } else if (league.country.data && league.country.data.name) {
              countryName = league.country.data.name;
            }
          }
          
          setLeagueInfo({
            id: league.id,
            name: league.name || 'Bilinmeyen Lig',
            country: countryName,
            flag: getCountryFlag(countryName),
            image_path: league.image_path || null,
          });
        }
      } catch (err) {
        console.error('Error fetching league info:', err);
      } finally {
        setLeagueLoading(false);
      }
    };

    if (leagueId) {
      fetchLeagueInfo();
    }
  }, [leagueId]);

  // Fetch matches filtered by league_id
  const { matches: allMatches, loading, error, refetch } = useMatches({ 
    league_id: leagueId,
    matchType: 1 
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
  
  // Show loading until matches with odds are loaded
  const isLoading = loading || !hasMatchesWithOdds;

  // Filter matches by league_id and date (only show upcoming matches within 7 days, exclude finished)
  const leagueMatches = useMemo(() => {
    if (!allMatches || !Array.isArray(allMatches)) return [];
    
    return allMatches
      .filter(match => {
        // Match by league_id (from backend filtering)
        const matchLeagueId = match.leagueId || match.league_id;
        if (matchLeagueId !== leagueId) return false;
        
        // Exclude finished matches
        const status = (match.status || '').toUpperCase();
        const isFinished = status === 'FT' || status === 'FINISHED' || status === 'CANCELED' || status === 'CANCELLED';
        if (isFinished) return false;
        
        // Exclude postponed matches
        if (status === 'POSTPONED') return false;
        
        // Only show matches within 7 days (1 week) from today
        const matchDate = match.date || '';
        const isWithin7Days = matchDate >= today && matchDate <= sevenDaysLater;
        
        return isWithin7Days;
      })
      .sort((a, b) => {
        // Sort by date, then by time
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return (a.time || '').localeCompare(b.time || '');
      });
  }, [allMatches, leagueId, today, sevenDaysLater]);

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

  // Show loading state while fetching league info
  if (leagueLoading || (!leagueInfo && !error)) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-10 h-10 bg-[#1a2332]" />
          <div>
            <Skeleton className="h-8 w-48 mb-2 bg-[#1a2332]" />
            <Skeleton className="h-4 w-32 bg-[#1a2332]" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
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
          ))}
        </div>
      </div>
    );
  }

  // Show error if league not found
  if (!leagueInfo && !leagueLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            Lig bulunamadı. Geçerli bir lig ID'si girin.
          </AlertDescription>
        </Alert>
        <Link to="/leagues">
          <Button variant="outline" className="border-[#2a3a4d] text-gray-400 hover:text-white">
            <ArrowLeft size={16} className="mr-2" />
            Liglere Dön
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/leagues">
          <Button 
            variant="outline" 
            className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]"
          >
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          {leagueInfo.image_path ? (
            <div className="w-12 h-12 rounded-xl bg-[#1a2332] flex items-center justify-center overflow-hidden">
              <img 
                src={leagueInfo.image_path} 
                alt={leagueInfo.name}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = `<div class="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center"><svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg></div>`;
                }}
              />
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
              {isLoading ? 'Oranlar yükleniyor...' : `${leagueMatches.length} maç bulundu`}
              {leagueInfo.country && ` • ${leagueInfo.country}`}
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
      {isLoading ? (
        <div className="md:grid md:grid-cols-2 md:gap-4 flex gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-2 md:mx-0 px-2 md:px-0">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="min-w-[85%] md:min-w-0 flex-shrink-0">
              <MatchCardSkeleton />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="md:grid md:grid-cols-2 md:gap-4 flex gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-2 md:mx-0 px-2 md:px-0">
            {leagueMatches.map((match, idx) => (
              <div key={match.id || `league-${idx}-${match.homeTeam}-${match.awayTeam}`} className="min-w-[85%] md:min-w-0 flex-shrink-0">
                <MatchCard match={match} />
              </div>
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

