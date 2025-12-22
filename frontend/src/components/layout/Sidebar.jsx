import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { sportsCategories, leagues } from '../../data/mockData';
import { Home, Zap, Calendar, Trophy, ChevronRight, Search } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const navItems = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/live', label: 'Canlı Maçlar', icon: Zap, badge: 'CANLI' },
    { path: '/matches', label: 'Tüm Maçlar', icon: Calendar },
  ];

  const footballLeagues = leagues.filter((l) => l.sportId === 1);

  const handleSearch = (e) => {
    e.preventDefault();
    // Search functionality can be implemented here
    console.log('Searching for:', searchQuery);
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
          <div className="p-4">
            {/* Search Bar */}
            <div className="mb-6">
              <form onSubmit={handleSearch} className="relative">
                <Search 
                  size={18} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" 
                />
                <Input
                  type="text"
                  placeholder="Maç, takım veya lig ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#1a2332] border-[#2a3a4d] text-white placeholder:text-gray-500 focus:border-amber-500/50 focus:ring-amber-500/20"
                />
              </form>
            </div>

            {/* Main Navigation */}
            <nav className="space-y-1 mb-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
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
                  </Link>
                );
              })}
            </nav>

            {/* Sports Categories */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                Spor Dalları
              </h3>
              <div className="space-y-1">
                {sportsCategories.map((sport) => (
                  <Link
                    key={sport.id}
                    to={`/sport/${sport.id}`}
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-[#1a2332] hover:text-white transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{sport.icon}</span>
                      <span className="font-medium">{sport.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 bg-[#1a2332] px-2 py-0.5 rounded">
                        {sport.count}
                      </span>
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Popular Leagues */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                Popüler Ligler
              </h3>
              <div className="space-y-1">
                {footballLeagues.slice(0, 6).map((league) => (
                  <Link
                    key={league.id}
                    to={`/league/${league.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-[#1a2332] hover:text-white transition-all"
                  >
                    <span className="text-base">{league.flag}</span>
                    <span className="font-medium text-sm">{league.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </>
  );
};

export default Sidebar;
