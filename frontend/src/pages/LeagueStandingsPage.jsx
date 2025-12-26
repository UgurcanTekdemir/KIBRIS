import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLeagueStandings } from '../hooks/useLeagueStandings';
import { matchAPI } from '../services/api';
import { LEAGUE_MAP } from '../utils/leagueMap';

const LeagueStandingsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const leagueId = parseInt(id, 10);
  const leagueInfo = LEAGUE_MAP[leagueId];
  const [season, setSeason] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  const { standings, loading, error, refetch } = useLeagueStandings(leagueId?.toString(), season);

  // Fetch available seasons
  React.useEffect(() => {
    async function fetchSeasons() {
      try {
        setLoadingSeasons(true);
        const seasonsData = await matchAPI.getLeagueSeasons(leagueId?.toString());
        setSeasons(seasonsData || []);
        if (seasonsData && seasonsData.length > 0 && !season) {
          // Set current season as default
          setSeason(seasonsData[0].season || seasonsData[0].name || null);
        }
      } catch (err) {
        console.error('Error fetching seasons:', err);
      } finally {
        setLoadingSeasons(false);
      }
    }
    if (leagueId) {
      fetchSeasons();
    }
  }, [leagueId]);

  if (!leagueInfo) {
    return (
      <div className="max-w-6xl mx-auto">
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            Lig bilgisi bulunamadı
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/league/${leagueId}`}>
          <Button 
            variant="outline" 
            className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]"
          >
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Trophy size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">{leagueInfo.flag}</span>
              {leagueInfo.name} Puan Durumu
            </h1>
            <p className="text-xs sm:text-sm text-gray-400">
              {loading ? 'Yükleniyor...' : standings ? 'Lig tablosu' : 'Puan durumu bulunamadı'}
            </p>
          </div>
        </div>
      </div>

      {/* Season Selector */}
      {seasons.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <select
            value={season || ''}
            onChange={(e) => setSeason(e.target.value || null)}
            className="px-3 py-2 bg-[#0d1117] border border-[#1e2736] rounded-lg text-white text-sm"
          >
            {seasons.map((s) => (
              <option key={s.season || s.name} value={s.season || s.name}>
                {s.season || s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            {error}
            <Button
              variant="link"
              onClick={refetch}
              className="ml-2 text-amber-500 hover:text-amber-400 p-0 h-auto"
            >
              Tekrar dene
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Standings Table */}
      {loading ? (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
          <Skeleton className="h-64 w-full bg-[#1a2332]" />
        </div>
      ) : standings ? (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#1a2332] border-b border-[#1e2736]">
                <tr>
                  <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-medium">#</th>
                  <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-medium">Takım</th>
                  <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">O</th>
                  <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">G</th>
                  <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">B</th>
                  <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">M</th>
                  <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">A</th>
                  <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">Y</th>
                  <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium font-bold">P</th>
                </tr>
              </thead>
              <tbody>
                {standings.table && Array.isArray(standings.table) ? (
                  standings.table.map((team, idx) => (
                    <tr key={idx} className="border-b border-[#1e2736] hover:bg-[#1a2332] transition-colors">
                      <td className="p-3 text-xs sm:text-sm text-white font-medium">{team.position || idx + 1}</td>
                      <td className="p-3 text-xs sm:text-sm text-white">{team.team_name || team.name || 'Takım'}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.played || team.matches_played || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-green-400">{team.won || team.wins || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.drawn || team.draws || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-red-400">{team.lost || team.losses || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_for || team.goals_scored || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_against || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-amber-500 font-bold">{team.points || 0}</td>
                    </tr>
                  ))
                ) : standings.teams && Array.isArray(standings.teams) ? (
                  standings.teams.map((team, idx) => (
                    <tr key={idx} className="border-b border-[#1e2736] hover:bg-[#1a2332] transition-colors">
                      <td className="p-3 text-xs sm:text-sm text-white font-medium">{team.position || idx + 1}</td>
                      <td className="p-3 text-xs sm:text-sm text-white">{team.team_name || team.name || 'Takım'}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.played || team.matches_played || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-green-400">{team.won || team.wins || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.drawn || team.draws || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-red-400">{team.lost || team.losses || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_for || team.goals_scored || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_against || 0}</td>
                      <td className="p-3 text-xs sm:text-sm text-center text-amber-500 font-bold">{team.points || 0}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-gray-500">
                      Puan durumu verisi bulunamadı
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6 text-center text-gray-500">
          Bu lig için puan durumu bulunamadı
        </div>
      )}
    </div>
  );
};

export default LeagueStandingsPage;

