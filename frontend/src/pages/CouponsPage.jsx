import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserCoupons } from '../services/couponService';
import { FileText, Filter } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { formatFirestoreDateTime } from '../utils/dateUtils';

const CouponsPage = () => {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCoupons();
    }
  }, [user]);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const userCoupons = await getUserCoupons(user.id, 100);
      setCoupons(userCoupons);
    } catch (error) {
      console.error('Error loading coupons:', error);
      toast.error('Kuponlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-white">Giriş yapmalısınız</h2>
      </div>
    );
  }

  const pendingCoupons = coupons.filter((c) => c.status === 'pending');
  const settledCoupons = coupons.filter((c) => c.status !== 'pending');

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

  const CouponCard = ({ coupon }) => {
    return (
      <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0a0e14] border-b border-[#1e2736]">
          <div className="flex items-center gap-3">
            <span className="text-white font-mono font-medium text-xs">{coupon.uniqueId || coupon.id}</span>
            {getStatusBadge(coupon.status)}
          </div>
          <span className="text-xs text-gray-500">
            {formatFirestoreDateTime(coupon.createdAt)}
          </span>
        </div>
        <div className="p-4">
          <div className="space-y-2 mb-4">
            {coupon.selections?.map((sel, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-[#1a2332] rounded-lg p-3">
                <div>
                  <p className="text-white font-medium">{sel.matchName}</p>
                  <p className="text-xs text-gray-500">{sel.marketName}: {sel.option}</p>
                </div>
                <span className="text-amber-500 font-bold">{sel.odds?.toFixed(2) || '0.00'}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#1e2736]">
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-1">Yatırılan</p>
              <p className="text-white font-bold">{coupon.stake?.toLocaleString('tr-TR') || '0'} ₺</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-1">Toplam Oran</p>
              <p className="text-amber-500 font-bold">{coupon.totalOdds?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-1">Olası Kazanç</p>
              <p className="text-green-500 font-bold">{coupon.potentialWin?.toLocaleString('tr-TR') || '0'} ₺</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <FileText size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Kuponlarım</h1>
            <p className="text-sm text-gray-400">Toplam {coupons.length} kupon</p>
          </div>
        </div>
        <Button variant="outline" className="border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#1a2332]">
          <Filter size={16} className="mr-2" />
          Filtrele
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-6">
          <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            Açık Kuponlar ({pendingCoupons.length})
          </TabsTrigger>
          <TabsTrigger value="settled" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            Kapanmış ({settledCoupons.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0 space-y-4">
          {pendingCoupons.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <FileText size={32} className="text-gray-600" />
              </div>
              <p className="text-gray-500">Açık kuponunuz yok</p>
            </div>
          ) : (
            pendingCoupons.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} />
            ))
          )}
        </TabsContent>

        <TabsContent value="settled" className="mt-0 space-y-4">
          {settledCoupons.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <FileText size={32} className="text-gray-600" />
              </div>
              <p className="text-gray-500">Kapanmış kuponunuz yok</p>
            </div>
          ) : (
            settledCoupons.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CouponsPage;
