import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MatchCard from '../components/betting/MatchCard';
import { Calendar, Filter, Search, AlertCircle, Trophy } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useMatches } from '../hooks/useMatches';
import { useLeagues } from '../hooks/useLeagues';

// Helper function to normalize date format for comparison
const normalizeDateForComparison = (dateStr) => {
  if (!dateStr) return '';
  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  // If in DD.MM.YYYY format, convert to YYYY-MM-DD
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month}-${day}`;
  }
  return dateStr;
};

const MatchesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get('search') || '';
  const urlLeagueId = searchParams.get('league_id');
  const [searchTerm, setSearchTerm] = useState(urlSearchQuery);
  const [selectedLeagueId, setSelectedLeagueId] = useState(urlLeagueId ? parseInt(urlLeagueId, 10) : null);
  const [activeTab, setActiveTab] = useState('upcoming');
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch leagues for filter dropdown
  const { leagues, loading: leaguesLoading } = useLeagues();
  
  // Fixed date ranges: 7 days ahead for upcoming, 5 days back for past
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Sync URL params with local state (initial load only)
  useEffect(() => {
    if (urlSearchQuery && urlSearchQuery !== searchTerm) {
      setSearchTerm(urlSearchQuery);
    }
    if (urlLeagueId !== null) {
      const leagueIdNum = urlLeagueId ? parseInt(urlLeagueId, 10) : null;
      if (leagueIdNum !== selectedLeagueId) {
        setSelectedLeagueId(leagueIdNum);
      }
    }
  }, []); // Only run on mount
  
  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }
    if (selectedLeagueId) {
      params.set('league_id', selectedLeagueId.toString());
    }
    setSearchParams(params, { replace: true });
  }, [searchTerm, selectedLeagueId, setSearchParams]);

  // Fetch upcoming matches for next 7 days
  const { matches: upcomingMatchesData, loading: upcomingLoading, error: upcomingError, refetch: refetchUpcoming } = useMatches({ 
    date_from: today,
    date_to: sevenDaysLater,
    league_id: selectedLeagueId
  });

  // Fetch past matches for last 5 days (only when past tab is active)
  const shouldFetchPast = activeTab === 'past';
  const { matches: pastMatchesData, loading: pastLoading, error: pastError, refetch: refetchPast } = useMatches({ 
    date_from: fiveDaysAgo,
    date_to: today, // Use today because Sportmonks API's date_to is exclusive (not inclusive)
    league_id: selectedLeagueId
  }, {
    enabled: shouldFetchPast // Only fetch when past tab is active
  });

  // Combine matches based on active tab
  const allMatches = useMemo(() => {
    if (activeTab === 'past') {
      return pastMatchesData || [];
    }
    return upcomingMatchesData || [];
  }, [activeTab, upcomingMatchesData, pastMatchesData]);
  
  // Calculate counts from raw data (no filtering by odds)
  const upcomingCount = useMemo(() => {
    if (!upcomingMatchesData || upcomingMatchesData.length === 0) return 0;
    const today = new Date().toISOString().split('T')[0];
    return upcomingMatchesData.filter(m => {
      // Exclude live matches
      if (m.isLive === true) return false;
      const status = (m.status || '').toUpperCase();
      const isPostponed = status === 'POSTP' || status === 'POSTPONED';
      const isFinished = m.isFinished === true || 
                         status === 'FT' || 
                         status === 'FINISHED' || 
                         status === 'AET' ||
                         status === 'FT_PEN' ||
                         status === 'AWARDED';
      // Normalize dates for comparison
      const normalizedMatchDate = normalizeDateForComparison(m.date || '');
      const isPastDate = normalizedMatchDate && normalizedMatchDate < today;
      
      // No odds filtering - count all matches
      return !isPostponed && !isFinished && !(isPastDate && !m.isLive);
    }).length;
  }, [upcomingMatchesData]);
  
  const pastCount = useMemo(() => {
    if (!shouldFetchPast || !pastMatchesData || pastMatchesData.length === 0) {
      return '...';
    }
    const today = new Date().toISOString().split('T')[0];
    return pastMatchesData.filter(m => {
      // Exclude live matches
      if (m.isLive === true) return false;
      const status = (m.status || '').toUpperCase();
      const isPostponed = status === 'POSTP' || status === 'POSTPONED';
      const isFinished = m.isFinished === true || 
                         status === 'FT' || 
                         status === 'FINISHED' || 
                         status === 'AET' ||
                         status === 'FT_PEN' ||
                         status === 'AWARDED';
      // Normalize dates for comparison
      const normalizedMatchDate = normalizeDateForComparison(m.date || '');
      const isPastDate = normalizedMatchDate && normalizedMatchDate < today;
      
      // No odds filtering - count all matches
      return !isPostponed && (isFinished || (isPastDate && !m.isLive));
    }).length;
  }, [shouldFetchPast, pastMatchesData]);

  const loading = activeTab === 'past' ? pastLoading : upcomingLoading;
  const error = activeTab === 'past' ? pastError : upcomingError;
  const refetch = activeTab === 'past' ? refetchPast : refetchUpcoming;
  
  const isLoading = loading;

  const filteredMatches = useMemo(() => {
    if (!allMatches || allMatches.length === 0) return [];
    
    // Only filter by search term - no odds filtering, show all matches
    return allMatches.filter((match) => {
      // Filter by search term (if searchTerm is empty, show all matches)
      if (searchTerm.trim()) {
        const matchesSearch = 
          match.homeTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          match.awayTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          match.league?.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;
      }
      
      // No odds filtering - show all matches
      return true;
    });
  }, [allMatches, searchTerm]);

  // Separate matches based on active tab
  const { upcomingMatches, pastMatches, postponedMatches } = useMemo(() => {
    const upcoming = [];
    const past = [];
    const postponed = [];
    
    for (const match of filteredMatches) {
      const status = (match.status || '').toUpperCase();
      const isPostponed = status === 'POSTP' || status === 'POSTPONED';
      // Check isFinished field first, then status, then date
      const isFinished = match.isFinished === true || 
                         status === 'FT' || 
                         status === 'FINISHED' || 
                         status === 'AET' ||
                         status === 'FT_PEN' ||
                         status === 'AWARDED';
      // Normalize dates for comparison
      const normalizedMatchDate = normalizeDateForComparison(match.date || '');
      const normalizedToday = normalizeDateForComparison(today);
      const isPastDate = normalizedMatchDate && normalizedMatchDate < normalizedToday;
      
      if (isPostponed) {
        // Postponed matches go to separate list
        postponed.push(match);
      } else if (isFinished || (isPastDate && !match.isLive)) {
        // Past matches: finished by status/field OR past date (and not live)
        past.push(match);
      } else {
        // Upcoming matches (including live matches for "upcoming" tab)
        upcoming.push(match);
      }
    }
    
    // Sort upcoming by date/time (ascending - nearest first)
    // Handle both DD.MM.YYYY and YYYY-MM-DD date formats
    upcoming.sort((a, b) => {
      // Normalize dates to YYYY-MM-DD for comparison
      const normalizeDate = (dateStr) => {
        if (!dateStr) return '';
        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        // If in DD.MM.YYYY format, convert to YYYY-MM-DD
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
          const [day, month, year] = dateStr.split('.');
          return `${year}-${month}-${day}`;
        }
        return dateStr;
      };
      
      const dateA = normalizeDate(a.date || '');
      const dateB = normalizeDate(b.date || '');
      
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      // If same date, sort by time (earlier time first)
      return (a.time || '').localeCompare(b.time || '');
    });
    
    // Sort past by date/time (descending - most recent first)
    // Handle both DD.MM.YYYY and YYYY-MM-DD date formats
    past.sort((a, b) => {
      // Normalize dates to YYYY-MM-DD for comparison
      const normalizeDate = (dateStr) => {
        if (!dateStr) return '';
        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        // If in DD.MM.YYYY format, convert to YYYY-MM-DD
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
          const [day, month, year] = dateStr.split('.');
          return `${year}-${month}-${day}`;
        }
        return dateStr;
      };
      
      const dateA = normalizeDate(a.date || '');
      const dateB = normalizeDate(b.date || '');
      
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // Descending for past matches
      }
      // If same date, sort by time (later time first for past matches)
      return (b.time || '').localeCompare(a.time || '');
    });
    
    // Sort postponed by date/time (ascending)
    postponed.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (a.time || '').localeCompare(b.time || '');
    });
    
    return { upcomingMatches: upcoming, pastMatches: past, postponedMatches: postponed };
  }, [filteredMatches, today]);
  
  // Use calculated counts
  const pastMatchesCount = pastCount;

  // Loading skeleton component
  const MatchCardSkeleton = () => (
    <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-[#0a0e14] border-b border-[#1e2736]">
        <Skeleton className="h-4 w-32 bg-[#1a2332]" />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-full bg-[#1a2332]" />
        <Skeleton className="h-6 w-full bg-[#1a2332]" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1 bg-[#1a2332]" />
          <Skeleton className="h-12 flex-1 bg-[#1a2332]" />
          <Skeleton className="h-12 flex-1 bg-[#1a2332]" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Calendar size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tüm Maçlar</h1>
            <p className="text-sm text-gray-400">
              {isLoading ? 'Oranlar yükleniyor...' : (() => {
                const count = activeTab === 'past' ? pastMatches.length : upcomingMatches.length;
                return `${count} maç listeleniyor`;
              })()}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 md:w-64 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Takım veya lig ara..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              className="pl-9 bg-[#0d1117] border-[#1e2736] text-white"
            />
          </div>
          <div className="w-full md:w-64 min-w-[200px]">
            <Select 
              value={selectedLeagueId ? selectedLeagueId.toString() : 'all'} 
              onValueChange={(value) => {
                if (value === 'all') {
                  setSelectedLeagueId(null);
                } else {
                  setSelectedLeagueId(parseInt(value, 10));
                }
              }}
            >
              <SelectTrigger className="bg-[#0d1117] border-[#1e2736] text-white h-10 w-full">
                <Trophy size={16} className="text-amber-500 mr-2 flex-shrink-0" />
                <SelectValue placeholder="Tüm Ligler" />
              </SelectTrigger>
              <SelectContent className="bg-[#0d1117] border-[#1e2736] text-white max-h-[300px]">
                <SelectItem 
                  value="all"
                  className="text-white focus:bg-[#1a2332] focus:text-white cursor-pointer hover:bg-[#1a2332]"
                >
                  Tüm Ligler
                </SelectItem>
                {leaguesLoading ? (
                  <SelectItem value="loading" disabled className="text-gray-500">
                    Yükleniyor...
                  </SelectItem>
                ) : (
                  leagues && leagues.length > 0 && leagues
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map((league) => (
                      <SelectItem
                        key={league.id}
                        value={league.id.toString()}
                        className="text-white focus:bg-[#1a2332] focus:text-white cursor-pointer hover:bg-[#1a2332]"
                      >
                        {league.name || 'Bilinmeyen Lig'}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="outline" 
            className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]"
            onClick={refetch}
            disabled={isLoading}
          >
            <Filter size={16} />
          </Button>
        </div>
      </div>

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


      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-6">
          <TabsTrigger
            value="upcoming"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
          >
            Gelecek Maçlar ({upcomingCount})
          </TabsTrigger>
          <TabsTrigger
            value="past"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
          >
            Geçmiş Maçlar ({pastMatchesCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-0">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <MatchCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingMatches.map((match) => (
                  <MatchCard
                    key={`${match.id}-${match.date}-${match.homeTeam}-${match.awayTeam}`}
                    match={match}
                  />
                ))}
              </div>
              {upcomingMatches.length === 0 && !isLoading && (
                <div className="text-center py-16 text-gray-500">
                  {searchTerm ? 'Arama kriterlerinize uygun gelecek maç bulunamadı' : 'Yakın zamanda maç bulunamadı'}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-0">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <MatchCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {pastMatches.map((match) => (
                  <MatchCard
                    key={`${match.id}-${match.date}-${match.homeTeam}-${match.awayTeam}`}
                    match={match}
                  />
                ))}
              </div>
              {pastMatches.length === 0 && !isLoading && (
                <div className="text-center py-16 text-gray-500">
                  {searchTerm ? 'Arama kriterlerinize uygun geçmiş maç bulunamadı' : 'Geçmiş maç bulunamadı'}
                </div>
              )}
              
              {/* Postponed matches at the bottom */}
              {postponedMatches.length > 0 && (
                <div className="mt-8 pt-8 border-t border-[#1e2736]">
                  <h3 className="text-lg font-semibold text-gray-400 mb-4">Ertelenen Maçlar</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {postponedMatches.map((match) => (
                      <MatchCard
                        key={`${match.id}-${match.date}-${match.homeTeam}-${match.awayTeam}`}
                        match={match}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MatchesPage;
