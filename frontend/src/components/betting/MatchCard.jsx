import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBetSlip } from '../../context/BetSlipContext';
import { Clock, ChevronRight } from 'lucide-react';

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

        {/* Teams & Score */}
        <Link to={`/match/${match.id}`} className="block px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-1 sm:mr-2">
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <span className="text-white text-xs sm:text-sm truncate pr-1">{match.homeTeam}</span>
                {(match.isLive || match.homeScore > 0 || match.awayScore > 0) && 
                 match.homeScore !== null && match.awayScore !== null && (
                  <span className="text-base sm:text-lg font-bold text-white ml-1 sm:ml-2">{match.homeScore}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white text-xs sm:text-sm truncate pr-1">{match.awayTeam}</span>
                {(match.isLive || match.homeScore > 0 || match.awayScore > 0) && 
                 match.homeScore !== null && match.awayScore !== null && (
                  <span className="text-base sm:text-lg font-bold text-white ml-1 sm:ml-2">{match.awayScore}</span>
                )}
              </div>
            </div>
            <ChevronRight size={14} className="text-gray-600 flex-shrink-0 sm:w-4 sm:h-4" />
          </div>
        </Link>

        {/* Quick Odds */}
        {mainMarket && (
          <div className="px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="flex gap-1 sm:gap-1.5">
              {mainMarket.options.map((opt) => {
                const selected = isSelected(match.id, mainMarket.name, opt.label);
                const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
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
        )}
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

      {/* Teams & Score */}
      <Link to={`/match/${match.id}`} className="block px-3 sm:px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium truncate">{match.homeTeam}</span>
              {match.isLive && match.homeScore !== null && match.awayScore !== null && (
                <span className="text-xl font-bold text-white ml-2">{match.homeScore}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white font-medium truncate">{match.awayTeam}</span>
              {match.isLive && match.homeScore !== null && match.awayScore !== null && (
                <span className="text-xl font-bold text-white ml-2">{match.awayScore}</span>
              )}
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-600 group-hover:text-amber-500 transition-colors flex-shrink-0" />
        </div>
      </Link>

      {/* Quick Odds */}
      {mainMarket && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="flex gap-2">
            {mainMarket.options.map((opt) => {
              const selected = isSelected(match.id, mainMarket.name, opt.label);
              const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
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
      )}

      {/* More Markets (optional) */}
      {showFullMarkets && match.markets?.length > 1 && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-[#1e2736] pt-3">
          {match.markets.slice(1).map((market, idx) => (
            <div key={idx}>
              <p className="text-xs text-gray-500 mb-2">{market.name}</p>
              <div className="flex gap-2">
                {market.options.map((opt) => {
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
          ))}
        </div>
      )}
    </div>
  );
};

export default MatchCard;
