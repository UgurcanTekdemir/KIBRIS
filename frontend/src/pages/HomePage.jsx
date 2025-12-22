import React, { useState, useMemo } from 'react';
import { liveMatches, upcomingMatches } from '../data/mockData';
import MatchCard from '../components/betting/MatchCard';
import LiveMatchCard from '../components/betting/LiveMatchCard';
import { Zap, Calendar, TrendingUp, Star, ChevronRight, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const allMatches = useMemo(() => {
    return [...liveMatches, ...upcomingMatches];
  }, []);

  const filteredLiveMatches = useMemo(() => {
    if (!searchQuery.trim()) return liveMatches;
    const query = searchQuery.toLowerCase();
    return liveMatches.filter(match => 
      match.homeTeam.toLowerCase().includes(query) ||
      match.awayTeam.toLowerCase().includes(query) ||
      match.league.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const filteredUpcomingMatches = useMemo(() => {
    if (!searchQuery.trim()) return upcomingMatches;
    const query = searchQuery.toLowerCase();
    return upcomingMatches.filter(match => 
      match.homeTeam.toLowerCase().includes(query) ||
      match.awayTeam.toLowerCase().includes(query) ||
      match.league.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3 sm:space-y-4 lg:space-y-6">
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
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-lg sm:rounded-xl lg:rounded-2xl bg-gradient-to-r from-amber-600/20 via-[#1a2332] to-[#0d1117] border border-amber-500/20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1200')] bg-cover bg-center opacity-10"></div>
        <div className="relative p-3 sm:p-4 md:p-6 lg:p-10">
          <div className="max-w-xl">
            <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-1.5 sm:mb-2 md:mb-3">
              Canlı Bahis Heyecanı
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm md:text-base mb-3 sm:mb-4 md:mb-6 leading-relaxed">
              En yüksek oranlarla canlı maçlara bahis yapın. Anında ödemeler, güvenli platform.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/live" className="flex-1 sm:flex-none">
                <Button className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-xs sm:text-sm md:text-base h-9 sm:h-10">
                  <Zap size={14} className="mr-1.5 sm:mr-2" />
                  Canlı Maçlar
                </Button>
              </Link>
              <Link to="/matches" className="flex-1 sm:flex-none">
                <Button variant="outline" className="w-full sm:w-auto border-[#2a3a4d] text-white hover:bg-[#1a2332] text-xs sm:text-sm md:text-base h-9 sm:h-10">
                  Tüm Maçlar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Live Matches Section */}
      <section>
        <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse"></div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Canlı Maçlar</h2>
            <span className="bg-red-500/20 text-red-500 text-[9px] sm:text-[10px] md:text-xs font-bold px-1 sm:px-1.5 md:px-2 py-0.5 rounded">
              {liveMatches.length} CANLI
            </span>
          </div>
          <Link to="/live" className="flex items-center gap-0.5 sm:gap-1 text-amber-500 hover:text-amber-400 text-[10px] sm:text-xs md:text-sm font-medium">
            Tümünü Gör
            <ChevronRight size={12} className="sm:w-3.5 sm:h-3.5" />
          </Link>
        </div>
        
        <div className="overflow-x-auto pb-2 -mx-2 sm:-mx-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <div className="flex gap-2 sm:gap-3 px-2 sm:px-0">
            {filteredLiveMatches.length > 0 ? (
              filteredLiveMatches.map((match) => (
                <LiveMatchCard key={match.id} match={match} />
              ))
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm w-full">
                Arama kriterlerinize uygun canlı maç bulunamadı.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {[
          { label: 'Canlı Maç', value: liveMatches.length, icon: Zap, color: 'text-red-500' },
          { label: 'Bugün', value: upcomingMatches.filter(m => m.date === '2025-07-15').length, icon: Calendar, color: 'text-blue-500' },
          { label: 'En Yüksek', value: '12.50', icon: TrendingUp, color: 'text-green-500' },
          { label: 'Popüler', value: '45+', icon: Star, color: 'text-amber-500' },
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
            filteredUpcomingMatches.slice(0, 4).map((match) => (
              <MatchCard key={match.id} match={match} compact={true} />
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
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
          {[
            { name: 'Süper Lig', flag: '🇹🇷', count: 12 },
            { name: 'Premier Lig', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', count: 10 },
            { name: 'La Liga', flag: '🇪🇸', count: 10 },
            { name: 'Serie A', flag: '🇮🇹', count: 10 },
            { name: 'Bundesliga', flag: '🇩🇪', count: 9 },
            { name: 'Şampiyonlar', flag: '🇪🇺', count: 8 },
          ].map((league, idx) => (
            <Link
              key={idx}
              to={`/league/${idx + 1}`}
              className="bg-[#0d1117] border border-[#1e2736] rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center hover:border-amber-500/50 hover:bg-[#1a2332] transition-all group"
            >
              <span className="text-xl sm:text-2xl md:text-3xl block mb-0.5 sm:mb-1 md:mb-2">{league.flag}</span>
              <p className="text-white font-medium text-[10px] sm:text-xs md:text-sm mb-0.5 truncate">{league.name}</p>
              <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500">{league.count} maç</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
