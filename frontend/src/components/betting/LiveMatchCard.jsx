import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBetSlip } from '../../context/BetSlipContext';
import { useLiveMatchEvents } from '../../hooks/useLiveMatchEvents';
import { useLiveMatchStatistics } from '../../hooks/useLiveMatchStatistics';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Format event type to emoji/icon
function getEventIcon(event) {
  const type = event.type?.toLowerCase() || '';
  const eventType = event.event_type?.toLowerCase() || type;
  
  if (eventType.includes('goal') || type.includes('goal')) {
    return '⚽';
  } else if (eventType.includes('yellow') || type.includes('yellow')) {
    return '🟨';
  } else if (eventType.includes('red') || type.includes('red')) {
    return '🟥';
  } else if (eventType.includes('substitution') || type.includes('substitution')) {
    return '🔄';
  } else if (eventType.includes('card') || type.includes('card')) {
    return '🟨';
  }
  return '•';
}

// Format event text
function formatEvent(event, homeTeam, awayTeam) {
  const minute = event.minute || event.time || event.elapsed || '';
  const player = event.player?.name || event.player_name || event.player || '';
  const team = event.team?.name || event.team_name || '';
  const isHome = team === homeTeam;
  
  const icon = getEventIcon(event);
  
  if (event.type?.toLowerCase().includes('substitution') || event.event_type?.toLowerCase().includes('substitution')) {
    const playerOut = event.player_out?.name || event.player_out || '';
    const playerIn = event.player_in?.name || event.player_in || '';
    return `${icon} ${minute}' ${playerOut} → ${playerIn}`;
  }
  
  return `${icon} ${minute}' ${player}`;
}

const LiveMatchCard = ({ match }) => {
  const { addSelection, isSelected } = useBetSlip();
  const [expanded, setExpanded] = useState(false);
  
  const { events } = useLiveMatchEvents(match.id, match.isLive, 12000);
  const { statistics } = useLiveMatchStatistics(match.id, match.isLive, 30000);
  
  const mainMarket = match.markets?.[0];
  
  // Get recent events (last 3-5)
  const recentEvents = useMemo(() => {
    if (!events || events.length === 0) return [];
    return events
      .filter(e => e.minute || e.time || e.elapsed)
      .sort((a, b) => {
        const aMin = parseInt(a.minute || a.time || a.elapsed || 0);
        const bMin = parseInt(b.minute || b.time || b.elapsed || 0);
        return bMin - aMin;
      })
      .slice(0, 5);
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
    e.preventDefault();
    e.stopPropagation();
    const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
    addSelection(match, mainMarket.name, opt.label, oddsValue);
  };

  return (
    <div className="bg-[#0d1117] border border-red-500/30 rounded-xl overflow-hidden hover:border-red-500/50 transition-all group">
      {/* Live Badge Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-red-500/10 border-b border-red-500/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-red-500 text-xs sm:text-sm font-bold">CANLI</span>
          {match.minute && (
            <span className="text-white text-xs sm:text-sm font-bold ml-2">{match.minute}'</span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-[10px] sm:text-xs text-gray-400">{match.leagueFlag} {match.league}</span>
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
          <div className="flex flex-col gap-1">
            {recentEvents.slice(0, expanded ? 5 : 3).map((event, idx) => (
              <div key={idx} className="text-[10px] sm:text-xs text-gray-400">
                {formatEvent(event, match.homeTeam, match.awayTeam)}
              </div>
            ))}
          </div>
          {recentEvents.length > 3 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="mt-1 text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1"
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

      {/* Quick Odds */}
      {mainMarket && mainMarket.options && mainMarket.options.length > 0 ? (
        <div className="px-3 sm:px-4 pb-3">
          <div className="flex gap-1.5 sm:gap-2">
            {mainMarket.options.map((opt) => {
              const selected = isSelected(match.id, mainMarket.name, opt.label);
              const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
              // Only show if odds value is valid (> 0)
              if (oddsValue <= 0) return null;
              return (
                <button
                  key={opt.label}
                  onClick={(e) => handleOddsClick(e, opt)}
                  className={`flex-1 py-2 px-2 rounded-lg text-center transition-all ${
                    selected
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                  }`}
                >
                  <span className="text-[10px] sm:text-xs text-gray-400 block leading-tight">{opt.label}</span>
                  <span className="font-bold text-sm sm:text-base">{oddsValue.toFixed(2)}</span>
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
