import React from 'react';
import { useBetSlip } from '../../context/BetSlipContext';
import { useAuth } from '../../context/AuthContext';
import { X, Trash2, Receipt, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';

const BetSlip = () => {
  const { selections, stake, setStake, removeSelection, clearSelections, totalOdds, potentialWin } = useBetSlip();
  const { user, updateBalance } = useAuth();

  const handlePlaceBet = () => {
    if (!user) {
      toast.error('Bahis yapabilmek için giriş yapmalısınız!');
      return;
    }
    if (stake <= 0) {
      toast.error('Geçerli bir miktar giriniz!');
      return;
    }
    if (stake > user.balance) {
      toast.error('Yetersiz bakiye!');
      return;
    }
    if (selections.length === 0) {
      toast.error('En az bir seçim yapınız!');
      return;
    }

    // Simulate placing bet
    updateBalance(-stake);
    toast.success(`Kupon oluşturuldu! Toplam oran: ${totalOdds.toFixed(2)}`);
    clearSelections();
  };

  if (selections.length === 0) {
    return (
      <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Receipt size={20} className="text-amber-500" />
          <h3 className="text-white font-semibold">Kupon</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
            <Receipt size={32} className="text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm">Kuponunuz boş</p>
          <p className="text-gray-600 text-xs mt-1">Maçlara tıklayarak seçim yapın</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden flex flex-col h-full max-h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1e2736]">
        <div className="flex items-center gap-2">
          <Receipt size={20} className="text-amber-500" />
          <h3 className="text-white font-semibold">Kupon</h3>
          <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
            {selections.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelections}
          className="text-gray-400 hover:text-red-500"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Selections */}
      <ScrollArea className="h-[calc(100vh-400px)] min-h-[200px] max-h-[400px]">
        <div className="p-3 space-y-2">
          {selections.map((selection, index) => (
            <div
              key={`${selection.matchId}-${selection.marketName}-${index}`}
              className="bg-[#1a2332] rounded-lg p-3 relative group"
            >
              <button
                onClick={() => removeSelection(selection.matchId, selection.marketName)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-500"
              >
                <X size={16} />
              </button>
              <p className="text-xs text-gray-500 mb-1">{selection.league}</p>
              <p className="text-white text-sm font-medium mb-1 pr-6">
                {selection.matchName}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {selection.marketName}: <span className="text-amber-500">{selection.option}</span>
                </span>
                <span className="text-amber-500 font-bold text-sm">
                  {selection.odds.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-[#1e2736] space-y-3 mt-auto">
        {/* Stake Input */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Bahis Miktarı (₺)</label>
          <Input
            type="number"
            value={stake || ''}
            onChange={(e) => setStake(Number(e.target.value))}
            placeholder="0.00"
            className="bg-[#1a2332] border-[#2a3a4d] text-white text-lg font-semibold"
          />
        </div>

        {/* Quick Stakes */}
        <div className="flex gap-2">
          {[50, 100, 250, 500].map((amount) => (
            <button
              key={amount}
              onClick={() => setStake(amount)}
              className="flex-1 py-1.5 text-xs font-medium bg-[#1a2332] text-gray-400 hover:text-white hover:bg-[#2a3a4d] rounded transition-colors"
            >
              {amount}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-2 pt-2 border-t border-[#1e2736]">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Toplam Oran</span>
            <span className="text-white font-semibold">{totalOdds.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Olası Kazanç</span>
            <span className="text-green-500 font-bold">
              {potentialWin.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>
        </div>

        {/* Warning if not logged in */}
        {!user && (
          <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-500">Bahis yapmak için giriş yapın</p>
          </div>
        )}

        {/* Place Bet Button */}
        <Button
          onClick={handlePlaceBet}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3"
          disabled={!user || stake <= 0 || selections.length === 0}
        >
          Kupon Oluştur
        </Button>
      </div>
    </div>
  );
};

export default BetSlip;
