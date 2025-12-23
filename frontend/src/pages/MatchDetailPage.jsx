import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBetSlip } from '../context/BetSlipContext';
import { ArrowLeft, Clock, TrendingUp, AlertCircle, ChevronDown, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatchDetails } from '../hooks/useMatches';
import { groupMarketsByCategory, getCategoryOrder } from '../utils/marketCategories';

// Format date for display
function formatMatchDateTime(date, time) {
  if (!date) return time || '';
  
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  if (date === today) {
    return `Bugün ${time || ''}`;
  } else if (date === tomorrow) {
    return `Yarın ${time || ''}`;
  } else {
    // Format as DD.MM.YYYY
    const [year, month, day] = date.split('-');
    return `${day}.${month}.${year} ${time || ''}`.trim();
  }
}

const MatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addSelection, isSelected } = useBetSlip();
  const { match, loading, error } = useMatchDetails(id);
  const [openMarkets, setOpenMarkets] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [logoErrors, setLogoErrors] = useState({ home: false, away: false });
  
  const dateTimeDisplay = useMemo(() => {
    if (!match) return '';
    return formatMatchDateTime(match.date, match.time);
  }, [match?.date, match?.time]);

  // Group markets by category
  const marketsByCategory = useMemo(() => {
    if (!match?.markets) return {};
    return groupMarketsByCategory(match.markets);
  }, [match?.markets]);

  // Get available categories
  const categories = useMemo(() => {
    const cats = Object.keys(marketsByCategory);
    return ['Tümü', ...getCategoryOrder().filter(cat => cats.includes(cat)), ...cats.filter(cat => !getCategoryOrder().includes(cat))];
  }, [marketsByCategory]);

  // Filter markets by selected category
  const filteredMarkets = useMemo(() => {
    if (!match?.markets) return [];
    if (selectedCategory === 'Tümü') return match.markets;
    return marketsByCategory[selectedCategory] || [];
  }, [match?.markets, selectedCategory, marketsByCategory]);

  // Reset logo errors when match changes
  useEffect(() => {
    setLogoErrors({ home: false, away: false });
  }, [match?.id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-10 w-32 mb-6 bg-[#1a2332]" />
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-2xl overflow-hidden">
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48 bg-[#1a2332]" />
            <Skeleton className="h-32 w-full bg-[#1a2332]" />
            <Skeleton className="h-64 w-full bg-[#1a2332]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft size={18} />
          <span>Geri</span>
        </button>
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            {error || 'Maç bulunamadı'}
          </AlertDescription>
        </Alert>
        <div className="text-center py-8">
          <Button 
            variant="outline" 
            className="border-[#2a3a4d] text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} className="mr-2" />
            Geri
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft size={18} />
        <span>Geri</span>
      </button>

      {/* Match Header */}
      <div className="bg-gradient-to-br from-[#1a2332] to-[#0d1117] border border-[#2a3a4d] rounded-2xl overflow-hidden mb-6">
        {/* League */}
        <div className="px-6 py-3 border-b border-[#1e2736] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {match.leagueFlag && match.leagueFlag.startsWith('http') ? (
              <img src={match.leagueFlag} alt={match.league} className="w-6 h-6 object-contain" />
            ) : (
              <span className="text-xl">{match.leagueFlag || '🏆'}</span>
            )}
            <span className="text-gray-400 font-medium">{match.league}</span>
          </div>
          {match.isLive ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-red-500 font-bold">CANLI {match.minute}'</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={16} />
              <span>{dateTimeDisplay}</span>
            </div>
          )}
        </div>

        {/* Score Board */}
        <div className="p-6">
          <div className="flex items-center justify-center gap-8">
            {/* Home Team */}
            <div className="text-center flex-1">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#0a0e14] flex items-center justify-center overflow-hidden">
                {match.homeTeamLogo && !logoErrors.home ? (
                  <img 
                    src={match.homeTeamLogo} 
                    alt={match.homeTeam}
                    className="w-full h-full object-contain p-2"
                    onError={() => setLogoErrors(prev => ({ ...prev, home: true }))}
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">{match.homeTeam.charAt(0)}</span>
                )}
              </div>
              <h3 className="text-white font-bold text-lg">{match.homeTeam}</h3>
            </div>

            {/* Score or Date/Time */}
            <div className="text-center">
              {match.isLive && match.homeScore !== null && match.awayScore !== null ? (
                <div className="text-5xl font-bold text-white">
                  {match.homeScore} - {match.awayScore}
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-500 mb-2">VS</div>
                  <div className="text-sm text-gray-400">
                    <div className="flex items-center justify-center gap-1">
                      <Clock size={14} />
                      <span>{dateTimeDisplay}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="text-center flex-1">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#0a0e14] flex items-center justify-center overflow-hidden">
                {match.awayTeamLogo && !logoErrors.away ? (
                  <img 
                    src={match.awayTeamLogo} 
                    alt={match.awayTeam}
                    className="w-full h-full object-contain p-2"
                    onError={() => setLogoErrors(prev => ({ ...prev, away: true }))}
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">{match.awayTeam.charAt(0)}</span>
                )}
              </div>
              <h3 className="text-white font-bold text-lg">{match.awayTeam}</h3>
            </div>
          </div>
        </div>

        {/* Stats (Live Only) */}
        {match.isLive && match.stats && (
          <div className="px-6 pb-6">
            <div className="bg-[#0a0e14] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-medium">{match.stats.possession[0]}%</span>
                <span className="text-gray-500">Topa Sahip Olma</span>
                <span className="text-white font-medium">{match.stats.possession[1]}%</span>
              </div>
              <Progress value={match.stats.possession[0]} className="h-2 bg-[#1a2332]" />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-medium">{match.stats.shots[0]}</span>
                <span className="text-gray-500">Şut</span>
                <span className="text-white font-medium">{match.stats.shots[1]}</span>
              </div>
              <div className="flex gap-2">
                <div className="h-2 bg-amber-500 rounded" style={{ width: `${(match.stats.shots[0] / (match.stats.shots[0] + match.stats.shots[1])) * 100}%` }}></div>
                <div className="h-2 bg-blue-500 rounded flex-1"></div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-medium">{match.stats.corners[0]}</span>
                <span className="text-gray-500">Korner</span>
                <span className="text-white font-medium">{match.stats.corners[1]}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Markets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-amber-500" />
            Bahis Marketleri
          </h2>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Filter size={16} className="text-gray-400 flex-shrink-0" />
            <div className="flex gap-2 min-w-max">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category);
                    setOpenMarkets({}); // Reset open markets when changing category
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === category
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#1a2332] text-gray-400 hover:bg-[#2a3a4d] hover:text-white'
                  }`}
                >
                  {category}
                  {category !== 'Tümü' && marketsByCategory[category] && (
                    <span className="ml-2 text-xs opacity-75">
                      ({marketsByCategory[category].length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Markets List */}
        <div className="space-y-4">
          {filteredMarkets.length > 0 ? (
            filteredMarkets.map((market, idx) => {
              const marketKey = `${selectedCategory}-${idx}-${market.name}`;
              const isOpen = openMarkets[marketKey] !== undefined ? openMarkets[marketKey] : (idx === 0 && selectedCategory === 'Tümü');
              return (
                <div key={marketKey} className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenMarkets(prev => ({ ...prev, [marketKey]: !isOpen }))}
                    className="w-full px-4 py-3 bg-[#0a0e14] border-b border-[#1e2736] flex items-center justify-between hover:bg-[#141820] transition-colors"
                  >
                    <h3 className="text-white font-medium">{market.name}</h3>
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {market.options.map((opt) => {
                          const selected = isSelected(match.id, market.name, opt.label);
                          const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
                          return (
                            <button
                              key={opt.label}
                              onClick={() => addSelection(match, market.name, opt.label, oddsValue)}
                              className={`flex-1 min-w-[100px] py-3 px-4 rounded-lg text-center transition-all ${
                                selected
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                              }`}
                            >
                              <span className="text-xs text-gray-400 block mb-1">{opt.label}</span>
                              <span className="font-bold text-lg">{oddsValue.toFixed(2)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              Bu kategoride bahis bulunamadı
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchDetailPage;
