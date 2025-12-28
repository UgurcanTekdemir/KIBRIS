import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBetSlip } from '../context/BetSlipContext';
import { ArrowLeft, Clock, TrendingUp, AlertCircle, Filter, Activity, Target } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatchDetails } from '../hooks/useMatches';
import { useLiveMatchEvents } from '../hooks/useLiveMatchEvents';
import { useLiveMatchStatistics } from '../hooks/useLiveMatchStatistics';
import { useOddsTracking } from '../hooks/useOddsTracking';
import { matchAPI } from '../services/api';
import { groupMarketsByCategory, getCategoryOrder } from '../utils/marketCategories';
import { getTeamImagePath, getFallbackIcon } from '../utils/imageUtils';

// Format date for display - always show actual date, not "Bugün" or "Yarın"
function formatMatchDateTime(date, time) {
  if (!date) return time || '';
  
    // Format as DD.MM.YYYY
    const [year, month, day] = date.split('-');
  const formattedDate = `${day}.${month}.${year}`;
  
  if (time) {
    return `${formattedDate} ${time}`;
  }
  return formattedDate;
}

/**
 * Transform Sportmonks V3 statistics array to component format
 * @param {Array} statsArray - Statistics array from Sportmonks V3
 * @param {number} homeTeamId - Home team participant ID
 * @param {number} awayTeamId - Away team participant ID
 * @returns {Object} Transformed statistics object
 */
function transformSportmonksStatistics(statsArray, homeTeamId, awayTeamId) {
  if (!Array.isArray(statsArray) || statsArray.length === 0) {
    return null;
  }
  
  const result = {
    possession: null,
    shots: null,
    corners: null,
    attacks: null,
  };
  
  // Group statistics by participant_id
  const homeStats = {};
  const awayStats = {};
  
  for (const stat of statsArray) {
    const participantId = stat.participant_id;
    const statType = stat.type?.name || stat.type_name || '';
    const value = parseFloat(stat.value) || 0;
    
    if (participantId === homeTeamId) {
      homeStats[statType.toLowerCase()] = value;
    } else if (participantId === awayTeamId) {
      awayStats[statType.toLowerCase()] = value;
    }
  }
  
  // Map common statistic names
  const statMappings = {
    'possession': 'possession',
    'ball possession': 'possession',
    'ball_possession': 'possession',
    'shots on goal': 'shots',
    'shots on target': 'shots',
    'shots_on_goal': 'shots',
    'shots_on_target': 'shots',
    'total shots': 'shots',
    'total_shots': 'shots',
    'corner kicks': 'corners',
    'corner_kicks': 'corners',
    'corners': 'corners',
    'attacks': 'attacks',
    'dangerous attacks': 'attacks',
    'dangerous_attacks': 'attacks',
  };
  
  // Extract statistics
  for (const [key, value] of Object.entries(homeStats)) {
    const mappedKey = statMappings[key] || key;
    if (mappedKey === 'possession') {
      result.possession = [value, awayStats[key] || 0];
    } else if (mappedKey === 'shots') {
      result.shots = [value, awayStats[key] || 0];
    } else if (mappedKey === 'corners') {
      result.corners = [value, awayStats[key] || 0];
    } else if (mappedKey === 'attacks') {
      result.attacks = [value, awayStats[key] || 0];
    }
  }
  
  // If we didn't find stats, try to extract from away stats
  for (const [key, value] of Object.entries(awayStats)) {
    const mappedKey = statMappings[key] || key;
    if (!result[mappedKey] && mappedKey in result) {
      result[mappedKey] = [homeStats[key] || 0, value];
    }
  }
  
  return result;
}

const MatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addSelection, isSelected } = useBetSlip();
  const { match, loading, error } = useMatchDetails(id);
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [logoErrors, setLogoErrors] = useState({ home: false, away: false });
  const [activeTab, setActiveTab] = useState('markets'); // 'markets', 'events', 'stats'
  
  // Debug logs removed for production optimization
  
  // Fetch events and statistics only for live or finished matches
  const shouldFetchEvents = match?.isLive || match?.isFinished;
  const { events } = useLiveMatchEvents(id, shouldFetchEvents, match?.isLive ? 12000 : 60000);
  const { statistics: rawStatistics } = useLiveMatchStatistics(id, shouldFetchEvents, match?.isLive ? 30000 : 60000);
  
  // Transform Sportmonks V3 statistics array to component format
  const statistics = useMemo(() => {
    if (!rawStatistics) return null;
    
    // If it's already in the expected format (object with possession, shots, etc.)
    if (rawStatistics.possession || rawStatistics.shots) {
      return rawStatistics;
    }
    
    // If it's an array (Sportmonks V3 format), transform it
    if (Array.isArray(rawStatistics)) {
      return transformSportmonksStatistics(rawStatistics, match?.home_team_id, match?.away_team_id);
    }
    
    return null;
  }, [rawStatistics, match?.home_team_id, match?.away_team_id]);
  
  // Track odds changes
  const { getOddsChange } = useOddsTracking(id, match, match?.isLive ? 5000 : 30000);
  
  const dateTimeDisplay = useMemo(() => {
    if (!match) return '';
    return formatMatchDateTime(match.date, match.time);
  }, [match]);

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

  if (error || (!loading && !match)) {
    return (
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft size={16} className="mr-2" />
          Geri Dön
        </Button>
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Maç Bulunamadı</h3>
          <p className="text-gray-500 mb-4">
            {error || 'Bu maçın detayları şu anda mevcut değil. Maç listesine dönerek başka bir maç seçebilirsiniz.'}
          </p>
          <Button
            onClick={() => navigate('/matches')}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            Maçlara Dön
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
                  <span className="text-2xl font-bold text-white">{getFallbackIcon(match.homeTeam)}</span>
                )}
              </div>
              <h3 className="text-white font-bold text-lg">{match.homeTeam}</h3>
            </div>

            {/* Score or Date/Time */}
            <div className="text-center">
              {(match.isLive || match.isFinished) && match.homeScore !== null && match.awayScore !== null ? (
                <div>
                  <div className="text-5xl font-bold text-white mb-2">
                  {match.homeScore} - {match.awayScore}
                  </div>
                  {match.isFinished && (
                    <div className="text-xs text-gray-500 font-medium">Maç Bitti</div>
                  )}
                  {match.isLive && match.minute && (
                    <div className="text-xs text-red-500 font-medium">{match.minute}'</div>
                  )}
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
                  <span className="text-2xl font-bold text-white">{getFallbackIcon(match.awayTeam)}</span>
                )}
              </div>
              <h3 className="text-white font-bold text-lg">{match.awayTeam}</h3>
            </div>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden mb-6">
        <div className="flex border-b border-[#1e2736] overflow-x-auto scrollbar-hide">
          {[
            { id: 'markets', label: 'Bahis Oranları', icon: TrendingUp, show: true },
            { id: 'events', label: 'Olaylar', icon: Target, show: shouldFetchEvents },
            { id: 'stats', label: 'İstatistikler', icon: Activity, show: shouldFetchEvents },
          ].filter(tab => tab.show).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'text-amber-500 border-b-2 border-amber-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Markets Tab */}
          {activeTab === 'markets' && (
            <div className="space-y-4">
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

              {/* Markets List - All markets displayed without dropdowns */}
              <div className="space-y-6">
                {filteredMarkets.length > 0 ? (
                  filteredMarkets.map((market, idx) => {
                    const marketKey = `${selectedCategory}-${idx}-${market.name}`;
                    return (
                      <div key={marketKey} className="bg-[#0a0e14] border border-[#1e2736] rounded-xl p-3">
                        <h3 className="text-white font-semibold text-sm mb-3">{market.name}</h3>
                        <div className="flex flex-wrap gap-2">
                          {market.options
                            .filter(opt => {
                              const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
                              return oddsValue > 0;
                            })
                            .map((opt, optIdx) => {
                              const selected = isSelected(match.id, market.name, opt.label);
                              const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
                              
                              // Get odds change indicator
                              const oddsChange = getOddsChange(market.name, opt.label);
                              
                              return (
                                <button
                                  key={`${market.name}-${opt.label}-${optIdx}`}
                                  onClick={() => addSelection(match, market.name, opt.label, oddsValue)}
                                  className={`min-w-[80px] flex-1 max-w-[140px] py-2 px-3 rounded-lg text-center transition-all ${
                                    selected
                                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/50'
                                      : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white hover:border-amber-500/50 border border-transparent'
                                  }`}
                                >
                                  <span className="text-xs text-gray-300 block mb-1">{opt.label}</span>
                                  <span className="font-bold text-base flex items-center justify-center gap-1">
                                    {oddsChange && oddsChange.direction === 'up' && (
                                      <ArrowUp size={14} className="text-green-500" />
                                    )}
                                    {oddsChange && oddsChange.direction === 'down' && (
                                      <ArrowDown size={14} className="text-red-500" />
                                    )}
                                    {oddsValue.toFixed(2)}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {match.markets && match.markets.length > 0 
                      ? 'Bu kategoride bahis bulunamadı'
                      : 'Bu maç için bahis oranları henüz mevcut değil'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div className="space-y-3">
              {events && events.length > 0 ? (
                events
                  .sort((a, b) => {
                    const aMin = parseInt(a.minute || a.time || a.elapsed || 0);
                    const bMin = parseInt(b.minute || b.time || b.elapsed || 0);
                    return bMin - aMin;
                  })
                  .map((event, idx) => {
                    const minute = event.minute || event.time || event.elapsed || '?';
                    const type = event.type || event.event_type || '';
                    const player = event.player || event.player_name || '';
                    const team = event.team || event.team_name || '';
                    const isHome = team === match.homeTeam;
                    
                    let icon = '⚽';
                    let typeText = type;
                    
                    // Translate event types to Turkish
                    const typeLower = type.toLowerCase();
                    if (typeLower.includes('card') || typeLower.includes('kart')) {
                      if (typeLower.includes('yellow') || typeLower.includes('sarı')) {
                        icon = '🟨';
                        typeText = 'Sarı Kart';
                      } else {
                        icon = '🟥';
                        typeText = 'Kırmızı Kart';
                      }
                    } else if (typeLower.includes('sub') || typeLower.includes('değişiklik') || typeLower.includes('substitution')) {
                      icon = '🔄';
                      typeText = 'Oyuncu Değişikliği';
                    } else if (typeLower.includes('goal') || typeLower.includes('gol')) {
                      icon = '⚽';
                      typeText = 'Gol';
                    } else if (typeLower.includes('penalty') || typeLower.includes('penaltı')) {
                      icon = '⚽';
                      typeText = 'Penaltı';
                    } else if (typeLower.includes('corner') || typeLower.includes('korner')) {
                      icon = '📐';
                      typeText = 'Korner';
                    } else if (typeLower.includes('offside') || typeLower.includes('ofsayt')) {
                      icon = '🚩';
                      typeText = 'Ofsayt';
                    } else if (type) {
                      // Keep original if no match
                      typeText = type;
                    }
                    
                    return (
                      <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg ${isHome ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                        <span className="text-base">{icon}</span>
                        <div className="flex-1">
                          <div className="text-white font-medium text-sm">{player || 'Oyuncu'}</div>
                          <div className="text-xs text-gray-400">{typeText}</div>
                        </div>
                        <span className="text-gray-400 font-medium text-xs">{minute}'</span>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {match.isLive ? 'Henüz olay yok' : 'Bu maç için olay bulunamadı'}
                </div>
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <div>
              {statistics ? (
                <div className="space-y-4">
                  {/* Possession */}
                  {statistics.possession && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.possession[0] || statistics.possession.home || 0}%</span>
                        <span className="text-gray-500">Topa Sahip Olma</span>
                        <span className="text-white font-medium">{statistics.possession[1] || statistics.possession.away || 0}%</span>
                      </div>
                      <Progress value={statistics.possession[0] || statistics.possession.home || 0} className="h-2 bg-[#1a2332]" />
                    </div>
                  )}

                  {/* Shots */}
                  {statistics.shots && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.shots[0] || statistics.shots.home || 0}</span>
                        <span className="text-gray-500">Şut</span>
                        <span className="text-white font-medium">{statistics.shots[1] || statistics.shots.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.shots[0] || statistics.shots.home || 0) / ((statistics.shots[0] || statistics.shots.home || 0) + (statistics.shots[1] || statistics.shots.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Corners */}
                  {statistics.corners && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.corners[0] || statistics.corners.home || 0}</span>
                        <span className="text-gray-500">Korner</span>
                        <span className="text-white font-medium">{statistics.corners[1] || statistics.corners.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.corners[0] || statistics.corners.home || 0) / ((statistics.corners[0] || statistics.corners.home || 0) + (statistics.corners[1] || statistics.corners.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Additional stats */}
                  {statistics.attacks && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.attacks[0] || statistics.attacks.home || 0}</span>
                        <span className="text-gray-500">Atak</span>
                        <span className="text-white font-medium">{statistics.attacks[1] || statistics.attacks.away || 0}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  İstatistik bilgisi henüz mevcut değil
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchDetailPage;
