import React from 'react';
import { liveMatches, upcomingMatches } from '../data/mockData';
import MatchCard from '../components/betting/MatchCard';
import LiveMatchCard from '../components/betting/LiveMatchCard';
import { Zap, Calendar, TrendingUp, Star, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';

const HomePage = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-600/20 via-[#1a2332] to-[#0d1117] border border-amber-500/20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1200')] bg-cover bg-center opacity-10"></div>
        <div className="relative p-4 sm:p-6 md:p-10">
          <div className="max-w-xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">
              Canlı Bahis Heyecanı
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mb-4 sm:mb-6">
              En yüksek oranlarla canlı maçlara bahis yapın. Anında ödemeler, güvenli platform.
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Link to="/live">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-sm sm:text-base">
                  <Zap size={16} className="mr-1.5 sm:mr-2" />
                  Canlı Maçlar
                </Button>
              </Link>
              <Link to="/matches">
                <Button variant="outline" className="border-[#2a3a4d] text-white hover:bg-[#1a2332] text-sm sm:text-base">
                  Tüm Maçlar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Live Matches Section */}
      <section>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Canlı Maçlar</h2>
            <span className="bg-red-500/20 text-red-500 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded">
              {liveMatches.length} CANLI
            </span>
          </div>
          <Link to="/live" className="flex items-center gap-1 text-amber-500 hover:text-amber-400 text-xs sm:text-sm font-medium">
            Tümünü Gör
            <ChevronRight size={14} />
          </Link>
        </div>
        
        <div className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex gap-3 sm:gap-4">
            {liveMatches.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: 'Canlı Maç', value: liveMatches.length, icon: Zap, color: 'text-red-500' },
          { label: 'Bugün', value: upcomingMatches.filter(m => m.date === '2025-07-15').length, icon: Calendar, color: 'text-blue-500' },
          { label: 'En Yüksek', value: '12.50', icon: TrendingUp, color: 'text-green-500' },
          { label: 'Popüler', value: '45+', icon: Star, color: 'text-amber-500' },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#1a2332] flex items-center justify-center ${stat.color}`}>
                <Icon size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming Matches */}
      <section>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-amber-500 sm:w-5 sm:h-5" />
            <h2 className="text-lg sm:text-xl font-bold text-white">Yakın Maçlar</h2>
          </div>
          <Link to="/matches" className="flex items-center gap-1 text-amber-500 hover:text-amber-400 text-xs sm:text-sm font-medium">
            Tümünü Gör
            <ChevronRight size={14} />
          </Link>
        </div>
        
        {/* Mobile: Stack, Desktop: Grid */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {upcomingMatches.slice(0, 4).map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </section>

      {/* Popular Leagues */}
      <section className="pb-4">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Star size={18} className="text-amber-500 sm:w-5 sm:h-5" />
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
              className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-3 sm:p-4 text-center hover:border-amber-500/50 hover:bg-[#1a2332] transition-all group"
            >
              <span className="text-2xl sm:text-3xl block mb-1 sm:mb-2">{league.flag}</span>
              <p className="text-white font-medium text-xs sm:text-sm mb-0.5 sm:mb-1 truncate">{league.name}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">{league.count} maç</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
