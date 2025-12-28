import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MatchCard from '../components/betting/MatchCard';
import { Calendar, Filter, Search, AlertCircle } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatches } from '../hooks/useMatches';

const MatchesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearchQuery);
  const [activeTab, setActiveTab] = useState('upcoming');
  const today = new Date().toISOString().split('T')[0];
  // Calculate 7 days (1 week) from today for upcoming matches
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  // Calculate 7 days ago for past matches (lazy loaded only when past tab is active)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Sync URL search param with local state
  useEffect(() => {
    if (urlSearchQuery && urlSearchQuery !== searchTerm) {
      setSearchTerm(urlSearchQuery);
    }
  }, [urlSearchQuery, searchTerm]);

  // Lazy loading: Only fetch upcoming matches initially (fast load)
  const { matches: upcomingMatchesData, loading: upcomingLoading, error: upcomingError, refetch: refetchUpcoming } = useMatches({ 
    matchType: 1,
    date_from: today,
    date_to: sevenDaysLater
  });

  // Lazy loading: Only fetch past matches when past tab is active
  const shouldFetchPast = activeTab === 'past';
  const { matches: pastMatchesData, loading: pastLoading, error: pastError, refetch: refetchPast } = useMatches({ 
    matchType: 1,
    date_from: sevenDaysAgo,
    date_to: today
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

  const loading = activeTab === 'past' ? pastLoading : upcomingLoading;
  const error = activeTab === 'past' ? pastError : upcomingError;
  const refetch = activeTab === 'past' ? refetchPast : refetchUpcoming;
  
  // Check if matches have loaded with odds (markets)
  const hasMatchesWithOdds = useMemo(() => {
    if (loading) return false;
    if (!allMatches || allMatches.length === 0) return false;
    // Check if at least one match has markets with valid odds
    return allMatches.some(match => {
      if (!match.markets || !Array.isArray(match.markets)) return false;
      return match.markets.some(market => {
        if (!market.options || !Array.isArray(market.options)) return false;
        return market.options.some(opt => {
          const oddsValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
          return oddsValue > 0;
        });
      });
    });
  }, [allMatches, loading]);
  
  // Show loading until matches with odds are loaded
  const isLoading = loading;

  const filteredMatches = useMemo(() => {
    if (!allMatches || allMatches.length === 0) return [];
    
    return allMatches.filter(
      (match) =>
        match.homeTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.awayTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.league?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allMatches, searchTerm]);

  // Separate matches based on active tab
  const { upcomingMatches, pastMatches, postponedMatches } = useMemo(() => {
    const upcoming = [];
    const past = [];
    const postponed = [];
    
    for (const match of filteredMatches) {
      // Exclude live matches - they should only appear on Live Matches page
      if (match.isLive === true) {
        continue;
      }
      
      const status = (match.status || '').toUpperCase();
      const isPostponed = status === 'POSTPONED';
      const isFinished = status === 'FT' || status === 'FINISHED' || status === 'CANCELED' || status === 'CANCELLED';
      const isPastDate = match.date < today;
      
      if (isPostponed) {
        // Postponed matches go to separate list
        postponed.push(match);
      } else if (isFinished || isPastDate) {
        // Past matches
        past.push(match);
      } else {
        // Upcoming matches
        upcoming.push(match);
      }
    }
    
    // Sort upcoming by date/time (ascending)
    upcoming.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (a.time || '').localeCompare(b.time || '');
    });
    
    // Sort past by date/time (descending - most recent first)
    past.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
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
  
  // Calculate past matches count for display (only when data is available)
  const pastMatchesCount = useMemo(() => {
    if (!shouldFetchPast || !pastMatchesData) {
      return '...';
    }
    return pastMatches.length;
  }, [shouldFetchPast, pastMatchesData, pastMatches.length]);

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
              {isLoading ? 'Oranlar yükleniyor...' : `${filteredMatches.length} maç listeleniyor`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Takım veya lig ara..."
              value={searchTerm}
              onChange={(e) => {
                const newValue = e.target.value;
                setSearchTerm(newValue);
                // Update URL search param
                if (newValue.trim()) {
                  setSearchParams({ search: newValue.trim() });
                } else {
                  setSearchParams({});
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              className="pl-9 bg-[#0d1117] border-[#1e2736] text-white"
            />
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

      {/* No-odds Warning (prevents infinite skeleton when API returns matches without odds) */}
      {!loading && !error && filteredMatches.length > 0 && !hasMatchesWithOdds && (
        <Alert className="mb-6 bg-amber-500/10 border-amber-500/30">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-white">
            Şu an maçlar listeleniyor fakat oran verisi bulunamadı. Birkaç dakika sonra tekrar deneyin.
            <Button
              variant="link"
              onClick={refetch}
              className="ml-2 text-amber-500 hover:text-amber-400 p-0 h-auto"
            >
              Yenile
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
            Gelecek Maçlar ({upcomingMatches.length})
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
