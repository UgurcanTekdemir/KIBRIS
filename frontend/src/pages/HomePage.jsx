import React, { useState, useMemo, useRef, useEffect } from 'react';
import MatchCard from '../components/betting/MatchCard';
import LiveMatchCard from '../components/betting/LiveMatchCard';
import HeroBannerSlider from '../components/HeroBannerSlider';
import { Zap, Calendar, TrendingUp, Star, ChevronRight, ChevronLeft, Search, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { useMatches } from '../hooks/useMatches';
import { useLeagues } from '../hooks/useLeagues';
import { matchAPI } from '../services/api';
import SetRoleHelper from '../components/SetRoleHelper';
import { 
  getToday, 
  getDateFromToday,
  getMatchDate,
  getMatchDateTime,
  parseMatchDateTime,
  normalizeDateForComparison,
  isMatchFinished,
  isMatchLive,
  isMatchHalfTime,
  isMatchPostponed
} from '../utils/dateHelpers';
import { 
  filterTodayMatchesWithinWindow,
  filterUpcomingMatches,
  sortMatchesByDateTime
} from '../utils/matchHelpers';

// Popular Leagues Component
function PopularLeagues({ allMatches }) {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Backend'deki öncelikli lig ID'leri (POPULAR_LEAGUE_IDS ile aynı sırada)
  const PRIORITY_LEAGUE_IDS = [
    600,  // Super Lig (Turkey)
    603,  // 1. Lig (Turkey) - TFF First League
    8,    // Premier League (England)
    564,  // La Liga (Spain)
    82,   // Bundesliga (Germany)
    384,  // Serie A (Italy)
    301,  // Ligue 1 (France)
    72,   // Eredivisie (Netherlands)
    648,  // Serie A (Brazil)
    9,    // Championship (England)
    636,  // Liga Profesional de Fútbol (Argentina)
    743,  // Liga MX (Mexico)
    2,    // Champions League (Europe)
    5,    // Europa League (Europe)
    2286, // Europa Conference League (Europe)
    779,  // Major League Soccer (United States)
    968,  // J-League (Japan)
    1356, // A-League Men (Australia)
    462,  // Liga Portugal (Portugal)
    501,  // Premiership (Scotland)
    208,  // Pro League (Belgium)
    181,  // Admiral Bundesliga (Austria)
    591,  // Super League (Switzerland)
    486,  // Premier League (Russia)
    271,  // Superliga (Denmark)
    444,  // Eliteserien (Norway)
    573,  // Allsvenskan (Sweden)
    453,  // Ekstraklasa (Poland)
    262,  // Chance Liga (Czech Republic)
    325,  // Super League (Greece)
    244,  // 1. HNL (Croatia)
    474,  // Superliga (Romania)
    229,  // First League (Bulgaria)
  ];
  
  // Fetch leagues from API (cached)
  const { leagues: apiLeagues, loading: leaguesLoading } = useLeagues();
  
  // Slider ref
  const scrollContainerRef = useRef(null);
  
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
  
  // Group matches by league_id
  const matchesByLeague = useMemo(() => {
    if (!allMatches || !Array.isArray(allMatches)) {
      return new Map();
    }
    
    const grouped = new Map();
    
    allMatches.forEach(match => {
      const matchLeagueId = match.leagueId || match.league_id || match.sportmonksData?.leagueId;
      if (matchLeagueId) {
        const leagueId = typeof matchLeagueId === 'string' ? parseInt(matchLeagueId, 10) : matchLeagueId;
        if (!isNaN(leagueId)) {
          if (!grouped.has(leagueId)) {
            grouped.set(leagueId, []);
          }
          grouped.get(leagueId).push(match);
        }
      }
    });
    
    return grouped;
  }, [allMatches]);
  
  // Get popular leagues prioritized by backend POPULAR_LEAGUE_IDS order
  const popularLeagues = useMemo(() => {
    if (!Array.isArray(apiLeagues) || apiLeagues.length === 0) {
      return [];
    }
    
    // Create a map for quick lookup
    const leagueMap = new Map();
    apiLeagues.forEach(league => {
      const leagueId = typeof league.id === 'string' ? parseInt(league.id, 10) : league.id;
      leagueMap.set(leagueId, league);
    });
    
    // Get leagues in priority order from PRIORITY_LEAGUE_IDS
    const prioritizedLeagues = [];
    const otherLeagues = [];
    
    PRIORITY_LEAGUE_IDS.forEach(priorityId => {
      const league = leagueMap.get(priorityId);
      if (league) {
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
        
        prioritizedLeagues.push({
          ...league,
          matchCount: validMatches.length,
          priority: PRIORITY_LEAGUE_IDS.indexOf(priorityId),
        });
      }
    });
    
    // Add other leagues that are not in priority list
    apiLeagues.forEach(league => {
      const leagueId = typeof league.id === 'string' ? parseInt(league.id, 10) : league.id;
      if (!PRIORITY_LEAGUE_IDS.includes(leagueId)) {
        const leagueMatches = matchesByLeague.get(leagueId) || [];
        const validMatches = leagueMatches.filter(match => {
          const matchDate = convertDateToISO(match.date || '');
          const isWithin7Days = matchDate >= today && matchDate <= sevenDaysLater;
          const status = (match.status || '').toUpperCase();
          const isFinished = status === 'FT' || status === 'FINISHED' || status === 'CANCELED' || status === 'CANCELLED';
          const isPostponed = status === 'POSTPONED';
          return isWithin7Days && !isFinished && !isPostponed;
        });
        
        // Add all leagues, even if they have no matches
        otherLeagues.push({
          ...league,
          matchCount: validMatches.length,
          priority: 999, // Lower priority
        });
      }
    });
    
    // Sort other leagues by match count (descending), then by name
    otherLeagues.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    
    // Combine: prioritized leagues first, then others (show all leagues, even with 0 matches)
    return [...prioritizedLeagues, ...otherLeagues];
  }, [apiLeagues, matchesByLeague, today, sevenDaysLater]);
  
  // Slider navigation functions
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };
  
  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };
  
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

  if (leaguesLoading) {
    return (
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex-shrink-0 w-20 sm:w-24 md:w-28 bg-[#0d1117] border border-[#1e2736] rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 animate-pulse">
            <div className="w-full aspect-square rounded-lg bg-[#1a2332] mb-2"></div>
            <div className="h-3 w-full mb-1 bg-[#1a2332] rounded"></div>
            <div className="h-2 w-2/3 bg-[#1a2332] rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (popularLeagues.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        Popüler lig bulunamadı
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Slider Container */}
      <div className="relative group">
        {/* Left Arrow */}
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-[#0d1117] border border-[#1e2736] rounded-full p-1.5 sm:p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1a2332] hover:border-amber-500/50"
          aria-label="Önceki ligler"
        >
          <ChevronLeft size={16} className="text-white sm:w-4 sm:h-4" />
        </button>
        
        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 sm:gap-3 overflow-x-auto scroll-smooth pb-2 hide-scrollbar"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none'
          }}
        >
          {popularLeagues.map((league) => {
            const leagueId = typeof league.id === 'string' ? parseInt(league.id, 10) : league.id;
            const leagueName = league.name || league.league_name || 'Bilinmeyen Lig';
            const country = league.country || '';
            const flag = getCountryFlag(country);
            
            return (
              <Link
                key={leagueId}
                to={`/league/${leagueId}`}
                className="flex-shrink-0 w-20 sm:w-24 md:w-28 bg-[#0d1117] border border-[#1e2736] rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center hover:border-amber-500/50 hover:bg-[#1a2332] transition-all group"
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
                {league.matchCount > 0 && (
                  <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 font-semibold">{league.matchCount} maç</p>
                )}
              </Link>
            );
          })}
        </div>
        
        {/* Right Arrow */}
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-[#0d1117] border border-[#1e2736] rounded-full p-1.5 sm:p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1a2332] hover:border-amber-500/50"
          aria-label="Sonraki ligler"
        >
          <ChevronRight size={16} className="text-white sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
}

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ today: 0, upcoming: 0, total: 0, leagues: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Memoize date calculations (only recalculate once per day)
  const today = useMemo(() => getToday(), []);
  const sevenDaysLater = useMemo(() => getDateFromToday(7), []);
  
  // Fetch matches from API - get matches for next 7 days
  const { matches: allMatches, loading, error } = useMatches({ 
    date_from: today,
    date_to: sevenDaysLater
  });
  
  // Fetch stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const statsData = await matchAPI.getStats();
        setStats(statsData);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };
    
    fetchStats();
  }, []);
  
  // Show loading only when data is actually loading
  const isLoading = loading;

  // Filter matches by today and upcoming - optimized with helper functions
  const todayMatches = useMemo(() => {
    if (!allMatches || allMatches.length === 0) return [];
    
    // Try 1-hour window first
    const matches1Hour = filterTodayMatchesWithinWindow(allMatches, 1);
    if (matches1Hour.length > 0) {
      return sortMatchesByDateTime(matches1Hour).slice(0, 4);
    }
    
    // Fallback: 4-hour window
    const matches4Hour = filterTodayMatchesWithinWindow(allMatches, 4);
    return sortMatchesByDateTime(matches4Hour).slice(0, 4);
  }, [allMatches]);

  const upcomingMatches = useMemo(() => {
    if (!allMatches || allMatches.length === 0) return [];
    
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const normalizedToday = normalizeDateForComparison(today);
    const normalizedSevenDaysLater = normalizeDateForComparison(sevenDaysLater);
    
    // Filter upcoming matches (more than 1 hour from now, within 7 days)
    // Don't exclude live matches - they can appear in upcoming section
    const filtered = allMatches.filter(m => {
      // Exclude finished/postponed
      if (isMatchFinished(m) || isMatchPostponed(m)) return false;
      
      // Check date range
      const matchDate = normalizeDateForComparison(getMatchDate(m));
      if (!matchDate) return false;
      if (matchDate < normalizedToday || matchDate > normalizedSevenDaysLater) return false;
      
      // Exclude past matches (by datetime)
      const matchDateTime = parseMatchDateTime(getMatchDateTime(m));
      if (matchDateTime && matchDateTime < now) return false;
      
      // Exclude matches within 1 hour (those are in todayMatches)
      if (matchDateTime && matchDateTime <= oneHourLater) return false;
      
      return true;
    });
    
    // Sort and get unique matches (exclude todayMatches)
    const todayMatchIds = new Set(todayMatches.map(m => m.id));
    const uniqueUpcoming = filtered.filter(m => !todayMatchIds.has(m.id));
    
    return sortMatchesByDateTime(uniqueUpcoming).slice(0, 8);
  }, [allMatches, today, sevenDaysLater, todayMatches]);

  const filteredTodayMatches = useMemo(() => {
    if (!searchQuery.trim()) return todayMatches;
    const query = searchQuery.toLowerCase();
    return todayMatches.filter(match => 
      match.homeTeam?.toLowerCase().includes(query) ||
      match.awayTeam?.toLowerCase().includes(query) ||
      match.league?.toLowerCase().includes(query)
    );
  }, [todayMatches, searchQuery]);

  const filteredUpcomingMatches = useMemo(() => {
    if (!searchQuery.trim()) return upcomingMatches;
    const query = searchQuery.toLowerCase();
    return upcomingMatches.filter(match => 
      match.homeTeam?.toLowerCase().includes(query) ||
      match.awayTeam?.toLowerCase().includes(query) ||
      match.league?.toLowerCase().includes(query)
    );
  }, [upcomingMatches, searchQuery]);

  // Auto-slider ref and effect for today's matches
  const todayMatchesSliderRef = useRef(null);

  useEffect(() => {
    if (!todayMatchesSliderRef.current || filteredTodayMatches.length <= 1) return;
    if (window.innerWidth >= 768) return; // Only on mobile

    const slider = todayMatchesSliderRef.current;
    const sliderItems = slider.querySelectorAll('.slider-item');
    if (sliderItems.length <= 1) return;

    let currentIndex = 0;

    const autoScroll = () => {
      currentIndex = (currentIndex + 1) % sliderItems.length;
      const targetItem = sliderItems[currentIndex];
      
      if (targetItem) {
        targetItem.scrollIntoView({ 
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
        });
      }
    };

    const interval = setInterval(autoScroll, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [filteredTodayMatches]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Role Helper - Temporary component for setting roles */}
      <SetRoleHelper />
      {/* Search Bar */}
      <div className="relative mb-2 sm:mb-0">
        <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <Input
          type="text"
          placeholder="Takım, lig veya maç ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 sm:pl-10 pr-9 sm:pr-10 h-10 sm:h-11 bg-[#0d1117] border-[#1e2736] text-white text-sm placeholder:text-gray-500 focus:border-amber-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {/* Hero Banner Slider */}
      <HeroBannerSlider />

      {/* Today's Matches Section */}
      <section>
        <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Calendar size={16} className="text-amber-500 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Bugünün Maçları</h2>
            {isLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          </div>
          <Link to="/matches" className="flex items-center gap-0.5 sm:gap-1 text-amber-500 hover:text-amber-400 text-[10px] sm:text-xs md:text-sm font-medium">
            Tümünü Gör
            <ChevronRight size={12} className="sm:w-3.5 sm:h-3.5" />
          </Link>
        </div>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-xs sm:text-sm">{error}</p>
          </div>
        )}
        
        <div 
          ref={todayMatchesSliderRef}
          className="md:grid md:grid-cols-2 md:gap-4 flex gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-2 md:mx-0 px-2 md:px-0"
          style={{ 
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {isLoading ? (
            <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm w-full md:col-span-2">
              Oranlar yükleniyor...
            </div>
          ) : filteredTodayMatches.length > 0 ? (
            filteredTodayMatches.slice(0, 4).map((match, idx) => (
              <div 
                key={match.id || `home-today-${idx}-${match.homeTeam}-${match.awayTeam}`} 
                className="slider-item min-w-[85%] md:min-w-0 flex-shrink-0 transition-transform duration-300 ease-in-out"
                style={{ 
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always'
                }}
              >
                <MatchCard match={match} compact={true} />
              </div>
            ))
          ) : (
            <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm w-full md:col-span-2">
              {searchQuery ? 'Arama kriterlerinize uygun maç bulunamadı.' : 'Bugün için maç bulunamadı.'}
            </div>
          )}
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {[
          { label: 'Bugün', value: statsLoading ? 0 : stats.today, icon: Calendar, color: 'text-blue-500' },
          { label: 'Yakın Maçlar', value: statsLoading ? 0 : stats.upcoming, icon: Calendar, color: 'text-green-500' },
          { label: 'Toplam', value: statsLoading ? 0 : stats.total, icon: TrendingUp, color: 'text-amber-500' },
          { label: 'Ligler', value: statsLoading ? 0 : stats.leagues, icon: Star, color: 'text-purple-500' },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-[#0d1117] border border-[#1e2736] rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 flex items-center gap-1.5 sm:gap-2 md:gap-3">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg bg-[#1a2332] flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                <Icon size={14} className="sm:w-4 sm:h-4 md:w-5 md:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg md:text-2xl font-bold text-white truncate">{stat.value}</p>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 truncate">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming Matches */}
      <section>
        <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Calendar size={16} className="text-amber-500 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Yakın Maçlar</h2>
          </div>
          <Link to="/matches" className="flex items-center gap-0.5 sm:gap-1 text-amber-500 hover:text-amber-400 text-[10px] sm:text-xs md:text-sm font-medium">
            Tümünü Gör
            <ChevronRight size={12} className="sm:w-3.5 sm:h-3.5" />
          </Link>
        </div>
        
        {/* Mobile: Stack, Desktop: Grid */}
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
          {isLoading ? (
            <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm col-span-1 sm:col-span-2">
              Yükleniyor...
            </div>
          ) : filteredUpcomingMatches.length > 0 ? (
            filteredUpcomingMatches.slice(0, 4).map((match, idx) => (
              <MatchCard key={match.id || `home-upcoming-${idx}-${match.homeTeam}-${match.awayTeam}`} match={match} compact={true} />
            ))
          ) : (
            <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm col-span-1 sm:col-span-2">
              {searchQuery ? 'Arama kriterlerinize uygun yakın maç bulunamadı.' : 'Yakın zamanda maç bulunamadı.'}
            </div>
          )}
        </div>
      </section>

      {/* Popular Leagues */}
      <section className="pb-2 sm:pb-4">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-white mb-2 sm:mb-3 md:mb-4 flex items-center gap-1.5 sm:gap-2">
          <Star size={16} className="text-amber-500 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          Popüler Ligler
        </h2>
        <PopularLeagues allMatches={allMatches} />
      </section>
    </div>
  );
};

export default HomePage;
