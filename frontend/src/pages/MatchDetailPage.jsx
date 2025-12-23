import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBetSlip } from '../context/BetSlipContext';
import { ArrowLeft, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatchDetails } from '../hooks/useMatches';

const MatchDetailPage = () => {
  const { id } = useParams();
  const { addSelection, isSelected } = useBetSlip();
  const { match, loading, error } = useMatchDetails(id);

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
        <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft size={18} />
          <span>Geri</span>
        </Link>
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            {error || 'Maç bulunamadı'}
          </AlertDescription>
        </Alert>
        <div className="text-center py-8">
          <Link to="/">
            <Button variant="outline" className="border-[#2a3a4d] text-white">
              <ArrowLeft size={16} className="mr-2" />
              Ana Sayfaya Dön
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft size={18} />
        <span>Geri</span>
      </Link>

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
              <span>{match.date} - {match.time}</span>
            </div>
          )}
        </div>

        {/* Score Board */}
        <div className="p-6">
          <div className="flex items-center justify-center gap-8">
            {/* Home Team */}
            <div className="text-center flex-1">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#0a0e14] flex items-center justify-center text-2xl font-bold text-white">
                {match.homeTeam.charAt(0)}
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
                      <span>{match.date} {match.time}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="text-center flex-1">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#0a0e14] flex items-center justify-center text-2xl font-bold text-white">
                {match.awayTeam.charAt(0)}
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
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp size={20} className="text-amber-500" />
          Bahis Marketleri
        </h2>

        {match.markets?.map((market, idx) => (
          <div key={idx} className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#0a0e14] border-b border-[#1e2736]">
              <h3 className="text-white font-medium">{market.name}</h3>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {market.options.map((opt) => {
                  const selected = isSelected(match.id, market.name, opt.label);
                  return (
                    <button
                      key={opt.label}
                      onClick={() => addSelection(match, market.name, opt.label, opt.value)}
                      className={`flex-1 min-w-[100px] py-3 px-4 rounded-lg text-center transition-all ${
                        selected
                          ? 'bg-amber-500 text-black'
                          : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white'
                      }`}
                    >
                      <span className="text-xs text-gray-400 block mb-1">{opt.label}</span>
                      <span className="font-bold text-lg">{opt.value.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatchDetailPage;
