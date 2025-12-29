import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trophy, Search, ArrowLeft, Globe, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLeagues } from '../hooks/useLeagues';
import { useMatches } from '../hooks/useMatches';

const LeaguesPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('all');

  // Fetch leagues using React Query hook (cached)
  const { leagues, loading, error } = useLeagues();

  // Fetch all matches (no league_id filter) to group by league and count matches
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { matches: allMatches, loading: matchesLoading, error: matchesError } = useMatches({
    date_from: today,
    date_to: sevenDaysLater,
    matchType: 1
  });

  // Group matches by league_id to count matches per league
  const matchesByLeague = useMemo(() => {
    if (!allMatches || !Array.isArray(allMatches)) {
      return new Map();
    }
    
    const grouped = new Map();
    
    allMatches.forEach(match => {
      // Get league ID and ensure it's a number for consistent comparison
      const matchLeagueId = match.leagueId || match.league_id || match.league?.id;
      if (matchLeagueId) {
        // Convert to number for consistent comparison
        const leagueId = typeof matchLeagueId === 'string' ? parseInt(matchLeagueId, 10) : matchLeagueId;
        if (!isNaN(leagueId)) {
          // Group matches by league_id
          if (!grouped.has(leagueId)) {
            grouped.set(leagueId, []);
          }
          grouped.get(leagueId).push(match);
        }
      }
    });
    
    return grouped;
  }, [allMatches]);

  // Get unique countries from leagues
  const countries = useMemo(() => {
    if (!Array.isArray(leagues)) return [];
    const countrySet = new Set();
    leagues.forEach(league => {
      if (league && league.country) {
        countrySet.add(league.country);
      }
    });
    return Array.from(countrySet).sort();
  }, [leagues]);

  // Filter leagues by search query and country
  const filteredLeagues = useMemo(() => {
    if (!Array.isArray(leagues)) return [];
    let filtered = leagues;

    // Filter by country
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(league => league.country === selectedCountry);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(league => {
        const name = (league.name || league.league_name || '').toLowerCase();
        const country = (league.country || '').toLowerCase();
        return name.includes(query) || country.includes(query);
      });
    }

    // Sort by name
    return filtered.sort((a, b) => {
      const nameA = (a.name || a.league_name || '').toLowerCase();
      const nameB = (b.name || b.league_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [leagues, searchQuery, selectedCountry]);

  // Get league flag emoji based on country
  const getCountryFlag = (country) => {
    if (!country) return '🏆';
    
    const countryLower = country.toLowerCase();
    
    const flagMap = {
      // Europe
      'turkey': '🇹🇷',
      'türkiye': '🇹🇷',
      'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'ingiltere': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'united kingdom': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'uk': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'spain': '🇪🇸',
      'ispanya': '🇪🇸',
      'italy': '🇮🇹',
      'italya': '🇮🇹',
      'germany': '🇩🇪',
      'almanya': '🇩🇪',
      'france': '🇫🇷',
      'fransa': '🇫🇷',
      'netherlands': '🇳🇱',
      'hollanda': '🇳🇱',
      'portugal': '🇵🇹',
      'portekiz': '🇵🇹',
      'belgium': '🇧🇪',
      'belçika': '🇧🇪',
      'austria': '🇦🇹',
      'avusturya': '🇦🇹',
      'denmark': '🇩🇰',
      'danimarka': '🇩🇰',
      'croatia': '🇭🇷',
      'hrvatska': '🇭🇷',
      'czech republic': '🇨🇿',
      'çek cumhuriyeti': '🇨🇿',
      'czechia': '🇨🇿',
      'bulgaria': '🇧🇬',
      'bulgaristan': '🇧🇬',
      // Americas
      'brazil': '🇧🇷',
      'brezilya': '🇧🇷',
      'argentina': '🇦🇷',
      'arjantin': '🇦🇷',
      'usa': '🇺🇸',
      'united states': '🇺🇸',
      // Asia
      'japan': '🇯🇵',
      'japonya': '🇯🇵',
      'south korea': '🇰🇷',
      'güney kore': '🇰🇷',
      // International
      'international': '🌍',
      'uefa': '🇪🇺',
      'world': '🌍',
    };

    for (const [key, flag] of Object.entries(flagMap)) {
      if (countryLower.includes(key)) {
        return flag;
      }
    }

    return '🏆';
  };

  const isLoading = loading || matchesLoading;

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
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Trophy size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Futbol Ligleri</h1>
            <p className="text-sm text-gray-400">
              {isLoading ? 'Yükleniyor...' : `${filteredLeagues.length} lig bulundu`}
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {(error || matchesError) && (
        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            {error || matchesError}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      {!isLoading && leagues.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search 
              size={18} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" 
            />
            <Input
              type="text"
              placeholder="Lig ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#0d1117] border-[#1e2736] text-white placeholder:text-gray-500 focus:border-amber-500/50 focus:ring-amber-500/20"
            />
          </div>

          {/* Country Filter */}
          {countries.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-400 flex items-center gap-2">
                <Globe size={16} />
                Ülke:
              </span>
              <button
                onClick={() => setSelectedCountry('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCountry === 'all'
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#1a2332] text-gray-400 hover:bg-[#2a3a4d] hover:text-white'
                }`}
              >
                Tümü
              </button>
              {countries.map((country) => (
                <button
                  key={country}
                  onClick={() => setSelectedCountry(country)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCountry === country
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#1a2332] text-gray-400 hover:bg-[#2a3a4d] hover:text-white'
                  }`}
                >
                  {getCountryFlag(country)} {country}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leagues Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-[#0d1117] border border-[#1e2736] rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4">
              <Skeleton className="w-full aspect-square rounded-lg bg-[#1a2332] mb-2" />
              <Skeleton className="h-3 w-full mb-1 bg-[#1a2332]" />
              <Skeleton className="h-2 w-2/3 bg-[#1a2332]" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {filteredLeagues.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
              {filteredLeagues.map((league) => {
                const leagueId = league.id || league.league_id;
                // Ensure leagueId is a number for consistent comparison
                const leagueIdNum = typeof leagueId === 'string' ? parseInt(leagueId, 10) : leagueId;
                const leagueName = league.name || league.league_name || 'Bilinmeyen Lig';
                const country = league.country || '';
                const leagueMatches = matchesByLeague.get(leagueIdNum) || [];
                const matchCount = leagueMatches.length;
                const flag = getCountryFlag(country);

                return (
                  <Link
                    key={leagueIdNum}
                    to={`/league/${leagueIdNum}`}
                    className="bg-[#0d1117] border border-[#1e2736] rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center hover:border-amber-500/50 hover:bg-[#1a2332] transition-all group"
                  >
                    {league.image_path ? (
                      <div className="w-full aspect-square flex items-center justify-center mb-0.5 sm:mb-1 md:mb-2 overflow-hidden">
                        <img 
                          src={league.image_path} 
                          alt={leagueName}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = `<span class="text-xl sm:text-2xl md:text-3xl">${flag}</span>`;
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-xl sm:text-2xl md:text-3xl block mb-0.5 sm:mb-1 md:mb-2">{flag}</span>
                    )}
                    <p className="text-white font-medium text-[10px] sm:text-xs md:text-sm mb-0.5 truncate">{leagueName}</p>
                    {matchCount > 0 && (
                      <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 font-semibold">{matchCount} maç</p>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <Trophy size={40} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery || selectedCountry !== 'all' 
                  ? 'Lig bulunamadı' 
                  : 'Henüz lig bulunmuyor'}
              </h3>
              <p className="text-gray-500">
                {searchQuery || selectedCountry !== 'all'
                  ? 'Arama kriterlerinize uygun lig bulunamadı.'
                  : 'Lig verisi alınamadı.'}
              </p>
              {(searchQuery || selectedCountry !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCountry('all');
                  }}
                  className="mt-4 border-[#2a3a4d] text-gray-400 hover:text-white"
                >
                  Filtreleri Temizle
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaguesPage;
