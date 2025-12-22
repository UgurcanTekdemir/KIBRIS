import React from 'react';
import { useBetSlip } from '../context/BetSlipContext';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const BetSlipPage = () => {
  const { selections, stake, setStake, removeSelection, clearSelections, totalOdds, potentialWin } = useBetSlip();
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

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

    updateBalance(-stake);
    toast.success(`Kupon oluşturuldu! Toplam oran: ${totalOdds.toFixed(2)}`);
    clearSelections();
    navigate('/coupons');
  };

  return (
    <div className="max-w-2xl mx-auto pb-4">
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-3 sm:mb-4 transition-colors text-sm">
        <ArrowLeft size={16} />
        <span>Geri</span>
      </Link>

      <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl sm:rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#1e2736]">
          <h1 className="text-lg sm:text-xl font-bold text-white">Kupon</h1>
          {selections.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelections}
              className="text-gray-400 hover:text-red-500 text-sm"
            >
              <Trash2 size={14} className="mr-1.5" />
              Temizle
            </Button>
          )}
        </div>

        {selections.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4">
            <p className="text-gray-500 mb-4">Kuponunuz boş</p>
            <Link to="/">
              <Button variant="outline" className="border-[#2a3a4d] text-white">
                Maçlara Git
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Selections */}
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              {selections.map((selection, index) => (
                <div
                  key={`${selection.matchId}-${selection.marketName}-${index}`}
                  className="bg-[#1a2332] rounded-lg sm:rounded-xl p-3 sm:p-4 relative"
                >
                  <button
                    onClick={() => removeSelection(selection.matchId, selection.marketName)}
                    className="absolute top-2 sm:top-3 right-2 sm:right-3 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-1">{selection.league}</p>
                  <p className="text-white font-medium text-sm sm:text-base mb-2 pr-6">{selection.matchName}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs sm:text-sm">
                      <span className="text-gray-400">{selection.marketName}: </span>
                      <span className="text-amber-500 font-medium">{selection.option}</span>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-amber-500">
                      {selection.odds.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-[#1e2736] space-y-3 sm:space-y-4">
              {/* Stake */}
              <div>
                <label className="text-xs sm:text-sm text-gray-400 mb-1.5 sm:mb-2 block">Bahis Miktarı (₺)</label>
                <Input
                  type="number"
                  value={stake || ''}
                  onChange={(e) => setStake(Number(e.target.value))}
                  placeholder="0.00"
                  className="bg-[#1a2332] border-[#2a3a4d] text-white text-lg sm:text-xl font-bold h-12 sm:h-14"
                />
              </div>

              {/* Quick Stakes */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {[50, 100, 250, 500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setStake(amount)}
                    className="py-2 text-xs sm:text-sm font-medium bg-[#1a2332] text-gray-400 hover:text-white hover:bg-[#2a3a4d] rounded-lg transition-colors"
                  >
                    {amount} ₺
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-[#1a2332] rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Seçim Sayısı</span>
                  <span className="text-white font-medium">{selections.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Toplam Oran</span>
                  <span className="text-amber-500 font-bold">{totalOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base sm:text-lg pt-2 border-t border-[#2a3a4d]">
                  <span className="text-gray-400">Olası Kazanç</span>
                  <span className="text-green-500 font-bold">
                    {potentialWin.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                </div>
              </div>

              {/* Warning */}
              {!user && (
                <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-amber-500">Bahis yapmak için giriş yapın</p>
                </div>
              )}

              {/* Place Bet */}
              <Button
                onClick={handlePlaceBet}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 sm:py-4 text-base sm:text-lg"
                disabled={!user || stake <= 0}
              >
                Kupon Oluştur
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BetSlipPage;
