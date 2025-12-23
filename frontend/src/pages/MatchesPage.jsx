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
  const today = new Date().toISOString().split('T')[0];

  // Sync URL search param with local state
  useEffect(() => {
    if (urlSearchQuery && urlSearchQuery !== searchTerm) {
      setSearchTerm(urlSearchQuery);
    }
  }, [urlSearchQuery]);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dayAfterTomorrow = new Date(Date.now() + 172800000).toISOString().split('T')[0];

  // Fetch matches for today, tomorrow, and future
  const { matches: allMatches, loading, error, refetch } = useMatches({ matchType: 1 });

  const filteredMatches = useMemo(() => {
    if (!allMatches || allMatches.length === 0) return [];
    
    return allMatches.filter(
      (match) =>
        match.homeTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.awayTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.league?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allMatches, searchTerm]);

  const todayMatches = useMemo(() => {
    return filteredMatches.filter(
      (m) => m.isLive || m.date === today
    );
  }, [filteredMatches, today]);

  const tomorrowMatches = useMemo(() => {
    return filteredMatches.filter((m) => m.date === tomorrow);
  }, [filteredMatches, tomorrow]);

  const futureMatches = useMemo(() => {
    return filteredMatches.filter((m) => m.date && m.date > tomorrow);
  }, [filteredMatches, tomorrow]);

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
              {loading ? 'Yükleniyor...' : `${filteredMatches.length} maç listeleniyor`}
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
            disabled={loading}
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
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-6">
          <TabsTrigger
            value="today"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
          >
            Bugün ({todayMatches.length})
          </TabsTrigger>
          <TabsTrigger
            value="tomorrow"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
          >
            Yarın ({tomorrowMatches.length})
          </TabsTrigger>
          <TabsTrigger
            value="future"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
          >
            Gelecek ({futureMatches.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-0">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <MatchCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {todayMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
              {todayMatches.length === 0 && !loading && (
                <div className="text-center py-16 text-gray-500">
                  Bugün için maç bulunamadı
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="tomorrow" className="mt-0">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <MatchCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {tomorrowMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
              {tomorrowMatches.length === 0 && !loading && (
                <div className="text-center py-16 text-gray-500">
                  Yarın için maç bulunamadı
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="future" className="mt-0">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <MatchCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {futureMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
              {futureMatches.length === 0 && !loading && (
                <div className="text-center py-16 text-gray-500">
                  Gelecek maç bulunamadı
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
