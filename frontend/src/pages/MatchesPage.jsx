import React, { useState } from 'react';
import { liveMatches, upcomingMatches } from '../data/mockData';
import MatchCard from '../components/betting/MatchCard';
import { Calendar, Filter, Search } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const MatchesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const allMatches = [...liveMatches, ...upcomingMatches];

  const filteredMatches = allMatches.filter(
    (match) =>
      match.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.league.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todayMatches = filteredMatches.filter(
    (m) => m.isLive || m.date === '2025-07-15'
  );
  const tomorrowMatches = filteredMatches.filter((m) => m.date === '2025-07-16');
  const futureMatches = filteredMatches.filter((m) => m.date === '2025-07-17');

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
            <p className="text-sm text-gray-400">{allMatches.length} maç listeleniyor</p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Takım veya lig ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#0d1117] border-[#1e2736] text-white"
            />
          </div>
          <Button variant="outline" className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]">
            <Filter size={16} />
          </Button>
        </div>
      </div>

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
          <div className="grid gap-4 md:grid-cols-2">
            {todayMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
          {todayMatches.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              Bugün için maç bulunamadı
            </div>
          )}
        </TabsContent>

        <TabsContent value="tomorrow" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            {tomorrowMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
          {tomorrowMatches.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              Yarın için maç bulunamadı
            </div>
          )}
        </TabsContent>

        <TabsContent value="future" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            {futureMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
          {futureMatches.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              Gelecek maç bulunamadı
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MatchesPage;
