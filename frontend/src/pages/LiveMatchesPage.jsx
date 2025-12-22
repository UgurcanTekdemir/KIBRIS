import React from 'react';
import { liveMatches } from '../data/mockData';
import MatchCard from '../components/betting/MatchCard';
import { Zap, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';

const LiveMatchesPage = () => {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Zap size={24} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Canlı Maçlar
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </h1>
            <p className="text-sm text-gray-400">{liveMatches.length} maç şu anda canlı</p>
          </div>
        </div>
        <Button variant="outline" className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]">
          <RefreshCw size={16} className="mr-2" />
          Yenile
        </Button>
      </div>

      {/* Live indicator bar */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-red-500 font-medium">CANLI YAYIN</span>
          <span className="text-gray-400 text-sm ml-2">
            Oranlar gerçek zamanlı güncelleniyor
          </span>
        </div>
      </div>

      {/* Matches Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {liveMatches.map((match) => (
          <MatchCard key={match.id} match={match} showFullMarkets />
        ))}
      </div>

      {/* Empty State */}
      {liveMatches.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
            <Zap size={40} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Şu anda canlı maç yok</h3>
          <p className="text-gray-500">Yakında başlayacak maçları kontrol edin</p>
        </div>
      )}
    </div>
  );
};

export default LiveMatchesPage;
