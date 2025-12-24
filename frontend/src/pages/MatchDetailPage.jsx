import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBetSlip } from '../context/BetSlipContext';
import { ArrowLeft, Clock, TrendingUp, AlertCircle, ChevronDown, Filter, BarChart3, Users, Award } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatchDetails } from '../hooks/useMatches';
import { groupMarketsByCategory, getCategoryOrder } from '../utils/marketCategories';
import { statpalAPI } from '../services/api';

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
  const [matchStats, setMatchStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'stats', 'odds'
  const [matchOdds, setMatchOdds] = useState(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  
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

  // Calculate stats from match details (events, etc.)
  const calculatedStats = useMemo(() => {
    if (!match) return null;
    
    // Get original StatPal data if available
    const originalData = match.originalData || match;
    
    // Match details from StatPal API has events nested
    let events = [];
    if (originalData.events) {
      if (Array.isArray(originalData.events)) {
        events = originalData.events;
      } else if (originalData.events.event) {
        events = Array.isArray(originalData.events.event) ? originalData.events.event : [originalData.events.event];
      }
    }
    
    if (events.length === 0) return null;
    
    // Calculate statistics from events
    const stats = {
      goals: { home: 0, away: 0 },
      cards: { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } },
      substitutions: { home: 0, away: 0 },
      events: events
    };
    
    events.forEach(event => {
      if (event.type === 'goal') {
        if (event.team === 'home') stats.goals.home++;
        if (event.team === 'away') stats.goals.away++;
      } else if (event.type === 'yellowcard') {
        if (event.team === 'home') stats.cards.home.yellow++;
        if (event.team === 'away') stats.cards.away.yellow++;
      } else if (event.type === 'redcard') {
        if (event.team === 'home') stats.cards.home.red++;
        if (event.team === 'away') stats.cards.away.red++;
      } else if (event.type === 'subst') {
        if (event.team === 'home') stats.substitutions.home++;
        if (event.team === 'away') stats.substitutions.away++;
      }
    });
    
    return stats;
  }, [match]);

  // Fetch match stats from StatPal API (if available)
  useEffect(() => {
    if (match?.id) {
      setStatsLoading(true);
      statpalAPI.getMatchStats(match.id)
        .then(stats => {
          // Only use API stats if they have actual data
          if (stats && Object.keys(stats).length > 0) {
            setMatchStats(stats);
          }
          setStatsLoading(false);
        })
        .catch(err => {
          console.error('Error fetching match stats:', err);
          setStatsLoading(false);
        });
    }
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
              {(match.isLive || match.homeScore > 0 || match.awayScore > 0) && 
               match.homeScore !== null && match.awayScore !== null ? (
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

        {/* Stats (Live Only) - Use StatPal API stats if available */}
        {(match.isLive && (matchStats || match.stats)) && (
          <div className="px-6 pb-6">
            <div className="bg-[#0a0e14] rounded-xl p-4 space-y-3">
              {statsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full bg-[#1a2332]" />
                  <Skeleton className="h-4 w-full bg-[#1a2332]" />
                  <Skeleton className="h-4 w-full bg-[#1a2332]" />
                </div>
              ) : (
                <>
                  {/* Use StatPal stats if available, otherwise fallback to match.stats */}
                  {matchStats ? (
                    <>
                      {matchStats.possession && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white font-medium">{matchStats.possession.home || 0}%</span>
                            <span className="text-gray-500">Topa Sahip Olma</span>
                            <span className="text-white font-medium">{matchStats.possession.away || 0}%</span>
                          </div>
                          <Progress value={matchStats.possession.home || 0} className="h-2 bg-[#1a2332]" />
                        </>
                      )}
                      {matchStats.shots && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white font-medium">{matchStats.shots.home || 0}</span>
                            <span className="text-gray-500">Şut</span>
                            <span className="text-white font-medium">{matchStats.shots.away || 0}</span>
                          </div>
                          <div className="flex gap-2">
                            <div className="h-2 bg-amber-500 rounded" style={{ width: `${((matchStats.shots.home || 0) / ((matchStats.shots.home || 0) + (matchStats.shots.away || 0) || 1)) * 100}%` }}></div>
                            <div className="h-2 bg-blue-500 rounded flex-1"></div>
                          </div>
                        </>
                      )}
                      {matchStats.corners && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white font-medium">{matchStats.corners.home || 0}</span>
                          <span className="text-gray-500">Korner</span>
                          <span className="text-white font-medium">{matchStats.corners.away || 0}</span>
                        </div>
                      )}
                    </>
                  ) : match.stats ? (
                    <>
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
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs for Overview, Stats, Odds */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-[#1e2736]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-amber-500 border-b-2 border-amber-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Genel Bakış
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'stats'
                ? 'text-amber-500 border-b-2 border-amber-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 size={16} className="inline mr-2" />
            İstatistikler
          </button>
          <button
            onClick={() => {
              setActiveTab('odds');
              // Fetch odds when tab is clicked
              if (match?.id && !matchOdds && !oddsLoading) {
                setOddsLoading(true);
                const isInplay = match.isLive;
                statpalAPI.getMatchOdds(match.id, isInplay)
                  .then(odds => {
                    console.log('Odds data received:', odds);
                    // Only set if we have actual data (not empty object)
                    if (odds && (odds.odds || odds.markets || odds.is_market_list || Object.keys(odds).length > 0)) {
                      setMatchOdds(odds);
                    } else {
                      setMatchOdds(null); // Set to null so we show "not available" message
                    }
                    setOddsLoading(false);
                  })
                  .catch(err => {
                    console.error('Error fetching odds:', err);
                    setMatchOdds(null);
                    setOddsLoading(false);
                  });
              }
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'odds'
                ? 'text-amber-500 border-b-2 border-amber-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp size={16} className="inline mr-2" />
            Oranlar
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'stats' && (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6 mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="text-amber-500" />
            Detaylı İstatistikler
          </h3>
          {calculatedStats ? (
            <div className="space-y-6">
              {/* Goals */}
              <div className="bg-[#0a0e14] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Goller</h4>
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div className="text-2xl font-bold text-white">{calculatedStats.goals.home}</div>
                    <div className="text-sm text-gray-400">{match.homeTeam}</div>
                  </div>
                  <div className="text-gray-500 mx-4">-</div>
                  <div className="text-center flex-1">
                    <div className="text-2xl font-bold text-white">{calculatedStats.goals.away}</div>
                    <div className="text-sm text-gray-400">{match.awayTeam}</div>
                  </div>
                </div>
              </div>

              {/* Cards */}
              <div className="bg-[#0a0e14] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Kartlar</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-2">{match.homeTeam}</div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-yellow-500 rounded"></span>
                        <span className="text-white">{calculatedStats.cards.home.yellow}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-red-500 rounded"></span>
                        <span className="text-white">{calculatedStats.cards.home.red}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-2">{match.awayTeam}</div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-yellow-500 rounded"></span>
                        <span className="text-white">{calculatedStats.cards.away.yellow}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-red-500 rounded"></span>
                        <span className="text-white">{calculatedStats.cards.away.red}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Substitutions */}
              <div className="bg-[#0a0e14] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Oyuncu Değişiklikleri</h4>
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div className="text-xl font-bold text-white">{calculatedStats.substitutions.home}</div>
                    <div className="text-sm text-gray-400">{match.homeTeam}</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-xl font-bold text-white">{calculatedStats.substitutions.away}</div>
                    <div className="text-sm text-gray-400">{match.awayTeam}</div>
                  </div>
                </div>
              </div>

              {/* Match Events Timeline */}
              {calculatedStats.events && calculatedStats.events.length > 0 && (
                <div className="bg-[#0a0e14] rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">Maç Olayları</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {calculatedStats.events
                      .sort((a, b) => {
                        const minuteA = parseInt(a.minute || 0) + (parseInt(a.extra_min || 0) / 100);
                        const minuteB = parseInt(b.minute || 0) + (parseInt(b.extra_min || 0) / 100);
                        return minuteA - minuteB;
                      })
                      .map((event, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500 w-12 text-right">
                            {event.minute}'{event.extra_min ? `+${event.extra_min}` : ''}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${
                            event.team === 'home' ? 'bg-blue-500' : 'bg-red-500'
                          }`}></div>
                          <span className="text-white flex-1">
                            {event.type === 'goal' && '⚽'}
                            {event.type === 'yellowcard' && '🟨'}
                            {event.type === 'redcard' && '🟥'}
                            {event.type === 'subst' && '🔄'}
                            {event.type === 'var' && '📺'}
                            {' '}
                            {event.player || event.player_on || event.assist_player || 'Olay'}
                            {event.type === 'subst' && ` (${event.player_off} → ${event.player_on})`}
                            {event.type === 'goal' && event.result && ` ${event.result}`}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400">Bu maç için istatistik mevcut değil.</p>
          )}
        </div>
      )}

      {/* Odds Tab Content */}
      {activeTab === 'odds' && (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6 mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-amber-500" />
            Bahis Oranları {match?.isLive ? '(Canlı)' : '(Maç Öncesi)'}
          </h3>
          {oddsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full bg-[#1a2332]" />
              <Skeleton className="h-20 w-full bg-[#1a2332]" />
            </div>
          ) : matchOdds && Object.keys(matchOdds).length > 0 ? (
            <div className="space-y-4">
              {/* Parse and display odds data */}
              {(() => {
                console.log('MatchOdds data:', matchOdds);
                console.log('Has odds array:', matchOdds.odds && Array.isArray(matchOdds.odds));
                console.log('Is market list:', matchOdds.is_market_list);
                
                // Check if this is StatPal API odds format (live_match.odds)
                if (matchOdds.odds && Array.isArray(matchOdds.odds) && matchOdds.odds.length > 0) {
                  // StatPal API format: { odds: [{ market_id, market_name, lines: [{ name, odd, handicap }] }] }
                  return (
                    <div className="space-y-4">
                      {matchOdds.odds.map((market, idx) => (
                        <div key={idx} className="bg-[#0a0e14] rounded-lg p-4 border border-[#1e2736]">
                          <h4 className="text-white font-semibold mb-3 flex items-center justify-between">
                            <span>{market.market_name || `Market ${market.market_id}`}</span>
                            {market.suspended === "1" && (
                              <span className="text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded">Askıya Alındı</span>
                            )}
                          </h4>
                          {market.lines && market.lines.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {market.lines
                                .filter(line => line.suspended !== "1")
                                .map((line, lineIdx) => (
                                <div key={lineIdx} className="bg-[#1a2332] rounded-lg p-3 text-center hover:bg-[#2a3a4d] transition-colors cursor-pointer">
                                  <div className="text-xs text-gray-400 mb-1">
                                    {line.name}
                                    {line.handicap && ` (${line.handicap})`}
                                  </div>
                                  <div className="text-xl font-bold text-white">
                                    {parseFloat(line.odd || 0).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 text-sm">Bu market için oran bulunmuyor.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }
                
                // Check if this is a market list response (fallback when odds not available)
                if (matchOdds.is_market_list && Array.isArray(matchOdds.markets)) {
                  return (
                    <div className="space-y-4">
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                        <p className="text-amber-500 text-sm font-medium mb-2">
                          ℹ️ Mevcut Bahis Marketleri
                        </p>
                        <p className="text-gray-400 text-xs">
                          StatPal API'den mevcut market listesi alındı. Bu maç için odds verisi henüz mevcut değil.
                          <br />
                          <span className="text-amber-500">Not:</span> Odds verisi genellikle maç başladıktan sonra güncellenir.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {matchOdds.markets.map((market, idx) => (
                          <div key={idx} className="bg-[#0a0e14] rounded-lg p-3 border border-[#1e2736]">
                            <div className="text-white font-medium text-sm">{market.name}</div>
                            <div className="text-xs text-gray-500 mt-1">ID: {market.id}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                
                // Try to extract markets from other API response formats
                const markets = matchOdds.markets || matchOdds.bookmakers || matchOdds.data || [];
                const oddsData = matchOdds.odds || matchOdds;
                
                if (Array.isArray(markets) && markets.length > 0) {
                  return (
                    <div className="space-y-4">
                      {markets.map((market, idx) => (
                        <div key={idx} className="bg-[#0a0e14] rounded-lg p-4">
                          <h4 className="text-white font-semibold mb-3">{market.name || market.market_name || 'Bahis Marketi'}</h4>
                          <div className="flex flex-wrap gap-2">
                            {market.options && market.options.map((opt, optIdx) => (
                              <div key={optIdx} className="bg-[#1a2332] rounded-lg p-3 min-w-[100px] text-center">
                                <div className="text-xs text-gray-400 mb-1">{opt.label || opt.name || opt.outcome}</div>
                                <div className="text-lg font-bold text-white">
                                  {typeof opt.value === 'number' ? opt.value.toFixed(2) : parseFloat(opt.value || opt.price || opt.odd || 0).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                } else if (oddsData && typeof oddsData === 'object') {
                  // Try to extract h2h odds
                  const homeOdds = oddsData.home || oddsData.homeWin || oddsData['1'] || oddsData.HomeWin;
                  const drawOdds = oddsData.draw || oddsData.Draw;
                  const awayOdds = oddsData.away || oddsData.awayWin || oddsData['2'] || oddsData.AwayWin;
                  
                  if (homeOdds || drawOdds || awayOdds) {
                    return (
                      <div className="bg-[#0a0e14] rounded-lg p-4">
                        <h4 className="text-white font-semibold mb-3">Maç Sonucu</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {homeOdds && (
                            <div className="bg-[#1a2332] rounded-lg p-4 text-center">
                              <div className="text-xs text-gray-400 mb-2">{match.homeTeam}</div>
                              <div className="text-2xl font-bold text-white">{parseFloat(homeOdds).toFixed(2)}</div>
                            </div>
                          )}
                          {drawOdds && (
                            <div className="bg-[#1a2332] rounded-lg p-4 text-center">
                              <div className="text-xs text-gray-400 mb-2">Beraberlik</div>
                              <div className="text-2xl font-bold text-white">{parseFloat(drawOdds).toFixed(2)}</div>
                            </div>
                          )}
                          {awayOdds && (
                            <div className="bg-[#1a2332] rounded-lg p-4 text-center">
                              <div className="text-xs text-gray-400 mb-2">{match.awayTeam}</div>
                              <div className="text-2xl font-bold text-white">{parseFloat(awayOdds).toFixed(2)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                }
                
                // Fallback: show raw JSON
                return (
                  <>
                    <pre className="text-xs text-gray-500 overflow-auto bg-[#0a0e14] p-4 rounded max-h-96">
                      {JSON.stringify(matchOdds, null, 2)}
                    </pre>
                    <p className="text-gray-400 text-sm mt-2">
                      StatPal API'den oran verisi alındı. Veri formatı tanınmadı, ham veri gösteriliyor.
                    </p>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
              <TrendingUp size={32} className="text-blue-500 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Bahis Oranları Mevcut Değil</h3>
              <p className="text-gray-400 text-sm mb-3">
                Bu maç için bahis oranları şu anda mevcut değildir. StatPal API'den oran verisi çekilemedi.
              </p>
              {match?.inplay_odds_running === 'True' && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-amber-500 text-sm font-medium">
                    ⚠️ Not: Bu maç için canlı oranlar aktif olarak işaretlenmiş, ancak StatPal API'den oran verisi çekilemedi.
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    StatPal API'nin odds endpoint'leri premium plan gerektiriyor olabilir veya farklı bir endpoint formatı kullanılıyor olabilir.
                    <br />
                    Lütfen StatPal API dokümantasyonunu kontrol edin veya destek ekibi ile iletişime geçin.
                  </p>
                </div>
              )}
              <div className="mt-4 text-xs text-gray-500">
                <p>Denenen endpoint'ler:</p>
                <code className="block mt-1 bg-[#0a0e14] px-2 py-1 rounded text-left">
                  {match?.isLive ? '/soccer/odds/live-markets' : '/soccer/odds/pre-match'}
                  <br />
                  {match?.isLive ? '/soccer/matches/{id}/odds/live' : '/soccer/matches/{id}/odds'}
                </code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Markets - Only show if markets exist */}
      {match.markets && match.markets.length > 0 && (
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
      )}
      
      {/* Info message if no markets available */}
      {(!match.markets || match.markets.length === 0) && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
          <TrendingUp size={32} className="text-blue-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">Bahis Oranları Mevcut Değil</h3>
          <p className="text-gray-400 text-sm">
            Bu maç için bahis oranları şu anda mevcut değildir. Maç bilgileri ve skorları yukarıda gösterilmektedir.
          </p>
        </div>
      )}
    </div>
  );
};

export default MatchDetailPage;
