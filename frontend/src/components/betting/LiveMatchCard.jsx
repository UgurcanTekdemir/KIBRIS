import React from 'react';
import { Link } from 'react-router-dom';
import { useBetSlip } from '../../context/BetSlipContext';

const LiveMatchCard = ({ match }) => {
  const { addSelection, isSelected } = useBetSlip();
  const mainMarket = match.markets?.[0];

  return (
    <div className="min-w-[280px] bg-gradient-to-br from-[#1a2332] to-[#0d1117] border border-[#2a3a4d] rounded-xl overflow-hidden hover:border-amber-500/50 transition-all">
      {/* Live Badge */}
      <div className="flex items-center justify-between px-3 py-2 bg-red-500/10 border-b border-red-500/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-red-500 text-xs font-bold">CANLI</span>
        </div>
        <span className="text-white text-sm font-bold">{match.minute}'</span>
      </div>

      {/* League */}
      <div className="px-3 py-1 border-b border-[#1e2736]">
        <span className="text-xs text-gray-400">{match.leagueFlag} {match.league}</span>
      </div>

      {/* Score */}
      <Link to={`/match/${match.id}`} className="block p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-medium text-sm flex-1 truncate">{match.homeTeam}</span>
          <span className="text-xl font-bold text-white ml-2">{match.homeScore}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white font-medium text-sm flex-1 truncate">{match.awayTeam}</span>
          <span className="text-xl font-bold text-white ml-2">{match.awayScore}</span>
        </div>
      </Link>

      {/* Quick Odds */}
      {mainMarket && (
        <div className="px-3 pb-3">
          <div className="flex gap-1">
            {mainMarket.options.map((opt) => {
              const selected = isSelected(match.id, mainMarket.name, opt.label);
              return (
                <button
                  key={opt.label}
                  onClick={() => addSelection(match, mainMarket.name, opt.label, opt.value)}
                  className={`flex-1 py-1.5 rounded text-center transition-all ${
                    selected
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#0a0e14] hover:bg-[#1e2736] text-white'
                  }`}
                >
                  <span className="text-[10px] text-gray-500 block">{opt.label}</span>
                  <span className="font-bold text-sm">{opt.value.toFixed(2)}</span>
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
