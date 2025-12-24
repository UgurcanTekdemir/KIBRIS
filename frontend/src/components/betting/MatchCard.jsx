import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBetSlip } from '../../context/BetSlipContext';
import { Clock, ChevronRight } from 'lucide-react';

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

const MatchCard = ({ match, showFullMarkets = false, compact = false }) => {
  const { addSelection, isSelected } = useBetSlip();
  
  const dateTimeDisplay = useMemo(() => {
    return formatMatchDateTime(match.date, match.time);
  }, [match.date, match.time]);

  const handleOddsClick = (e, market, option, odds) => {
    e.preventDefault();
    e.stopPropagation();
    addSelection(match, market.name, option, odds);
  };

  const mainMarket = match.markets?.[0];

  if (compact) {
    return (
      <div className="bg-[#0d1117] border border-[#1e2736] rounded-lg sm:rounded-xl overflow-hidden hover:border-[#2a3a4d] transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 bg-[#0a0e14] border-b border-[#1e2736]">
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm">{match.leagueFlag}</span>
            <span className="text-[10px] sm:text-xs text-gray-400 truncate">{match.league}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {match.isLive ? (
              <div className="flex items-center gap-0.5 sm:gap-1">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-red-500 text-[10px] sm:text-xs font-bold">{match.minute}'</span>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 sm:gap-1 text-gray-400">
                <Clock size={9} className="sm:w-2.5 sm:h-2.5" />
                <span className="text-[10px] sm:text-xs">{dateTimeDisplay}</span>
              </div>
            )}
          </div>
        </div>

        {/* Teams & Score - Horizontal Layout */}
        <Link to={`/match/${match.id}`} className="block px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Teams and Score in one row */}
              <div className="flex items-center gap-2 sm:gap-3 justify-between">
                {/* Home Team */}
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
                  {match.homeTeamLogo && (
                    <img 
                      src={match.homeTeamLogo} 
                      alt={match.homeTeam}
                      className="w-4 h-4 sm:w-5 sm:h-5 object-contain flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <span className="text-white text-xs sm:text-sm truncate">{match.homeTeam}</span>
                </div>
                
                {/* Score */}
                {(match.isLive || match.isFinished) && match.homeScore !== null && match.awayScore !== null && (
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 px-1 sm:px-2">
                    <span className="text-base sm:text-lg font-bold text-white">{match.homeScore}</span>
                    <span className="text-gray-500 text-xs">-</span>
                    <span className="text-base sm:text-lg font-bold text-white">{match.awayScore}</span>
                  </div>
                )}
                
                {/* Away Team */}
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 justify-end">
                  <span className="text-white text-xs sm:text-sm truncate">{match.awayTeam}</span>
                  {match.awayTeamLogo && (
                    <img 
                      src={match.awayTeamLogo} 
                      alt={match.awayTeam}
                      className="w-4 h-4 sm:w-5 sm:h-5 object-contain flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>
              
            {/* Maç Bitti or Ertelendi message */}
            {(() => {
              const status = (match.status || '').toUpperCase();
              if (status === 'POSTPONED') {
                return (
                  <div className="mt-1 sm:mt-1.5 text-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 font-medium">Ertelendi</span>
                  </div>
                );
              } else if (match.isFinished) {
                return (
                  <div className="mt-1 sm:mt-1.5 text-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 font-medium">Maç Bitti</span>
                  </div>
                );
              }
              return null;
            })()}
            </div>
            <ChevronRight size={14} className="text-gray-600 flex-shrink-0 sm:w-4 sm:h-4" />
          </div>
        </Link>

        {/* Quick Odds */}
        {mainMarket && mainMarket.options && mainMarket.options.length > 0 ? (
          <div className="px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="flex gap-1 sm:gap-1.5">
              {mainMarket.options.map((opt) => {
                const selected = isSelected(match.id, mainMarket.name, opt.label);
                const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
                // Only show if odds value is valid (> 0)
                if (oddsValue <= 0) return null;
                return (
                  <button
                    key={opt.label}
                    onClick={(e) => handleOddsClick(e, mainMarket, opt.label, oddsValue)}
                    className={`flex-1 py-1 sm:py-1.5 px-1 sm:px-2 rounded-lg text-center transition-all ${
                      selected
                        ? 'bg-amber-500 text-black'
                        : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                    }`}
                  >
                    <span className="text-[9px] sm:text-[10px] text-gray-400 block leading-tight">{opt.label}</span>
                    <span className="font-bold text-xs sm:text-sm">{oddsValue.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden hover:border-[#2a3a4d] transition-all group">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#0a0e14] border-b border-[#1e2736]">
        <div className="flex items-center gap-2 min-w-0">
          {match.leagueFlag && match.leagueFlag.startsWith('http') ? (
            <img src={match.leagueFlag} alt={match.league} className="w-4 h-4 object-contain flex-shrink-0" />
          ) : (
            <span className="text-base flex-shrink-0">{match.leagueFlag || '🏆'}</span>
          )}
          <span className="text-xs text-gray-400 font-medium truncate">{match.league}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {match.isLive ? (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-red-500 text-xs font-bold">{match.minute}'</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-400">
              <Clock size={12} />
              <span className="text-xs">{dateTimeDisplay}</span>
            </div>
          )}
        </div>
      </div>

      {/* Teams & Score - Horizontal Layout */}
      <Link to={`/match/${match.id}`} className="block px-3 sm:px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Teams and Score in one row */}
            <div className="flex items-center gap-3 sm:gap-4 justify-between">
              {/* Home Team */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                {match.homeTeamLogo && (
                  <img 
                    src={match.homeTeamLogo} 
                    alt={match.homeTeam}
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <span className="text-white font-medium truncate text-sm sm:text-base">{match.homeTeam}</span>
              </div>
              
              {/* Score */}
              {(match.isLive || match.isFinished) && match.homeScore !== null && match.awayScore !== null && (
                <div className="flex items-center gap-2 flex-shrink-0 px-2 sm:px-3">
                  <span className="text-xl sm:text-2xl font-bold text-white">{match.homeScore}</span>
                  <span className="text-gray-500 text-sm sm:text-base">-</span>
                  <span className="text-xl sm:text-2xl font-bold text-white">{match.awayScore}</span>
                </div>
              )}
              
              {/* Away Team */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 justify-end">
                <span className="text-white font-medium truncate text-sm sm:text-base">{match.awayTeam}</span>
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
            
            {/* Maç Bitti or Ertelendi message */}
            {(() => {
              const status = (match.status || '').toUpperCase();
              if (status === 'POSTPONED') {
                return (
                  <div className="mt-2 text-center">
                    <span className="text-xs sm:text-sm text-gray-500 font-medium">Ertelendi</span>
                  </div>
                );
              } else if (match.isFinished) {
                return (
                  <div className="mt-2 text-center">
                    <span className="text-xs sm:text-sm text-gray-500 font-medium">Maç Bitti</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
          <ChevronRight size={20} className="text-gray-600 group-hover:text-amber-500 transition-colors flex-shrink-0" />
        </div>
      </Link>

      {/* Quick Odds */}
      {mainMarket && mainMarket.options && mainMarket.options.length > 0 ? (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="flex gap-2">
            {mainMarket.options.map((opt) => {
              const selected = isSelected(match.id, mainMarket.name, opt.label);
              const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
              // Only show if odds value is valid (> 0)
              if (oddsValue <= 0) return null;
              return (
                <button
                  key={opt.label}
                  onClick={(e) => handleOddsClick(e, mainMarket, opt.label, oddsValue)}
                  className={`flex-1 py-2 px-3 rounded-lg text-center transition-all ${
                    selected
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                  }`}
                >
                  <span className="text-xs text-gray-400 block mb-0.5">{opt.label}</span>
                  <span className="font-bold">{oddsValue.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* More Markets (optional) */}
      {showFullMarkets && match.markets?.length > 1 && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-[#1e2736] pt-3">
          {match.markets.slice(1).map((market, idx) => {
            // Filter out markets with no valid odds
            const validOptions = market.options?.filter(opt => {
              const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
              return oddsValue > 0;
            }) || [];
            
            if (validOptions.length === 0) return null;
            
            return (
              <div key={idx}>
                <p className="text-xs text-gray-500 mb-2">{market.name}</p>
                <div className="flex gap-2">
                  {validOptions.map((opt) => {
                    const selected = isSelected(match.id, market.name, opt.label);
                    const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
                    return (
                      <button
                        key={opt.label}
                        onClick={(e) => handleOddsClick(e, market, opt.label, oddsValue)}
                        className={`flex-1 py-2 px-3 rounded-lg text-center transition-all ${
                          selected
                            ? 'bg-amber-500 text-black'
                            : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                        }`}
                      >
                        <span className="text-xs text-gray-400 block mb-0.5">{opt.label}</span>
                        <span className="font-bold text-sm">{oddsValue.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MatchCard;
