import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import MatchCard from '../components/betting/MatchCard';
import { ArrowLeft, Trophy, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { statpalAPI } from '../services/api';
import { mapApiMatchesToInternal } from '../utils/matchMapper';

// Fallback League ID to sport_key mapping (for backward compatibility)
const LEAGUE_MAP = {
  1: { sport_key: 'soccer_turkey_super_league', name: 'Süper Lig', flag: '🇹🇷', country: 'Türkiye' },
  2: { sport_key: 'soccer_epl', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'İngiltere' },
  3: { sport_key: 'soccer_spain_la_liga', name: 'La Liga', flag: '🇪🇸', country: 'İspanya' },
  4: { sport_key: 'soccer_italy_serie_a', name: 'Serie A', flag: '🇮🇹', country: 'İtalya' },
  5: { sport_key: 'soccer_germany_bundesliga', name: 'Bundesliga', flag: '🇩🇪', country: 'Almanya' },
  6: { sport_key: 'soccer_france_ligue_one', name: 'Ligue 1', flag: '🇫🇷', country: 'Fransa' },
};

// Get league flag emoji based on country
const getCountryFlag = (country) => {
  if (!country) return '🏆';
  
  const flagMap = {
    'Turkey': '🇹🇷',
    'Türkiye': '🇹🇷',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'İngiltere': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Spain': '🇪🇸',
    'İspanya': '🇪🇸',
    'Italy': '🇮🇹',
    'İtalya': '🇮🇹',
    'Germany': '🇩🇪',
    'Almanya': '🇩🇪',
    'France': '🇫🇷',
    'Fransa': '🇫🇷',
    'Netherlands': '🇳🇱',
    'Hollanda': '🇳🇱',
    'Portugal': '🇵🇹',
    'Portekiz': '🇵🇹',
  };

  for (const [key, flag] of Object.entries(flagMap)) {
    if (country.toLowerCase().includes(key.toLowerCase())) {
      return flag;
    }
  }

  return '🏆';
};

const LeaguePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const leagueId = parseInt(id, 10);
  
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [leagueMatches, setLeagueMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch league info and matches from StatPal API
  useEffect(() => {
    const fetchLeagueData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, try to get league info from StatPal API
        const allLeagues = await statpalAPI.getLeagues();
        const league = allLeagues.find(l => {
          const lid = l.id || l.league_id || l.main_id;
          return lid === leagueId || lid === id;
        });

        if (league) {
          // Found league in StatPal API
          const leagueName = league.name || league.league_name || 'Bilinmeyen Lig';
          const country = league.country || '';
          const flag = getCountryFlag(country);
          
          setLeagueInfo({
            id: league.id || league.league_id || league.main_id,
            name: leagueName,
            country: country,
            flag: flag,
            season: league.season || '',
          });

          // Fetch matches for this league
          try {
            const matches = await statpalAPI.getLeagueMatches(leagueId);
            const mappedMatches = mapApiMatchesToInternal(matches || []);
            setLeagueMatches(mappedMatches);
          } catch (matchError) {
            console.error('Error fetching league matches:', matchError);
            // Continue without matches
            setLeagueMatches([]);
          }
        } else {
          // Fallback to hardcoded league map
          const fallbackLeague = LEAGUE_MAP[leagueId];
          if (fallbackLeague) {
            setLeagueInfo(fallbackLeague);
            // For fallback leagues, we can't fetch from StatPal, so show empty
            setLeagueMatches([]);
          } else {
            setError('Lig bulunamadı');
          }
        }
      } catch (err) {
        console.error('Error fetching league data:', err);
        setError(err.message || 'Lig bilgileri yüklenirken bir hata oluştu');
        
        // Fallback to hardcoded league map
        const fallbackLeague = LEAGUE_MAP[leagueId];
        if (fallbackLeague) {
          setLeagueInfo(fallbackLeague);
          setLeagueMatches([]);
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchLeagueData();
    }
  }, [id, leagueId]);

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

  if (!loading && !leagueInfo) {
    return (
      <div className="max-w-6xl mx-auto">
        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            {error || 'Lig bulunamadı. Geçerli bir lig ID\'si girin.'}
          </AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="border-[#2a3a4d] text-gray-400 hover:text-white"
          >
            <ArrowLeft size={16} className="mr-2" />
            Geri
          </Button>
          <Link to="/leagues">
            <Button variant="outline" className="border-[#2a3a4d] text-gray-400 hover:text-white">
              Tüm Ligler
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        {leagueInfo && (
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
                {leagueInfo.country && ` • ${leagueInfo.country}`}
                {leagueInfo.season && ` • ${leagueInfo.season}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && !loading && (
        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            {error}
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
          {leagueMatches.length === 0 && !loading && leagueInfo && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <Trophy size={40} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {leagueInfo.name} için maç bulunamadı
              </h3>
              <p className="text-gray-500 mb-4">
                Bu lig için şu anda maç bulunmamaktadır.
              </p>
              <Link to="/leagues">
                <Button variant="outline" className="border-[#2a3a4d] text-gray-400 hover:text-white">
                  Tüm Ligleri Gör
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaguePage;

