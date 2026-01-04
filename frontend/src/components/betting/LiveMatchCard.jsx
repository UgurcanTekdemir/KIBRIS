import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBetSlip } from '../../context/BetSlipContext';
import { useLiveMatchEvents } from '../../hooks/useLiveMatchEvents';
import { useLiveMatchStatistics } from '../../hooks/useLiveMatchStatistics';
import { useOddsTracking } from '../../hooks/useOddsTracking';
import { 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  ArrowUp, 
  ArrowDown,
  Target,
  UserCheck,
  AlertCircle,
  Circle,
  ArrowRight
} from 'lucide-react';
import { shouldLockBetting } from '../../utils/liveMatchSafety';

// Get event icon component and color
function getEventIcon(event) {
  // Check multiple possible fields for event type
  // Sportmonks API returns type as nested object: { type: { name: "...", type: "..." } }
  const typeName = (
    event.type?.name ||           // Primary: type.name from nested object
    event.type?.type ||           // Alternative: type.type
    (typeof event.type === 'string' ? event.type : '') ||  // If type is string directly
    event.event_type?.name ||
    event.event_type?.type ||
    (typeof event.event_type === 'string' ? event.event_type : '') ||
    event.name ||
    ''
  ).toLowerCase();
  
  // Debug: Log event type for troubleshooting
  if (process.env.NODE_ENV === 'development') {
    console.log('Event type detection:', {
      typeName,
      typeObject: event.type,
      event_type: event.event_type,
      name: event.name,
      hasPlayerOut: !!event.player_out,
      hasPlayerIn: !!event.player_in,
      fullEvent: event
    });
  }
  
  // Substitution - check first as it's most specific
  if (typeName.includes('substitution') || 
      typeName.includes('sub') || 
      typeName.includes('değişiklik') ||
      event.player_out ||
      event.player_in ||
      event.player_out_name ||
      event.player_in_name ||
      event.player_out?.name ||
      event.player_in?.name) {
    return { Icon: UserCheck, color: 'text-blue-500', bgColor: 'bg-blue-500/10' };
  }
  
  // Goal events
  if (typeName.includes('goal') || typeName.includes('gol')) {
    return { Icon: Target, color: 'text-green-500', bgColor: 'bg-green-500/10' };
  }
  
  // Yellow card
  if (typeName.includes('yellow') || 
      (typeName.includes('card') && typeName.includes('yellow')) ||
      typeName === 'yellowcard' ||
      typeName === 'yellow card') {
    return { Icon: AlertCircle, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
  }
  
  // Red card
  if (typeName.includes('red') || 
      (typeName.includes('card') && typeName.includes('red')) ||
      typeName === 'redcard' ||
      typeName === 'red card') {
    return { Icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' };
  }
  
  // Penalty
  if (typeName.includes('penalty') || typeName.includes('penaltı')) {
    return { Icon: Target, color: 'text-purple-500', bgColor: 'bg-purple-500/10' };
  }
  
  // Corner
  if (typeName.includes('corner') || typeName.includes('korner')) {
    return { Icon: Circle, color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
  }
  
  // Offside
  if (typeName.includes('offside') || typeName.includes('ofsayt')) {
    return { Icon: AlertCircle, color: 'text-gray-500', bgColor: 'bg-gray-500/10' };
  }
  
  // Default - use Circle as fallback
  return { Icon: Circle, color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
}

// Format event text with proper structure
function formatEvent(event, homeTeam, awayTeam) {
  const minute = event.minute || event.time || event.elapsed || '';
  
  // Player can be nested: event.player.name or direct: event.player
  // Check multiple possible field names for player information
  const player = (
    event.player?.name || 
    event.player?.fullname ||
    event.player?.display_name ||
    (typeof event.player === 'string' ? event.player : '') ||
    event.player_name || 
    event.playerName ||
    event.name || // Sometimes event name contains player name
    ''
  );
  
  // Team can be nested: event.team.name or direct: event.team
  const team = (
    event.team?.name || 
    (typeof event.team === 'string' ? event.team : '') ||
    event.team_name || 
    ''
  );
  
  // Check multiple possible fields for event type
  // Sportmonks API returns type as nested object: { type: { name: "...", type: "..." } }
  const typeName = (
    event.type?.name ||           // Primary: type.name from nested object
    event.type?.type ||           // Alternative: type.type
    (typeof event.type === 'string' ? event.type : '') ||  // If type is string directly
    event.event_type?.name ||
    event.event_type?.type ||
    (typeof event.event_type === 'string' ? event.event_type : '') ||
    event.name ||
    ''
  ).toLowerCase();
  
  const isHome = team === homeTeam || team?.toLowerCase() === homeTeam?.toLowerCase();
  
  const iconResult = getEventIcon(event);
  const { Icon, color, bgColor } = iconResult;
  
  // Debug: Verify Icon is a valid React component
  if (process.env.NODE_ENV === 'development') {
    // Log Icon type for debugging
    console.log('Icon check in formatEvent:', {
      Icon,
      IconType: typeof Icon,
      IconIsFunction: typeof Icon === 'function',
      IconName: Icon?.name || Icon?.displayName || 'unknown',
      iconResult,
      eventType: event.type,
      typeName
    });
  }
  
  // Substitution handling - check for player_out/player_in first
  // Check multiple possible field names for player_out and player_in
  const playerOut = (
    event.player_out?.name || 
    (typeof event.player_out === 'string' ? event.player_out : '') ||
    event.player_out_name ||
    event.playerOut?.name ||
    (typeof event.playerOut === 'string' ? event.playerOut : '') ||
    event.playerOutName ||
    ''
  );
  const playerIn = (
    event.player_in?.name || 
    (typeof event.player_in === 'string' ? event.player_in : '') ||
    event.player_in_name ||
    event.playerIn?.name ||
    (typeof event.playerIn === 'string' ? event.playerIn : '') ||
    event.playerInName ||
    ''
  );
  
  // Check if this is a substitution event
  const isSubstitution = typeName.includes('substitution') || 
                         typeName.includes('sub') || 
                         typeName.includes('değişiklik') ||
                         playerOut ||
                         playerIn;
  
  if (isSubstitution) {
    return {
      minute,
      Icon,
      iconColor: color,
      iconBg: bgColor,
      type: 'substitution',
      playerOut: playerOut || player, // Use player as fallback for playerOut
      playerIn: playerIn || '', // Don't use player as fallback for playerIn
      isHome
    };
  }
  
  // Goal handling
  if (typeName.includes('goal') || typeName.includes('gol')) {
    // For goals, ensure we have player information
    // If player is empty, try to get it from other fields
    const goalPlayer = player || 
                      event.goal_scorer?.name ||
                      event.goalscorer?.name ||
                      event.scorer?.name ||
                      event.assist?.name || // Sometimes assist info is available
                      'Gol';
    
    return {
      minute,
      Icon,
      iconColor: color,
      iconBg: bgColor,
      type: 'goal',
      player: goalPlayer,
      isHome
    };
  }
  
  // Card handling
  if (typeName.includes('card') || typeName.includes('kart')) {
    const cardType = typeName.includes('yellow') || typeName.includes('sarı') ? 'yellow' : 'red';
    return {
      minute,
      Icon,
      iconColor: color,
      iconBg: bgColor,
      type: 'card',
      cardType,
      player,
      isHome
    };
  }
  
  // Other events
  return {
    minute,
    Icon,
    iconColor: color,
    iconBg: bgColor,
    type: 'other',
    player,
    eventType: event.type?.name || event.type || event.event_type || '',
    isHome
  };
}

const LiveMatchCard = ({ match }) => {
  const { addSelection, isSelected } = useBetSlip();
  const [expanded, setExpanded] = useState(false);
  
  const { events } = useLiveMatchEvents(match.id, match.isLive, 12000);
  const { statistics } = useLiveMatchStatistics(match.id, match.isLive, 30000);
  
  // Filter for Market ID 1 (Match Winner / Fulltime Result)
  const mainMarket = match.markets?.find(m => m.marketId === 1) || match.markets?.[0];

  // Track odds changes
  const { getOddsChange } = useOddsTracking(match.id, match, 5000);
  
  // Translate odds labels to Turkish
  const translateOddsLabel = (label) => {
    if (!label) return label;
    const labelLower = label.toLowerCase().trim();
    
    // Translate common English labels to Turkish
    if (labelLower === 'home' || label === '1') return '1';
    if (labelLower === 'away' || label === '2') return '2';
    if (labelLower === 'draw' || label === 'x' || label === 'X') return 'X';
    
    // If already in Turkish format, return as is
    if (label === 'Beraberlik' || label === 'X' || label === '1' || label === '2') {
      // Convert Beraberlik to X for display
      return label === 'Beraberlik' ? 'X' : label;
    }
    
    // Fallback: try to translate
    return label
      .replace(/home/gi, '1')
      .replace(/away/gi, '2')
      .replace(/draw/gi, 'X')
      .replace(/beraberlik/gi, 'X');
  };
  
  // Sort options to always show in order: 1, X, 2
  const sortOptions = (options) => {
    if (!options || !Array.isArray(options)) return options;
    
    const getSortOrder = (label) => {
      if (!label) return 999;
      const labelLower = label.toLowerCase().trim();
      // Home/1 should be first
      if (labelLower === 'home' || label === '1') return 1;
      // Draw/X/Beraberlik should be second
      if (labelLower === 'draw' || label === 'x' || label === 'X' || label === 'Beraberlik' || labelLower === 'beraberlik') return 2;
      // Away/2 should be third
      if (labelLower === 'away' || label === '2') return 3;
      return 999;
    };
    
    return [...options].sort((a, b) => {
      const orderA = getSortOrder(a.label);
      const orderB = getSortOrder(b.label);
      return orderA - orderB;
    });
  };
  
  // Get current minute and second directly from match (API provides accurate data)
  // Don't show minute if match is finished or in half-time break
  const currentTime = useMemo(() => {
    // If match is finished, don't show time
    if (match.isFinished) {
      return null;
    }
    
    // Check if match is in half-time break (HT/HALF_TIME status)
    const status = (match.status || '').toUpperCase();
    if (status === 'HT' || status === 'HALF_TIME') {
      return null; // Don't show time during half-time break
    }
    
    // Only show time if match is live
    if (!match.isLive) {
      return null;
    }
    
    // Use match.minute and match.second directly from API (most accurate)
    const matchMinute = match.minute ? parseInt(match.minute, 10) : null;
    const matchSecond = match.second !== null && match.second !== undefined ? parseInt(match.second, 10) : null;
    
    // Format minute: 45-50 -> "45+", 90-95 -> "90+"
    if (matchMinute !== null) {
      let minuteStr = '';
      if (matchMinute >= 45 && matchMinute < 50) {
        minuteStr = '45+';
      } else if (matchMinute >= 90 && matchMinute < 95) {
        minuteStr = '90+';
      } else {
        minuteStr = `${matchMinute}'`;
      }
      
      // Add second if available
      if (matchSecond !== null && matchSecond >= 0 && matchSecond <= 59) {
        return `${minuteStr} ${matchSecond}"`;
      }
      
      return minuteStr;
    }
    
    return null;
  }, [match.minute, match.second, match.isFinished, match.isLive, match.status]);

  // Check if betting should be locked due to dangerous situations
  const lockStatus = useMemo(() => {
    return shouldLockBetting(match, events, statistics);
  }, [match, events, statistics]);
  
  // Get recent events (last 3-5)
  // Include all events: goals, substitutions, cards, etc.
  const recentEvents = useMemo(() => {
    if (!events || events.length === 0) return [];
    
    const filtered = events
      .filter(e => {
        // Include events that have a minute/time OR are important events (goals, cards, substitutions)
        const hasTime = e.minute || e.time || e.elapsed;
        const hasType = e.type || e.event_type;
        const isImportant = hasType; // Include all events with type information
        
        return hasTime || isImportant;
      })
      .sort((a, b) => {
        // Sort by minute descending (most recent first)
        const aMin = parseInt(a.minute || a.time || a.elapsed || 0);
        const bMin = parseInt(b.minute || b.time || b.elapsed || 0);
        return bMin - aMin;
      })
      .slice(0, 5);
    
    // Debug: Log events structure
    if (process.env.NODE_ENV === 'development' && filtered.length > 0) {
      console.log('Recent events structure:', filtered.map(e => {
        const typeName = (e.type?.name || e.type || e.event_type || '').toLowerCase();
        const isGoal = typeName.includes('goal') || typeName.includes('gol');
        return {
          minute: e.minute,
          type: e.type,
          event_type: e.event_type,
          typeName: e.type?.name || e.type || e.event_type,
          player: e.player,
          playerName: e.player?.name,
          playerFullname: e.player?.fullname,
          player_name: e.player_name,
          player_out: e.player_out,
          player_in: e.player_in,
          name: e.name,
          isGoal,
          fullEvent: e
        };
      }));
    }
    
    return filtered;
  }, [events]);
  
  // Extract key statistics
  const keyStats = useMemo(() => {
    if (!statistics) return null;
    
    // StatPal statistics format may vary, try common fields
    let stats = statistics;
    
    // Handle different response structures
    if (Array.isArray(statistics)) {
      stats = statistics;
    } else if (statistics.statistics && Array.isArray(statistics.statistics)) {
      stats = statistics.statistics;
    } else if (statistics.stats && Array.isArray(statistics.stats)) {
      stats = statistics.stats;
    } else if (statistics.data && Array.isArray(statistics.data)) {
      stats = statistics.data;
    }
    
    if (!Array.isArray(stats)) return null;
    
    const possession = stats.find(s => {
      const type = (s.type || s.name || s.statistic || '').toLowerCase();
      return type.includes('possession') || type.includes('ball possession');
    });
    
    const shots = stats.find(s => {
      const type = (s.type || s.name || s.statistic || '').toLowerCase();
      return type.includes('shots on target') || type.includes('shots on goal') || 
             (type.includes('shots') && type.includes('target'));
    });
    
    // Extract values - handle different structures
    const getHomeValue = (stat) => {
      if (!stat) return null;
      if (typeof stat.home === 'number' || typeof stat.home === 'string') return stat.home;
      if (stat.value && (typeof stat.value.home === 'number' || typeof stat.value.home === 'string')) {
        return stat.value.home;
      }
      if (stat.home_value) return stat.home_value;
      if (stat.homeValue) return stat.homeValue;
      return null;
    };
    
    return {
      possession: getHomeValue(possession),
      shots: getHomeValue(shots),
    };
  }, [statistics]);

  const handleOddsClick = (e, opt) => {
    // Extract fixtureId and selectionId from match data
    const fixtureId = match.fixtureId || match.sportmonksData?.fixtureId || match.id;
    const selectionId = opt.selectionId || null;
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent betting if locked
    if (lockStatus.isLocked) {
      return;
    }
    
    const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
    addSelection(match, mainMarket.name, opt.label, oddsValue, lockStatus.isLocked, fixtureId, selectionId);
  };

  return (
    <div className="bg-[#0d1117] border border-red-500/30 rounded-xl overflow-hidden hover:border-red-500/50 transition-all group">
      {/* Live Badge Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-red-500/10 border-b border-red-500/20">
        <div className="flex items-center gap-2">
          {match.status === 'HT' || match.status === 'HALF_TIME' ? (
            <>
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
              <span className="text-yellow-500 text-xs sm:text-sm font-bold">DEVRE ARASI</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-red-500 text-xs sm:text-sm font-bold">CANLI</span>
              {currentTime && (
                <span className="text-white text-xs sm:text-sm font-bold ml-2">{currentTime}</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {match.leagueLogo ? (
            <img src={match.leagueLogo} alt={match.league} className="w-3 h-3 sm:w-4 sm:h-4 object-contain flex-shrink-0" />
          ) : match.leagueFlag && match.leagueFlag.startsWith('http') ? (
            <img src={match.leagueFlag} alt={match.league} className="w-3 h-3 sm:w-4 sm:h-4 object-contain flex-shrink-0" />
          ) : null}
          <span className="text-[10px] sm:text-xs text-gray-400">{match.league}</span>
        </div>
      </div>

      {/* Teams & Score - Horizontal Layout */}
      <Link to={`/match/${match.id}`} className="block px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-3 justify-between">
          {/* Home Team */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            {match.homeTeamLogo && (
              <img 
                src={match.homeTeamLogo} 
                alt={match.homeTeam}
                className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <span className="text-white text-sm sm:text-base font-medium truncate">{match.homeTeam}</span>
          </div>
          
          {/* Score */}
          {match.homeScore !== null && match.awayScore !== null && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 px-2 sm:px-3">
              <span className="text-xl sm:text-2xl font-bold text-white">{match.homeScore}</span>
              <span className="text-gray-500 text-sm">-</span>
              <span className="text-xl sm:text-2xl font-bold text-white">{match.awayScore}</span>
            </div>
          )}
          
          {/* Away Team */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 justify-end">
            <span className="text-white text-sm sm:text-base font-medium truncate">{match.awayTeam}</span>
            {match.awayTeamLogo && (
              <img 
                src={match.awayTeamLogo} 
                alt={match.awayTeam}
                className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
          </div>
        </div>
      </Link>

      {/* Live Events */}
      {recentEvents.length > 0 && (
        <div className="px-3 sm:px-4 pb-2 border-b border-[#1e2736]">
          <div className="flex flex-col gap-1.5">
            {recentEvents.slice(0, expanded ? 5 : 3).map((event, idx) => {
              const eventData = formatEvent(event, match.homeTeam, match.awayTeam);
              const { Icon, iconColor, iconBg, minute, type, isHome } = eventData;
              
              // Ensure Icon is a valid component
              // Icon should be a React component (function), but sometimes it might be an object
              // Check if Icon is a function, or if it's an object with a render method
              let EventIcon = Circle; // Default fallback
              
              if (Icon) {
                if (typeof Icon === 'function') {
                  EventIcon = Icon;
                } else if (Icon && typeof Icon === 'object' && Icon.render) {
                  // If Icon is an object with render method, it might be a React component wrapper
                  EventIcon = Icon;
                } else if (Icon && typeof Icon === 'object' && Icon.default) {
                  // If Icon is an object with default export
                  EventIcon = Icon.default;
                }
              }
              
              // Debug: Log event data if icon is missing
              if (process.env.NODE_ENV === 'development') {
                if (!Icon || (typeof Icon !== 'function' && typeof Icon !== 'object')) {
                  console.warn('Event icon missing or invalid:', {
                    event,
                    eventData,
                    Icon,
                    IconType: typeof Icon,
                    IconIsFunction: typeof Icon === 'function',
                    type: event.type,
                    event_type: event.event_type,
                    typeName: event.type?.name || event.type || event.event_type,
                    getEventIconResult: getEventIcon(event)
                  });
                }
              }
              
              return (
                <div 
                  key={idx} 
                  className={`flex items-center gap-2 text-[10px] sm:text-xs ${
                    isHome ? 'text-amber-400' : 'text-blue-400'
                  }`}
                >
                  {/* Event Icon */}
                  <div className={`flex items-center justify-center w-5 h-5 rounded ${iconBg || 'bg-gray-500/10'} flex-shrink-0`}>
                    {EventIcon && typeof EventIcon === 'function' ? (
                      <EventIcon size={12} className={iconColor || 'text-gray-400'} />
                    ) : (
                      <Circle size={12} className={iconColor || 'text-gray-400'} />
                    )}
                  </div>
                  
                  {/* Event Content */}
                  <div className="flex-1 min-w-0">
                    {type === 'substitution' ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {eventData.playerOut ? (
                          <>
                            <span className="font-medium">{eventData.playerOut}</span>
                            {eventData.playerIn ? (
                              <>
                                <ArrowRight size={10} className="text-gray-500 flex-shrink-0" />
                                <span className="font-medium">{eventData.playerIn}</span>
                              </>
                            ) : (
                              <span className="text-gray-500 text-[9px] ml-1">(Değişiklik)</span>
                            )}
                          </>
                        ) : eventData.player ? (
                          <span className="font-medium">{eventData.player}</span>
                        ) : (
                          <span className="font-medium">Oyuncu Değişikliği</span>
                        )}
                      </div>
                    ) : type === 'goal' ? (
                      <div className="font-medium">
                        {eventData.player && eventData.player !== 'Gol' ? eventData.player : 'Gol'}
                      </div>
                    ) : type === 'card' ? (
                      <div className="font-medium">
                        {eventData.player || 'Oyuncu'}
                        {eventData.cardType === 'yellow' && <span className="text-yellow-500 ml-1">(Sarı Kart)</span>}
                        {eventData.cardType === 'red' && <span className="text-red-500 ml-1">(Kırmızı Kart)</span>}
                      </div>
                    ) : (
                      <div className="font-medium">
                        {eventData.player || eventData.eventType || 'Olay'}
                      </div>
                    )}
                  </div>
                  
                  {/* Minute */}
                  <div className="text-gray-500 font-semibold flex-shrink-0">
                    {minute}'
                  </div>
                </div>
              );
            })}
          </div>
          {recentEvents.length > 3 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="mt-1.5 text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1"
            >
              {expanded ? (
                <>
                  <ChevronUp size={12} />
                  Daha az göster
                </>
              ) : (
                <>
                  <ChevronDown size={12} />
                  Daha fazla göster ({recentEvents.length - 3})
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Mini Statistics */}
      {keyStats && (keyStats.possession || keyStats.shots) && (
        <div className="px-3 sm:px-4 py-2 border-b border-[#1e2736]">
          <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-gray-400">
            {keyStats.possession && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500">📊</span>
                <span>Topla Oynama: {keyStats.possession}%</span>
              </div>
            )}
            {keyStats.shots && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500">🎯</span>
                <span>İsabetli Şut: {keyStats.shots}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lock Warning */}
      {lockStatus.isLocked && (
        <div className="px-3 sm:px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-center gap-2 text-red-500 text-xs">
            <Lock size={14} />
            <span>{lockStatus.reason}</span>
          </div>
        </div>
      )}

      {/* Quick Odds */}
      {mainMarket && mainMarket.options && mainMarket.options.length > 0 ? (
        <div className="px-3 sm:px-4 pb-3">
          <div className="flex gap-1.5 sm:gap-2">
            {sortOptions(mainMarket.options).map((opt) => {
              const selected = isSelected(match.id, mainMarket.name, opt.label);
              const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
              // Only show if odds value is valid (> 0)
              if (oddsValue <= 0) return null;
              const isDisabled = lockStatus.isLocked;
              
              // Get odds change indicator
              const oddsChange = getOddsChange(mainMarket.name, opt.label);
              
              return (
                <button
                  key={opt.label}
                  onClick={(e) => handleOddsClick(e, opt)}
                  disabled={isDisabled}
                  className={`flex-1 py-2 px-2 rounded-lg text-center transition-all relative ${
                    isDisabled
                      ? 'bg-[#0d1117] text-gray-600 cursor-not-allowed opacity-50'
                      : selected
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                  }`}
                >
                  <span className="text-[10px] sm:text-xs text-gray-400 block leading-tight">{translateOddsLabel(opt.label)}</span>
                  <span className="font-bold text-sm sm:text-base flex items-center justify-center gap-1">
                    {isDisabled ? (
                      <Lock size={12} className="inline" />
                    ) : (
                      <>
                        {oddsChange && oddsChange.direction === 'up' && (
                          <ArrowUp size={14} className="text-green-500" />
                        )}
                        {oddsChange && oddsChange.direction === 'down' && (
                          <ArrowDown size={14} className="text-red-500" />
                        )}
                        {oddsValue.toFixed(2)}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LiveMatchCard;
