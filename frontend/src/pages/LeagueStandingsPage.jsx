import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLeagueStandings } from '../hooks/useLeagueStandings';
import { matchAPI } from '../services/api';

const LeagueStandingsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const leagueId = parseInt(id, 10);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [loadingLeague, setLoadingLeague] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [season, setSeason] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  const { standings, loading, error, refetch } = useLeagueStandings(leagueId?.toString(), season);

  // Helper function to get country flag emoji
  function getCountryFlag(country) {
    if (!country) return '🏆';
    
    const countryLower = country.toLowerCase();
    const flagMap = {
      'turkey': '🇹🇷', 'türkiye': '🇹🇷',
      'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'ingiltere': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'united kingdom': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'uk': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'spain': '🇪🇸', 'ispanya': '🇪🇸',
      'italy': '🇮🇹', 'italya': '🇮🇹',
      'germany': '🇩🇪', 'almanya': '🇩🇪',
      'france': '🇫🇷', 'fransa': '🇫🇷',
      'netherlands': '🇳🇱', 'hollanda': '🇳🇱',
      'portugal': '🇵🇹', 'portekiz': '🇵🇹',
      'belgium': '🇧🇪', 'belçika': '🇧🇪',
      'austria': '🇦🇹', 'avusturya': '🇦🇹',
      'denmark': '🇩🇰', 'danimarka': '🇩🇰',
      'croatia': '🇭🇷', 'hrvatska': '🇭🇷',
      'czech republic': '🇨🇿', 'çek cumhuriyeti': '🇨🇿', 'czechia': '🇨🇿',
      'bulgaria': '🇧🇬', 'bulgaristan': '🇧🇬',
      'brazil': '🇧🇷', 'brezilya': '🇧🇷',
      'argentina': '🇦🇷', 'arjantin': '🇦🇷',
    };
    
    for (const [key, flag] of Object.entries(flagMap)) {
      if (countryLower.includes(key)) {
        return flag;
      }
    }
    
    return '🏆';
  }

  // Fetch league info from API
  useEffect(() => {
    async function fetchLeagueInfo() {
      try {
        setLoadingLeague(true);
        const leaguesData = await matchAPI.getLeagues();
        
        // Find league by ID
        const league = leaguesData.find(l => {
          const id = l.id || l.league_id || l.main_id;
          return id === leagueId;
        });
        
        if (league) {
          // Handle nested country structure
          const countryName = league.country?.name || 
                             (typeof league.country === 'string' ? league.country : '') ||
                             league.country_name || '';
          
          // Handle image_path - check multiple possible fields
          const imagePath = league.image_path || 
                           league.logo || 
                           league.image || 
                           league.logo_path ||
                           null;
          
          // Debug log
          if (process.env.NODE_ENV === 'development') {
            console.log('LeagueStandingsPage - League info:', {
              id: league.id,
              name: league.name,
              image_path: imagePath,
              raw_league: league
            });
          }
          
          setLeagueInfo({
            id: league.id || league.league_id || league.main_id,
            name: league.name || league.league_name || 'Bilinmeyen Lig',
            country: countryName,
            flag: getCountryFlag(countryName),
            image_path: imagePath,
            season: league.current_season?.name || league.season || '',
            active: league.active !== undefined ? league.active : true,
          });
          // Reset logo error when league changes
          setLogoError(false);
        } else {
          setLeagueInfo(null);
        }
      } catch (error) {
        console.error('Error fetching league info:', error);
        setLeagueInfo(null);
      } finally {
        setLoadingLeague(false);
      }
    }
    
    if (leagueId) {
      fetchLeagueInfo();
    }
  }, [leagueId]);

  // Fetch available seasons (optional - not implemented yet)
  useEffect(() => {
    async function fetchSeasons() {
      try {
        setLoadingSeasons(true);
        // For now, skip seasons fetch as it's not implemented
        // TODO: Implement getLeagueSeasons in API
        setSeasons([]);
      } catch (err) {
        console.error('Error fetching seasons:', err);
        setSeasons([]);
      } finally {
        setLoadingSeasons(false);
      }
    }
    if (leagueId) {
      fetchSeasons();
    }
  }, [leagueId]);

  if (loadingLeague) {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10 bg-[#1a2332]" />
          <Skeleton className="h-8 w-64 bg-[#1a2332]" />
        </div>
        <Skeleton className="h-64 w-full bg-[#1a2332]" />
      </div>
    );
  }

  if (!leagueInfo) {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
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
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center overflow-hidden">
            {leagueInfo.image_path && !logoError ? (
              <img 
                src={leagueInfo.image_path} 
                alt={leagueInfo.name}
                className="w-full h-full object-contain p-1"
                onError={() => setLogoError(true)}
                onLoad={() => setLogoError(false)}
              />
            ) : (
              <Trophy size={24} className="text-amber-500" />
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              {(!leagueInfo.image_path || logoError) && <span className="text-2xl">{leagueInfo.flag}</span>}
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
                  standings.table.map((team, idx) => {
                    const teamLogo = team.team_logo || team.logo || team.image_path || null;
                    const teamName = team.team_name || team.name || 'Takım';
                    return (
                      <tr key={idx} className="border-b border-[#1e2736] hover:bg-[#1a2332] transition-colors">
                        <td className="p-3 text-xs sm:text-sm text-white font-medium">{team.position || idx + 1}</td>
                        <td className="p-3 text-xs sm:text-sm text-white">
                          <div className="flex items-center gap-2">
                            {teamLogo ? (
                              <img 
                                src={teamLogo} 
                                alt={teamName}
                                className="w-6 h-6 object-contain flex-shrink-0"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className="truncate">{teamName}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.played || team.matches_played || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-green-400">{team.won || team.wins || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.drawn || team.draws || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-red-400">{team.lost || team.losses || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_for || team.goals_scored || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_against || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-amber-500 font-bold">{team.points || 0}</td>
                      </tr>
                    );
                  })
                ) : standings.teams && Array.isArray(standings.teams) ? (
                  standings.teams.map((team, idx) => {
                    const teamLogo = team.team_logo || team.logo || team.image_path || null;
                    const teamName = team.team_name || team.name || 'Takım';
                    return (
                      <tr key={idx} className="border-b border-[#1e2736] hover:bg-[#1a2332] transition-colors">
                        <td className="p-3 text-xs sm:text-sm text-white font-medium">{team.position || idx + 1}</td>
                        <td className="p-3 text-xs sm:text-sm text-white">
                          <div className="flex items-center gap-2">
                            {teamLogo ? (
                              <img 
                                src={teamLogo} 
                                alt={teamName}
                                className="w-6 h-6 object-contain flex-shrink-0"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className="truncate">{teamName}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.played || team.matches_played || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-green-400">{team.won || team.wins || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.drawn || team.draws || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-red-400">{team.lost || team.losses || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_for || team.goals_scored || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_against || 0}</td>
                        <td className="p-3 text-xs sm:text-sm text-center text-amber-500 font-bold">{team.points || 0}</td>
                      </tr>
                    );
                  })
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

