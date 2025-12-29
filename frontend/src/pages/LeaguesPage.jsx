import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Search, ArrowLeft, Globe, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { getLeagues } from '../services/football';
import { useMatches } from '../hooks/useMatches';
import MatchCard from '../components/betting/MatchCard';

const LeaguesPage = () => {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('all');

  // Fetch all matches (no league_id filter) to group by league
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { matches: allMatches, loading: matchesLoading, error: matchesError } = useMatches({
    date_from: today,
    date_to: sevenDaysLater,
    matchType: 1
  });

  // Fetch leagues from API
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get leagues from API
        const response = await getLeagues();
        
        // Handle response format (could be { data: [...], success: true } or direct array)
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
        
        // Transform leagues data to match our format
        const transformedLeagues = leaguesData.map(league => {
          // Extract country name from nested structure
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
          
          // Extract season info if available
          let season = '';
          if (league.current_season) {
            if (typeof league.current_season === 'object') {
              const seasonData = league.current_season.data || league.current_season;
              if (seasonData && seasonData.name) {
                season = seasonData.name;
              } else if (seasonData && seasonData.year) {
                season = seasonData.year.toString();
              }
            }
          }
          
          return {
            id: league.id,
            league_id: league.id,
            name: league.name || '',
            league_name: league.name || '',
            country: countryName,
            image_path: league.image_path || null,
            short_code: league.short_code || null,
            type: league.type || '',
            sub_type: league.sub_type || '',
            active: league.active !== false, // Default to true if not specified
            season: season,
            last_played_at: league.last_played_at || null,
          };
        }).filter(league => league.active); // Only show active leagues
        
        setLeagues(transformedLeagues);
      } catch (err) {
        console.error('Error fetching leagues:', err);
        setError(err.message || 'Ligler yüklenirken bir hata oluştu');
        setLeagues([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, []);

  // Group matches by league_id and extract league info from matches
  const { matchesByLeague, leaguesFromMatches } = useMemo(() => {
    if (!allMatches || !Array.isArray(allMatches)) {
      return { matchesByLeague: new Map(), leaguesFromMatches: new Map() };
    }
    
    const grouped = new Map();
    const leaguesMap = new Map(); // Store league info extracted from matches
    
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
          
          // Extract league info from match if not already stored
          if (!leaguesMap.has(leagueId)) {
            const leagueName = match.league || match.league_name || match.leagueName || '';
            const leagueLogo = match.leagueLogo || match.league_logo || null;
            const country = match.country || '';
            
            if (leagueName) {
              leaguesMap.set(leagueId, {
                id: leagueId,
                league_id: leagueId,
                name: leagueName,
                league_name: leagueName,
                country: country,
                image_path: leagueLogo,
                fromMatches: true, // Flag to indicate this league was extracted from matches
              });
            }
          }
        }
      }
    });
    
    // Sort matches by date and time within each league
    grouped.forEach((matches, leagueId) => {
      matches.sort((a, b) => {
        // Sort by date first
        if (a.date !== b.date) {
          return (a.date || '').localeCompare(b.date || '');
        }
        // Then by time
        return (a.time || '').localeCompare(b.time || '');
      });
    });
    
    return { matchesByLeague: grouped, leaguesFromMatches: leaguesMap };
  }, [allMatches]);

  // Merge leagues from API with leagues extracted from matches
  const mergedLeagues = useMemo(() => {
    if (!Array.isArray(leagues)) return [];
    
    // Create a map of leagues from API (by id)
    const leaguesMap = new Map();
    leagues.forEach(league => {
      const leagueId = typeof league.id === 'string' ? parseInt(league.id, 10) : league.id;
      if (!isNaN(leagueId)) {
        leaguesMap.set(leagueId, league);
      }
    });
    
    // Add leagues from matches that don't exist in API leagues
    leaguesFromMatches.forEach((leagueFromMatch, leagueId) => {
      if (!leaguesMap.has(leagueId)) {
        leaguesMap.set(leagueId, leagueFromMatch);
      } else {
        // If league exists in API but missing some info from matches, merge them
        const existingLeague = leaguesMap.get(leagueId);
        if (!existingLeague.image_path && leagueFromMatch.image_path) {
          existingLeague.image_path = leagueFromMatch.image_path;
        }
        if (!existingLeague.country && leagueFromMatch.country) {
          existingLeague.country = leagueFromMatch.country;
        }
      }
    });
    
    return Array.from(leaguesMap.values());
  }, [leagues, leaguesFromMatches]);

  // Get unique countries from merged leagues
  const countries = useMemo(() => {
    if (!Array.isArray(mergedLeagues)) return [];
    const countrySet = new Set();
    mergedLeagues.forEach(league => {
      if (league && league.country) {
        countrySet.add(league.country);
      }
    });
    return Array.from(countrySet).sort();
  }, [mergedLeagues]);

  // Filter leagues by search query and country
  const filteredLeagues = useMemo(() => {
    if (!Array.isArray(mergedLeagues)) return [];
    let filtered = mergedLeagues;

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
  }, [mergedLeagues, searchQuery, selectedCountry]);

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

      {/* Leagues Accordion */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-12 h-12 rounded-lg bg-[#1a2332]" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-48 mb-2 bg-[#1a2332]" />
                  <Skeleton className="h-4 w-32 bg-[#1a2332]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {filteredLeagues.length > 0 ? (
            <Accordion type="multiple" className="w-full space-y-2">
              {filteredLeagues.map((league) => {
                const leagueId = league.id || league.league_id;
                // Ensure leagueId is a number for consistent comparison
                const leagueIdNum = typeof leagueId === 'string' ? parseInt(leagueId, 10) : leagueId;
                const leagueName = league.name || league.league_name || 'Bilinmeyen Lig';
                const country = league.country || '';
                const leagueMatches = matchesByLeague.get(leagueIdNum) || [];
                const matchCount = leagueMatches.length;

                return (
                  <AccordionItem
                    key={leagueIdNum}
                    value={`league-${leagueIdNum}`}
                    className="bg-[#0d1117] border border-[#1e2736] rounded-xl px-4 data-[state=open]:border-amber-500/50 transition-colors"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3 flex-1">
                        {league.image_path ? (
                          <div className="w-12 h-12 rounded-lg bg-[#1a2332] flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img 
                              src={league.image_path} 
                              alt={leagueName}
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `<span class="text-2xl">${getCountryFlag(country)}</span>`;
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                            {getCountryFlag(country)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <h3 className="text-white font-semibold text-lg truncate">
                            {leagueName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            {country && (
                              <span className="truncate">
                                {getCountryFlag(country)} {country}
                              </span>
                            )}
                            {matchCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{matchCount} maç</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      {matchCount > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 pt-2">
                          {leagueMatches.map((match) => (
                            <MatchCard 
                              key={match.id || `${match.homeTeam}-${match.awayTeam}-${match.date}`} 
                              match={match} 
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>Bu lig için maç bulunmuyor</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
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
