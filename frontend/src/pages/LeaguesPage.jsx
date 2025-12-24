import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, Search, ArrowLeft, Globe, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { statpalAPI } from '../services/api';

const LeaguesPage = () => {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('all');

  // Fetch leagues from StatPal API
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await statpalAPI.getLeagues();
        // Ensure data is an array
        const leaguesArray = Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
        setLeagues(leaguesArray);
      } catch (err) {
        console.error('Error fetching leagues:', err);
        setError(err.message || 'Ligler yüklenirken bir hata oluştu');
        setLeagues([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, []);

  // Get unique countries from leagues
  const countries = useMemo(() => {
    if (!Array.isArray(leagues)) return [];
    const countrySet = new Set();
    leagues.forEach(league => {
      if (league && league.country) {
        countrySet.add(league.country);
      }
    });
    return Array.from(countrySet).sort();
  }, [leagues]);

  // Filter leagues by search query and country
  const filteredLeagues = useMemo(() => {
    if (!Array.isArray(leagues)) return [];
    let filtered = leagues;

    // Filter by country
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(league => league.country === selectedCountry);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(league => {
        const name = (league.name || league.league_name || '').toLowerCase();
        const country = (league.country || '').toLowerCase();
        return name.includes(query) || country.includes(query);
      });
    }

    // Sort by name
    return filtered.sort((a, b) => {
      const nameA = (a.name || a.league_name || '').toLowerCase();
      const nameB = (b.name || b.league_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [leagues, searchQuery, selectedCountry]);

  // Format date range
  const formatDateRange = (startDate, endDate) => {
    if (!startDate && !endDate) return null;
    
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', { 
          year: 'numeric', 
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return dateStr;
      }
    };

    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    } else if (startDate) {
      return `Başlangıç: ${formatDate(startDate)}`;
    } else if (endDate) {
      return `Bitiş: ${formatDate(endDate)}`;
    }
    return null;
  };

  // Get league flag emoji based on country
  const getCountryFlag = (country) => {
    if (!country) return '🏆';
    
    const flagMap = {
      'Turkey': '🇹🇷',
      'Türkiye': '🇹🇷',
      'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'İngiltere': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'Spain': '🇪🇸',
      'İspanya': '🇪🇸',
      'Italy': '🇮🇹',
      'İtalya': '🇮🇹',
      'Germany': '🇩🇪',
      'Almanya': '🇩🇪',
      'France': '🇫🇷',
      'Fransa': '🇫🇷',
      'Netherlands': '🇳🇱',
      'Hollanda': '🇳🇱',
      'Portugal': '🇵🇹',
      'Portekiz': '🇵🇹',
      'Brazil': '🇧🇷',
      'Brezilya': '🇧🇷',
      'Argentina': '🇦🇷',
      'Arjantin': '🇦🇷',
    };

    for (const [key, flag] of Object.entries(flagMap)) {
      if (country.toLowerCase().includes(key.toLowerCase())) {
        return flag;
      }
    }

    return '🏆';
  };

  // League card skeleton
  const LeagueCardSkeleton = () => (
    <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-12 h-12 rounded-lg bg-[#1a2332]" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2 bg-[#1a2332]" />
          <Skeleton className="h-4 w-24 bg-[#1a2332]" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2 bg-[#1a2332]" />
      <Skeleton className="h-4 w-3/4 bg-[#1a2332]" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Trophy size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Futbol Ligleri</h1>
            <p className="text-sm text-gray-400">
              {loading ? 'Yükleniyor...' : `${filteredLeagues.length} lig bulundu`}
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-white">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      {!loading && leagues.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search 
              size={18} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" 
            />
            <Input
              type="text"
              placeholder="Lig ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#0d1117] border-[#1e2736] text-white placeholder:text-gray-500 focus:border-amber-500/50 focus:ring-amber-500/20"
            />
          </div>

          {/* Country Filter */}
          {countries.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-400 flex items-center gap-2">
                <Globe size={16} />
                Ülke:
              </span>
              <button
                onClick={() => setSelectedCountry('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCountry === 'all'
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#1a2332] text-gray-400 hover:bg-[#2a3a4d] hover:text-white'
                }`}
              >
                Tümü
              </button>
              {countries.map((country) => (
                <button
                  key={country}
                  onClick={() => setSelectedCountry(country)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCountry === country
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#1a2332] text-gray-400 hover:bg-[#2a3a4d] hover:text-white'
                  }`}
                >
                  {getCountryFlag(country)} {country}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leagues Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <LeagueCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {filteredLeagues.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredLeagues.map((league) => {
                const leagueId = league.id || league.league_id || league.main_id;
                const leagueName = league.name || league.league_name || 'Bilinmeyen Lig';
                const country = league.country || '';
                const season = league.season || '';
                const dateRange = formatDateRange(league.start_date, league.end_date);

                return (
                  <Link
                    key={leagueId}
                    to={`/league/${leagueId}`}
                    className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4 hover:border-amber-500/50 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center text-2xl">
                        {getCountryFlag(country)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-lg group-hover:text-amber-500 transition-colors truncate">
                          {leagueName}
                        </h3>
                        {country && (
                          <p className="text-sm text-gray-400 truncate">
                            {country}
                          </p>
                        )}
                      </div>
                    </div>

                    {season && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Calendar size={14} />
                        <span>{season}</span>
                      </div>
                    )}

                    {dateRange && (
                      <div className="text-xs text-gray-500">
                        {dateRange}
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-[#1e2736]">
                      <span className="text-xs text-amber-500 font-medium">
                        Maçları Gör →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <Trophy size={40} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery || selectedCountry !== 'all' 
                  ? 'Lig bulunamadı' 
                  : 'Henüz lig bulunmuyor'}
              </h3>
              <p className="text-gray-500">
                {searchQuery || selectedCountry !== 'all'
                  ? 'Arama kriterlerinize uygun lig bulunamadı.'
                  : 'StatPal API\'den lig verisi alınamadı.'}
              </p>
              {(searchQuery || selectedCountry !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCountry('all');
                  }}
                  className="mt-4 border-[#2a3a4d] text-gray-400 hover:text-white"
                >
                  Filtreleri Temizle
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaguesPage;

