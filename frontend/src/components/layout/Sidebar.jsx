import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Zap, Calendar, Trophy, ChevronRight, Search } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { useMatches } from '../../hooks/useMatches';
import { matchAPI } from '../../services/api';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Fetch matches for search suggestions
  const { matches: allMatches } = useMatches({ matchType: 1 });

  // Fetch leagues from API
  useEffect(() => {
    async function fetchLeagues() {
      try {
        setLoadingLeagues(true);
        const leaguesData = await matchAPI.getLeagues({ matchType: 1 });
        setLeagues(leaguesData || []);
      } catch (error) {
        console.error('Error fetching leagues:', error);
        setLeagues([]);
      } finally {
        setLoadingLeagues(false);
      }
    }
    fetchLeagues();
  }, []);

  const navItems = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/live', label: 'Canlı Maçlar', icon: Zap, badge: 'CANLI' },
    { path: '/matches', label: 'Tüm Maçlar', icon: Calendar },
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
              <div className="space-y-1">
                {[
                  { id: 1, name: 'Süper Lig', flag: '🇹🇷' },
                  { id: 2, name: 'Premier Lig', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
                  { id: 3, name: 'La Liga', flag: '🇪🇸' },
                  { id: 4, name: 'Serie A', flag: '🇮🇹' },
                  { id: 5, name: 'Bundesliga', flag: '🇩🇪' },
                  { id: 6, name: 'Ligue 1', flag: '🇫🇷' },
                ].map((league) => {
                  // Count matches for this league (within 7 days, not finished)
                  const today = new Date().toISOString().split('T')[0];
                  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  const sportKeys = {
                    1: 'soccer_turkey_super_league',
                    2: 'soccer_epl',
                    3: 'soccer_spain_la_liga',
                    4: 'soccer_italy_serie_a',
                    5: 'soccer_germany_bundesliga',
                    6: 'soccer_france_ligue_one',
                  };
                  const matchCount = allMatches.filter(match => {
                    if (match.sportKey !== sportKeys[league.id]) return false;
                    const matchDate = match.date || '';
                    const isWithin7Days = matchDate >= today && matchDate <= sevenDaysLater;
                    const status = (match.status || '').toUpperCase();
                    const isFinished = status === 'FT' || status === 'FINISHED' || status === 'CANCELED' || status === 'CANCELLED' || status === 'POSTPONED';
                    return isWithin7Days && !isFinished;
                  }).length;
                  
                  return (
                    <Link
                      key={league.id}
                      to={`/league/${league.id}`}
                      onClick={onClose}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-[#1a2332] hover:text-white transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{league.flag}</span>
                        <span className="font-medium text-sm truncate">{league.name}</span>
                      </div>
                      <span className="text-xs text-gray-500 bg-[#1a2332] px-2 py-0.5 rounded">
                        {matchCount}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </>
  );
};

export default Sidebar;
