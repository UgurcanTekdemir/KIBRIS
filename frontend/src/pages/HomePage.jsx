import React, { useState, useMemo } from 'react';
import MatchCard from '../components/betting/MatchCard';
import LiveMatchCard from '../components/betting/LiveMatchCard';
import HeroBannerSlider from '../components/HeroBannerSlider';
import { Zap, Calendar, TrendingUp, Star, ChevronRight, Search, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { useMatches } from '../hooks/useMatches';
import SetRoleHelper from '../components/SetRoleHelper';

// Popular Leagues Component
function PopularLeagues({ allMatches }) {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const leagues = useMemo(() => [
    { id: 1, name: 'Süper Lig', flag: '🇹🇷', sport_key: 'soccer_turkey_super_league', leagueNames: ['Süper Lig', 'Super Lig', 'Turkish Super League', 'Turkey Super League'] },
    { id: 2, name: 'Premier Lig', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', sport_key: 'soccer_epl', leagueNames: ['Premier League', 'Premier Lig', 'English Premier League', 'EPL'] },
    { id: 3, name: 'La Liga', flag: '🇪🇸', sport_key: 'soccer_spain_la_liga', leagueNames: ['La Liga', 'Spanish La Liga', 'Primera División'] },
    { id: 4, name: 'Serie A', flag: '🇮🇹', sport_key: 'soccer_italy_serie_a', leagueNames: ['Serie A', 'Italian Serie A'] },
    { id: 5, name: 'Bundesliga', flag: '🇩🇪', sport_key: 'soccer_germany_bundesliga', leagueNames: ['Bundesliga', 'German Bundesliga'] },
    { id: 6, name: 'Ligue 1', flag: '🇫🇷', sport_key: 'soccer_france_ligue_one', leagueNames: ['Ligue 1', 'French Ligue 1', 'Ligue 1 Uber Eats'] },
  ], []);

  const leagueCounts = useMemo(() => {
    const counts = {};
    leagues.forEach(league => {
        // Filter matches by league name (Sportmonks V3 uses league name, not sport_key)
        counts[league.id] = allMatches.filter(match => {
          // Match by league name (case-insensitive)
          const matchLeague = (match.league || '').toLowerCase();
          const matchesLeague = league.leagueNames.some(leagueName => 
            matchLeague.includes(leagueName.toLowerCase())
          );
          
          if (!matchesLeague) return false;
          
          // Only count matches within 7 days (including today)
          const matchDate = match.date || '';
          const isWithin7Days = matchDate >= today && matchDate <= sevenDaysLater;
          
          if (!isWithin7Days) return false;
          
          // Include live matches, upcoming matches, but exclude finished and postponed
          const status = (match.status || '').toUpperCase();
          const isFinished = status === 'FT' || status === 'FINISHED' || status === 'CANCELED' || status === 'CANCELLED';
          const isPostponed = status === 'POSTPONED';
          
          // Count live matches and upcoming matches (not finished, not postponed)
          return !isFinished && !isPostponed;
        }).length;
    });
    return counts;
  }, [allMatches, today, sevenDaysLater, leagues]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
      {leagues.map((league) => (
        <Link
          key={league.id}
          to={`/league/${league.id}`}
          className="bg-[#0d1117] border border-[#1e2736] rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center hover:border-amber-500/50 hover:bg-[#1a2332] transition-all group"
        >
          <span className="text-xl sm:text-2xl md:text-3xl block mb-0.5 sm:mb-1 md:mb-2">{league.flag}</span>
          <p className="text-white font-medium text-[10px] sm:text-xs md:text-sm mb-0.5 truncate">{league.name}</p>
          <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 font-semibold">{leagueCounts[league.id] || 0} maç</p>
        </Link>
      ))}
    </div>
  );
}

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch matches from API
  const { matches: allMatches, loading, error } = useMatches({ matchType: 1 });
  
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

  // Filter matches by today and upcoming
  // Exclude past/finished matches explicitly
  const todayMatches = useMemo(() => {
    // Show matches from today onwards (including today)
    // Exclude finished matches (status: FT, FINISHED, etc.)
    const filtered = allMatches.filter(m => {
      // Check date
      if (m.date < today) return false;
      
      // Exclude finished matches (but not postponed - they should be shown)
      const status = (m.status || '').toUpperCase();
      if (status === 'FT' || status === 'FINISHED' || status === 'CANCELED' || status === 'CANCELLED') {
        return false;
      }
      // POSTPONED matches are excluded from homepage
      if (status === 'POSTPONED') {
        return false;
      }
      
      // Exclude live matches (they're handled separately)
      // Actually, we can show live matches too, so keep them
      
      return true;
    });
    
    return filtered.slice(0, 4);
  }, [allMatches, today]);

  const upcomingMatches = useMemo(() => {
    // Show next 8 upcoming matches (excluding the ones shown in todayMatches)
    const filtered = allMatches.filter(m => {
      // Check date
      if (m.date < today) return false;
      
      // Exclude finished matches (but not postponed - they should be shown)
      const status = (m.status || '').toUpperCase();
      if (status === 'FT' || status === 'FINISHED' || status === 'CANCELED' || status === 'CANCELLED') {
        return false;
      }
      // POSTPONED matches are excluded from homepage
      if (status === 'POSTPONED') {
        return false;
      }
      
      return true;
    });
    
    const todayCount = todayMatches.length;
    return filtered.slice(todayCount, todayCount + 8);
  }, [allMatches, today, todayMatches.length]);

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
        
        <div className="overflow-x-auto pb-2 -mx-2 sm:-mx-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <div className="flex gap-2 sm:gap-3 px-2 sm:px-0">
            {isLoading ? (
              <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm w-full">
                Oranlar yükleniyor...
              </div>
            ) : filteredTodayMatches.length > 0 ? (
              filteredTodayMatches.slice(0, 4).map((match, idx) => (
                <MatchCard key={match.id || `home-today-${idx}-${match.homeTeam}-${match.awayTeam}`} match={match} compact={true} />
              ))
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm w-full">
                {searchQuery ? 'Arama kriterlerinize uygun maç bulunamadı.' : 'Bugün için maç bulunamadı.'}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {[
          { label: 'Bugün', value: todayMatches.length, icon: Calendar, color: 'text-blue-500' },
          { label: 'Yakın Maçlar', value: upcomingMatches.length, icon: Calendar, color: 'text-green-500' },
          { label: 'Toplam', value: allMatches.length, icon: TrendingUp, color: 'text-amber-500' },
          { label: 'Ligler', value: new Set(allMatches.map(m => m.league)).size, icon: Star, color: 'text-purple-500' },
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
          {filteredUpcomingMatches.length > 0 ? (
            filteredUpcomingMatches.slice(0, 4).map((match, idx) => (
              <MatchCard key={match.id || `home-upcoming-${idx}-${match.homeTeam}-${match.awayTeam}`} match={match} compact={true} />
            ))
          ) : (
            <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm col-span-1 sm:col-span-2">
              Arama kriterlerinize uygun yakın maç bulunamadı.
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
