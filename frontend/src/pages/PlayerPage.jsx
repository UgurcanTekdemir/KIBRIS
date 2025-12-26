import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { usePlayerDetails } from '../hooks/usePlayerDetails';

const PlayerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { player, loading, error, refetch } = usePlayerDetails(id);

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

  if (error || !player) {
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
            {error || 'Oyuncu bulunamadı'}
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
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <User size={24} className="text-green-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {player.name || player.player_name || 'Oyuncu'}
            </h1>
            {player.team && (
              <p className="text-xs sm:text-sm text-gray-400">{player.team}</p>
            )}
          </div>
        </div>
      </div>

      {/* Player Info */}
      <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {player.position && (
            <div>
              <span className="text-gray-400 text-xs sm:text-sm">Pozisyon:</span>
              <p className="text-white text-sm sm:text-base">{player.position}</p>
            </div>
          )}
          {player.birth_date && (
            <div>
              <span className="text-gray-400 text-xs sm:text-sm">Doğum Tarihi:</span>
              <p className="text-white text-sm sm:text-base">{player.birth_date}</p>
            </div>
          )}
          {player.nationality && (
            <div>
              <span className="text-gray-400 text-xs sm:text-sm">Milliyet:</span>
              <p className="text-white text-sm sm:text-base">{player.nationality}</p>
            </div>
          )}
          {player.height && (
            <div>
              <span className="text-gray-400 text-xs sm:text-sm">Boy:</span>
              <p className="text-white text-sm sm:text-base">{player.height}</p>
            </div>
          )}
        </div>
      </div>

      {/* Player Photo */}
      {player.photo && (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6 mb-6 text-center">
          <img 
            src={player.photo} 
            alt={player.name || player.player_name} 
            className="w-32 h-32 mx-auto object-contain rounded-full"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Statistics */}
      {player.stats && (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4 sm:p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            İstatistikler
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(player.stats).map(([key, value]) => (
              <div key={key} className="text-center">
                <p className="text-gray-400 text-xs sm:text-sm mb-1 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-white text-lg sm:text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerPage;

