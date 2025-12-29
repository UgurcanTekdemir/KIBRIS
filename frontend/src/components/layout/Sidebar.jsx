import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Zap, Calendar, Trophy, ChevronRight, Search } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { useMatches } from '../../hooks/useMatches';
import * as footballService from '../../services/football';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Fetch matches for search suggestions and popular leagues
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { matches: allMatches } = useMatches({
    date_from: today,
    date_to: sevenDaysLater,
    matchType: 1
  });

  // Fetch leagues from API for popular leagues
  const [apiLeagues, setApiLeagues] = useState([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        setLeaguesLoading(true);
        const response = await footballService.getLeagues();
        
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
        
        const transformedLeagues = leaguesData.map(league => {
          let countryName = '';
          if (league.country) {
            if (typeof league.country === 'string') {
              countryName = league.country;
            } else if (league.country.name) {
              countryName = league.country.name;
            } else if (league.country.data && typeof league.country.data === 'object') {
              countryName = league.country.data.name || 
                           (league.country.data.data && league.country.data.data.name) || '';
            }
          }
          
          return {
            id: league.id,
            league_id: league.id,
            name: league.name || '',
            league_name: league.name || '',
            country: countryName,
            image_path: league.image_path || null,
            active: league.active !== false,
          };
        }).filter(league => league.active && league.name);
        
        setApiLeagues(transformedLeagues);
      } catch (err) {
        console.error('Error fetching leagues for sidebar:', err);
        setApiLeagues([]);
      } finally {
        setLeaguesLoading(false);
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
    const leaguesMap = new Map();
    
    allMatches.forEach(match => {
      const matchLeagueId = match.sportmonksData?.leagueId || match.leagueId || match.league_id || match.league?.id;
      if (matchLeagueId) {
        const leagueId = typeof matchLeagueId === 'string' ? parseInt(matchLeagueId, 10) : matchLeagueId;
        if (!isNaN(leagueId)) {
          if (!grouped.has(leagueId)) {
            grouped.set(leagueId, []);
          }
          grouped.get(leagueId).push(match);
          
          if (!leaguesMap.has(leagueId)) {
            const leagueName = match.league || match.league_name || match.leagueName || '';
            const leagueLogo = match.leagueLogo || match.league_logo || match.leagueFlag || null;
            const country = match.country || '';
            
            if (leagueName) {
              leaguesMap.set(leagueId, {
                id: leagueId,
                league_id: leagueId,
                name: leagueName,
                league_name: leagueName,
                country: country,
                image_path: leagueLogo,
              });
            }
          }
        }
      }
    });
    
    grouped.forEach((matches) => {
      matches.sort((a, b) => {
        if (a.date !== b.date) {
          return (a.date || '').localeCompare(b.date || '');
        }
        return (a.time || '').localeCompare(b.time || '');
      });
    });
    
    return { matchesByLeague: grouped, leaguesFromMatches: leaguesMap };
  }, [allMatches]);

  // Merge leagues from API with leagues from matches
  const mergedLeagues = useMemo(() => {
    const leaguesMap = new Map();
    
    apiLeagues.forEach(league => {
      const leagueId = typeof league.id === 'string' ? parseInt(league.id, 10) : league.id;
      if (!isNaN(leagueId)) {
        leaguesMap.set(leagueId, league);
      }
    });
    
    leaguesFromMatches.forEach((leagueFromMatch, leagueId) => {
      if (!leaguesMap.has(leagueId)) {
        leaguesMap.set(leagueId, leagueFromMatch);
      } else {
        const existingLeague = leaguesMap.get(leagueId);
        if (!existingLeague.image_path && leagueFromMatch.image_path) {
          existingLeague.image_path = leagueFromMatch.image_path;
        }
        if (!existingLeague.country && leagueFromMatch.country) {
          existingLeague.country = leagueFromMatch.country;
        }
        if (!existingLeague.country_id && leagueFromMatch.country_id) {
          existingLeague.country_id = leagueFromMatch.country_id;
        }
      }
    });
    
    return Array.from(leaguesMap.values());
  }, [apiLeagues, leaguesFromMatches]);

  // Helper function to convert DD.MM.YYYY to YYYY-MM-DD for comparison
  const convertDateToISO = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const [day, month, year] = dateStr.split('.');
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  };

  // Get popular leagues sorted by match count
  const popularLeagues = useMemo(() => {
    if (!Array.isArray(mergedLeagues) || mergedLeagues.length === 0) {
      return [];
    }
    
    const leaguesWithMatchCount = mergedLeagues.map(league => {
      const leagueId = typeof league.id === 'string' ? parseInt(league.id, 10) : league.id;
      const leagueMatches = matchesByLeague.get(leagueId) || [];
      
      // Filter matches within 7 days and not finished/postponed
      const validMatches = leagueMatches.filter(match => {
        const matchDate = convertDateToISO(match.date || '');
        const isWithin7Days = matchDate >= today && matchDate <= sevenDaysLater;
        const status = (match.status || '').toUpperCase();
        const isFinished = status === 'FT' || status === 'FINISHED' || status === 'CANCELED' || status === 'CANCELLED';
        const isPostponed = status === 'POSTPONED';
        return isWithin7Days && !isFinished && !isPostponed;
      });
      
      return {
        ...league,
        matchCount: validMatches.length,
      };
    });
    
    // Sort by match count (descending), then by name
    leaguesWithMatchCount.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    
    // Return top 6 leagues that have at least 1 match
    return leaguesWithMatchCount.filter(league => league.matchCount > 0).slice(0, 6);
  }, [mergedLeagues, matchesByLeague, today, sevenDaysLater]);

  // Get country flag emoji
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
    };

    for (const [key, flag] of Object.entries(flagMap)) {
      if (countryLower.includes(key)) {
        return flag;
      }
    }

    return '🏆';
  };

  // Extract unique leagues from matches data
  const extractedLeagues = useMemo(() => {
    if (!allMatches || allMatches.length === 0) return [];
    
    const leagueMap = new Map();
    
    allMatches.forEach(match => {
      // Use sportmonksData.leagueId or fallback to match.league_id
      const leagueId = match.sportmonksData?.leagueId || match.league_id;
      if (match.league && leagueId) {
        const leagueIdStr = String(leagueId);
        if (!leagueMap.has(leagueIdStr)) {
          leagueMap.set(leagueIdStr, {
            id: leagueIdStr,
            name: match.league,
            country: match.country || '',
            logo: match.leagueFlag || null,
            sport_key: match.sportKey || 'soccer'
          });
        }
      }
    });
    
    // Convert map to array and sort by name
    const leaguesArray = Array.from(leagueMap.values());
    leaguesArray.sort((a, b) => a.name.localeCompare(b.name));
    
    return leaguesArray;
  }, [allMatches]);

  // Update leagues state when extracted leagues change
  // Use ref to prevent infinite loops
  const hasFetchedLeagues = useRef(false);
  
  useEffect(() => {
    if (extractedLeagues.length > 0) {
      setLeagues(extractedLeagues);
      setLoadingLeagues(false);
      hasFetchedLeagues.current = false; // Reset flag when we have leagues from matches
    } else if (allMatches.length === 0 && !hasFetchedLeagues.current) {
      // If no matches loaded yet, try to fetch leagues from backend API as fallback (only once)
      hasFetchedLeagues.current = true;
      async function fetchLeagues() {
        try {
          setLoadingLeagues(true);
          const leaguesData = await footballService.getLeagues();
          // Backend returns { success: true, data: [...] } or just array
          const leaguesArray = Array.isArray(leaguesData) 
            ? leaguesData 
            : (leaguesData?.data || [leaguesData].filter(Boolean));
          // Map backend league format to internal format
          const mappedLeagues = leaguesArray.map(league => ({
            id: String(league.id || league.league_id),
            name: league.name || league.league_name || '',
            country: league.country?.name || league.country || '',
            logo: league.image_path || league.logo || null,
            sport_key: 'soccer'
          }));
          setLeagues(mappedLeagues);
        } catch (error) {
          console.error('Error fetching leagues:', error);
          setLeagues([]);
        } finally {
          setLoadingLeagues(false);
        }
      }
      fetchLeagues();
    }
  }, [extractedLeagues.length, allMatches.length]); // Use length instead of full arrays to prevent infinite loops

  const navItems = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/live', label: 'Canlı Maçlar', icon: Zap, badge: 'CANLI' },
    { path: '/matches', label: 'Tüm Maçlar', icon: Calendar },
    { path: '/leagues', label: 'Ligler', icon: Trophy },
  ];

  // Filter football leagues (soccer)
  const footballLeagues = useMemo(() => {
    return leagues.filter((l) => {
      const sportKey = l.sport_key || '';
      return sportKey.includes('soccer') || !sportKey || sportKey === 'soccer_unknown';
    }).slice(0, 6);
  }, [leagues]);

  // Generate search suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];

    const query = searchQuery.toLowerCase().trim();
    const results = [];

    // Extract unique team names and leagues
    const teams = new Set();
    const leagueNames = new Set();

    if (allMatches && allMatches.length > 0) {
      allMatches.forEach((match) => {
        if (match.homeTeam?.toLowerCase().includes(query)) {
          teams.add(match.homeTeam);
        }
        if (match.awayTeam?.toLowerCase().includes(query)) {
          teams.add(match.awayTeam);
        }
        if (match.league?.toLowerCase().includes(query)) {
          leagueNames.add(match.league);
        }
      });
    }

    // Add teams to suggestions
    Array.from(teams).slice(0, 5).forEach((team) => {
      results.push({ type: 'team', label: team, value: team });
    });

    // Add leagues to suggestions
    Array.from(leagueNames).slice(0, 3).forEach((league) => {
      results.push({ type: 'league', label: league, value: league });
    });

    return results;
  }, [searchQuery, allMatches]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/matches?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setShowSuggestions(false);
      onClose(); // Close sidebar on mobile
    }
  };

  const handleSuggestionClick = (suggestion) => {
    navigate(`/matches?search=${encodeURIComponent(suggestion.value)}`);
    setSearchQuery('');
    setShowSuggestions(false);
    onClose();
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(value.trim().length >= 2);
  };

  const isActiveRoute = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path, e) => {
    e.preventDefault();
    
    // Check if we're already on this page
    const isCurrentlyActive = isActiveRoute(path);
    
    if (isCurrentlyActive) {
      // If already on this page, scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onClose(); // Close sidebar on mobile
    } else {
      // If on different page, navigate
      navigate(path);
      onClose(); // Close sidebar on mobile
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-14 left-0 bottom-0 w-64 bg-[#0d1117] border-r border-[#1e2736] z-40 transform transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <ScrollArea className="h-full">
          <div className="p-4 relative">
            {/* Search Bar */}
            <div className="mb-6 relative z-50" ref={searchRef}>
              <form onSubmit={handleSearch} className="relative">
                <Search 
                  size={18} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-10" 
                />
                <Input
                  type="text"
                  placeholder="Maç, takım veya lig ara..."
                  value={searchQuery}
                  onChange={handleInputChange}
                  onFocus={() => searchQuery.trim().length >= 2 && setShowSuggestions(true)}
                  className="pl-10 bg-[#1a2332] border-[#2a3a4d] text-white placeholder:text-gray-500 focus:border-amber-500/50 focus:ring-amber-500/20"
                />
              </form>

              {/* Search Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-[#0d1117] border border-[#1e2736] rounded-lg shadow-2xl z-[100] max-h-64 overflow-y-auto"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-2.5 text-left hover:bg-[#1a2332] transition-colors flex items-center gap-3 border-b border-[#1e2736] last:border-b-0"
                    >
                      <Search size={14} className="text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">
                          {suggestion.label}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {suggestion.type === 'team' ? 'Takım' : 'Lig'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No results message */}
              {showSuggestions && searchQuery.trim().length >= 2 && suggestions.length === 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-[#0d1117] border border-[#1e2736] rounded-lg shadow-2xl z-[100] p-4"
                >
                  <div className="text-gray-500 text-sm text-center">
                    "{searchQuery}" için sonuç bulunamadı
                  </div>
                </div>
              )}
            </div>

            {/* Main Navigation */}
            <nav className="space-y-1 mb-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.path);
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    onClick={(e) => handleNavClick(item.path, e)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                        : 'text-gray-400 hover:bg-[#1a2332] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </a>
                );
              })}
            </nav>

            {/* Popular Leagues */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                Popüler Ligler
              </h3>
              {leaguesLoading ? (
                <div className="space-y-1">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="px-2 py-2 rounded-lg animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-[#1a2332] rounded"></div>
                          <div className="h-3 w-20 bg-[#1a2332] rounded"></div>
                        </div>
                        <div className="h-4 w-6 bg-[#1a2332] rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : popularLeagues.length > 0 ? (
                <div className="space-y-1">
                  {popularLeagues.map((league) => {
                    const leagueId = typeof league.id === 'string' ? parseInt(league.id, 10) : league.id;
                    let leagueName = league.name || league.league_name || 'Bilinmeyen Lig';
                    const country = league.country || '';
                    const flag = getCountryFlag(country);
                    
                    // Display Turkey 1.Lig as "Türkiye 1.Lig"
                    const nameLower = leagueName.toLowerCase();
                    const countryLower = country.toLowerCase();
                    if ((nameLower.includes('1.lig') || nameLower.includes('1. lig')) && 
                        (countryLower.includes('turkey') || countryLower.includes('türkiye'))) {
                      leagueName = 'Türkiye 1.Lig';
                    }
                    
                    return (
                      <Link
                        key={leagueId}
                        to={`/league/${leagueId}`}
                        onClick={onClose}
                        className="flex items-center justify-between px-2 py-2 rounded-lg text-gray-400 hover:bg-[#1a2332] hover:text-white transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {league.image_path ? (
                            <div className="w-5 h-5 rounded bg-[#1a2332] flex items-center justify-center overflow-hidden flex-shrink-0">
                              <img 
                                src={league.image_path} 
                                alt={leagueName}
                                className="w-full h-full object-contain p-0.5"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = `<span class="text-xs">${flag}</span>`;
                                }}
                              />
                            </div>
                          ) : (
                            <span className="text-sm flex-shrink-0">{flag}</span>
                          )}
                          <span className="font-medium text-xs truncate">{leagueName}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-500 bg-[#1a2332] px-1.5 py-0.5 rounded flex-shrink-0">
                          {league.matchCount}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  Henüz lig bulunmuyor
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </aside>
    </>
  );
};

export default Sidebar;
