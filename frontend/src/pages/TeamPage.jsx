import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useTeamDetails } from '../hooks/useTeamDetails';

const TeamPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { team, loading, error, refetch } = useTeamDetails(id);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        <Skeleton className="h-10 w-32 mb-6 bg-[#1a2332]" />
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
          <Skeleton className="h-64 w-full bg-[#1a2332]" />
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
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
            {error || 'Takım bulunamadı'}
            {error && (
              <Button
                variant="link"
                onClick={refetch}
                className="ml-2 text-amber-500 hover:text-amber-400 p-0 h-auto"
              >
                Tekrar dene
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Building2 size={24} className="text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {team.name || team.team_name || 'Takım'}
            </h1>
            {team.country && (
              <p className="text-xs sm:text-sm text-gray-400">{team.country}</p>
            )}
          </div>
        </div>
      </div>

      {/* Team Info */}
      <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {team.founded && (
            <div>
              <span className="text-gray-400 text-xs sm:text-sm">Kuruluş:</span>
              <p className="text-white text-sm sm:text-base">{team.founded}</p>
            </div>
          )}
          {team.venue && (
            <div>
              <span className="text-gray-400 text-xs sm:text-sm">Stadyum:</span>
              <p className="text-white text-sm sm:text-base">{team.venue}</p>
            </div>
          )}
          {team.league && (
            <div>
              <span className="text-gray-400 text-xs sm:text-sm">Lig:</span>
              <p className="text-white text-sm sm:text-base">{team.league}</p>
            </div>
          )}
          {team.coach && (
            <div>
              <span className="text-gray-400 text-xs sm:text-sm">Teknik Direktör:</span>
              <p className="text-white text-sm sm:text-base">{team.coach}</p>
            </div>
          )}
        </div>
      </div>

      {/* Team Logo */}
      {team.logo && (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6 mb-6 text-center">
          <img 
            src={team.logo} 
            alt={team.name || team.team_name} 
            className="w-32 h-32 mx-auto object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Statistics */}
      {team.stats && (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4 sm:p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            İstatistikler
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(team.stats).map(([key, value]) => (
              <div key={key} className="text-center">
                <p className="text-gray-400 text-xs sm:text-sm mb-1 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-white text-lg sm:text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Squad */}
      {team.squad && team.squad.length > 0 && (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4 sm:p-6 mt-6">
          <h2 className="text-white font-semibold mb-4">Kadro</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {team.squad.map((player, idx) => (
              <div key={idx} className="bg-[#1a2332] p-2 rounded text-sm text-white">
                {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                {player.position && (
                  <span className="text-gray-400 text-xs block mt-1">{player.position}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPage;

