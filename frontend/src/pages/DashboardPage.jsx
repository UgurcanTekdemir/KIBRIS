import React from 'react';
import { useAuth } from '../context/AuthContext';
import { mockCoupons, transactions } from '../data/mockData';
import { User, Wallet, FileText, TrendingUp, Clock, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { formatFirestoreDate, formatFirestoreDateTime } from '../utils/dateUtils';

const DashboardPage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-white">Giriş yapmalısınız</h2>
      </div>
    );
  }

  const userCoupons = mockCoupons.filter((c) => c.userId === user.id);
  const userTransactions = transactions.filter((t) => t.userId === user.id);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Beklemede</Badge>;
      case 'won':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Kazanıldı</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Kaybedildi</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30">İptal</Badge>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4">
      {/* User Info */}
      <div className="bg-gradient-to-br from-[#1a2332] to-[#0d1117] border border-[#2a3a4d] rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center">
            <User size={24} className="sm:w-8 sm:h-8 text-black" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{user.username}</h1>
            <p className="text-sm sm:text-base text-amber-500">
              {user.role === 'admin' ? 'Admin' : user.role === 'agent' ? 'Bayi' : 'Kullanıcı'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-[#0a0e14] rounded-xl p-2 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
              <Wallet size={14} className="sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Bakiye</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{(user.balance || 0).toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-[#0a0e14] rounded-xl p-2 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
              <TrendingUp size={14} className="sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Kredi Limiti</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-500">{(user.credit || 0).toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-[#0a0e14] rounded-xl p-2 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
              <FileText size={14} className="sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Açık Kupon</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-amber-500">
              {userCoupons.filter((c) => c.status === 'pending').length}
            </p>
          </div>
          <div className="bg-[#0a0e14] rounded-xl p-2 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
              <Clock size={14} className="sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Üye Tarihi</span>
            </div>
            <p className="text-sm sm:text-lg font-bold text-white">{formatFirestoreDate(user.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="coupons">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-4 sm:mb-6 overflow-x-auto">
          <TabsTrigger value="coupons" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-xs sm:text-sm whitespace-nowrap">
            Kuponlarım
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-xs sm:text-sm whitespace-nowrap">
            İşlemler
          </TabsTrigger>
        </TabsList>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="mt-0">
          <div className="space-y-4">
            {userCoupons.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                Henüz kupon oluşturmadınız
              </div>
            ) : (
              userCoupons.map((coupon) => (
                <div key={coupon.id} className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-[#0a0e14] border-b border-[#1e2736]">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-mono font-medium">{coupon.id}</span>
                      {getStatusBadge(coupon.status)}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatFirestoreDateTime(coupon.createdAt)}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2 mb-4">
                      {coupon.selections.map((sel, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">{sel.matchName}</span>
                          <span className="text-amber-500 font-medium">{sel.odds.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#1e2736]">
                      <div>
                        <span className="text-gray-500 text-sm">Yatırılan: </span>
                        <span className="text-white font-medium">{coupon.stake} ₺</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-sm">Toplam Oran: </span>
                        <span className="text-white font-medium">{coupon.totalOdds.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-sm">Olası Kazanç: </span>
                        <span className="text-green-500 font-bold">{coupon.potentialWin.toFixed(2)} ₺</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-0">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
            {userTransactions.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                Henüz işlem yok
              </div>
            ) : (
              <div className="divide-y divide-[#1e2736]">
                {userTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        tx.amount > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {tx.amount > 0 ? (
                          <ArrowDownLeft size={20} className="text-green-500" />
                        ) : (
                          <ArrowUpRight size={20} className="text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{tx.description}</p>
                        <p className="text-xs text-gray-500">{tx.date}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${
                      tx.amount > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardPage;
