import React from 'react';
import { Link } from 'react-router-dom';
import { useBetSlip } from '../../context/BetSlipContext';

const LiveMatchCard = ({ match }) => {
  const { addSelection, isSelected } = useBetSlip();
  const mainMarket = match.markets?.[0];

  const handleOddsClick = (e, opt) => {
    e.preventDefault();
    e.stopPropagation();
    const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
    addSelection(match, mainMarket.name, opt.label, oddsValue);
  };

  return (
    <div className="min-w-[180px] sm:min-w-[200px] md:min-w-[220px] bg-gradient-to-br from-[#1a2332] to-[#0d1117] border border-[#2a3a4d] rounded-lg sm:rounded-xl overflow-hidden hover:border-amber-500/50 transition-all flex-shrink-0">
      {/* Live Badge */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-red-500/10 border-b border-red-500/20">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-red-500 text-[10px] font-bold">CANLI</span>
        </div>
        <span className="text-white text-xs font-bold">{match.minute}'</span>
      </div>

      {/* League */}
      <div className="px-2.5 py-0.5 border-b border-[#1e2736]">
        <span className="text-[10px] text-gray-400 truncate">{match.leagueFlag} {match.league}</span>
      </div>

      {/* Score */}
      <Link to={`/match/${match.id}`} className="block p-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-white font-medium text-xs flex-1 truncate pr-1">{match.homeTeam}</span>
          {match.homeScore !== null && match.awayScore !== null && (
          <span className="text-lg font-bold text-white">{match.homeScore}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white font-medium text-xs flex-1 truncate pr-1">{match.awayTeam}</span>
          {match.homeScore !== null && match.awayScore !== null && (
          <span className="text-lg font-bold text-white">{match.awayScore}</span>
          )}
        </div>
      </Link>

      {/* Quick Odds */}
      {mainMarket && (
        <div className="px-2.5 pb-2.5">
          <div className="flex gap-0.5">
            {mainMarket.options.map((opt) => {
              const selected = isSelected(match.id, mainMarket.name, opt.label);
              const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
              return (
                <button
                  key={opt.label}
                  onClick={(e) => handleOddsClick(e, opt)}
                  className={`flex-1 py-1 px-1 rounded text-center transition-all ${
                    selected
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#0a0e14] hover:bg-[#1e2736] text-white'
                  }`}
                >
                  <span className="text-[9px] text-gray-500 block leading-tight">{opt.label}</span>
                  <span className="font-bold text-xs">{oddsValue.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMatchCard;
