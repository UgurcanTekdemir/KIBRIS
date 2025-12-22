import React from 'react';
import { Link } from 'react-router-dom';
import { useBetSlip } from '../../context/BetSlipContext';
import { Clock, ChevronRight } from 'lucide-react';

const MatchCard = ({ match, showFullMarkets = false, compact = false }) => {
  const { addSelection, isSelected } = useBetSlip();

  const handleOddsClick = (e, market, option, odds) => {
    e.preventDefault();
    e.stopPropagation();
    addSelection(match, market.name, option, odds);
  };

  const mainMarket = match.markets?.[0];

  if (compact) {
    return (
      <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden hover:border-[#2a3a4d] transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#0a0e14] border-b border-[#1e2736]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm">{match.leagueFlag}</span>
            <span className="text-xs text-gray-400 truncate">{match.league}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {match.isLive ? (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-red-500 text-xs font-bold">{match.minute}'</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-400">
                <Clock size={10} />
                <span className="text-xs">{match.time}</span>
              </div>
            )}
          </div>
        </div>

        {/* Teams & Score */}
        <Link to={`/match/${match.id}`} className="block px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-sm truncate">{match.homeTeam}</span>
                {match.isLive && (
                  <span className="text-lg font-bold text-white ml-2">{match.homeScore}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white text-sm truncate">{match.awayTeam}</span>
                {match.isLive && (
                  <span className="text-lg font-bold text-white ml-2">{match.awayScore}</span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
          </div>
        </Link>

        {/* Quick Odds */}
        {mainMarket && (
          <div className="px-3 pb-3">
            <div className="flex gap-1.5">
              {mainMarket.options.map((opt) => {
                const selected = isSelected(match.id, mainMarket.name, opt.label);
                return (
                  <button
                    key={opt.label}
                    onClick={(e) => handleOddsClick(e, mainMarket, opt.label, opt.value)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                      selected
                        ? 'bg-amber-500 text-black'
                        : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                    }`}
                  >
                    <span className="text-[10px] text-gray-400 block">{opt.label}</span>
                    <span className="font-bold text-sm">{opt.value.toFixed(2)}</span>
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
          <span className="text-base">{match.leagueFlag}</span>
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
              <span className="text-xs">{match.time}</span>
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
              {match.isLive && (
                <span className="text-xl font-bold text-white ml-2">{match.homeScore}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white font-medium truncate">{match.awayTeam}</span>
              {match.isLive && (
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
              return (
                <button
                  key={opt.label}
                  onClick={(e) => handleOddsClick(e, mainMarket, opt.label, opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-center transition-all ${
                    selected
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                  }`}
                >
                  <span className="text-xs text-gray-400 block mb-0.5">{opt.label}</span>
                  <span className="font-bold">{opt.value.toFixed(2)}</span>
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
                  return (
                    <button
                      key={opt.label}
                      onClick={(e) => handleOddsClick(e, market, opt.label, opt.value)}
                      className={`flex-1 py-2 px-3 rounded-lg text-center transition-all ${
                        selected
                          ? 'bg-amber-500 text-black'
                          : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                      }`}
                    >
                      <span className="text-xs text-gray-400 block mb-0.5">{opt.label}</span>
                      <span className="font-bold text-sm">{opt.value.toFixed(2)}</span>
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
