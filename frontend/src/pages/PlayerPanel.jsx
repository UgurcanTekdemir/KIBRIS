import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserCoupons } from '../services/couponService';
import { getUserTransactions } from '../services/transactionService';
import { formatFirestoreDate } from '../utils/dateUtils';
import {
  LayoutDashboard, FileText, Wallet, TrendingUp
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';

const PlayerPanel = () => {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role === 'player') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [couponsData, transactionsData] = await Promise.all([
        getUserCoupons(user.id, 100),
        getUserTransactions(user.id, 100),
      ]);
      setCoupons(couponsData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'player') {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-white">Bu sayfaya erişim yetkiniz yok</h2>
      </div>
    );
  }

  // Calculate statistics
  const totalBets = transactions.filter(t => t.type === 'bet').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalWins = transactions.filter(t => t.type === 'win').reduce((sum, t) => sum + t.amount, 0);
  const pendingCoupons = coupons.filter(c => c.status === 'pending');
  const wonCoupons = coupons.filter(c => c.status === 'won');
  const lostCoupons = coupons.filter(c => c.status === 'lost');

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <LayoutDashboard size={24} className="text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Oyuncu Panel</h1>
          <p className="text-sm text-gray-400">Kuponlarım ve İşlemlerim</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Wallet size={16} />
            <span className="text-sm">Bakiyem</span>
          </div>
          <p className="text-2xl font-bold text-white">{(user.balance || 0).toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <FileText size={16} />
            <span className="text-sm">Açık Kupon</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{pendingCoupons.length}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <TrendingUp size={16} />
            <span className="text-sm">Kazanan</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{wonCoupons.length}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <TrendingUp size={16} />
            <span className="text-sm">Kaybeden</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{lostCoupons.length}</p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="coupons">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-6">
          <TabsTrigger value="coupons" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <FileText size={16} className="mr-2" />
            Kuponlarım
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <FileText size={16} className="mr-2" />
            İşlemlerim
          </TabsTrigger>
        </TabsList>

        {/* Coupons Tab */}
        <TabsContent value="coupons">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e2736]">
                    <TableHead className="text-gray-400">Kupon No</TableHead>
                    <TableHead className="text-gray-400">Seçim Sayısı</TableHead>
                    <TableHead className="text-gray-400">Yatırılan</TableHead>
                    <TableHead className="text-gray-400">Oran</TableHead>
                    <TableHead className="text-gray-400">Olası Kazanç</TableHead>
                    <TableHead className="text-gray-400">Durum</TableHead>
                    <TableHead className="text-gray-400">Tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id} className="border-[#1e2736]">
                      <TableCell className="text-white font-mono text-xs">{coupon.uniqueId || coupon.id}</TableCell>
                      <TableCell className="text-gray-400">{coupon.selections?.length || 0}</TableCell>
                      <TableCell className="text-white">{coupon.stake.toLocaleString('tr-TR')} ₺</TableCell>
                      <TableCell className="text-amber-500 font-medium">{coupon.totalOdds?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell className="text-green-500 font-medium">{coupon.potentialWin?.toLocaleString('tr-TR') || '0'} ₺</TableCell>
                      <TableCell>
                        <Badge className={
                          coupon.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                          coupon.status === 'won' ? 'bg-green-500/20 text-green-500' :
                          'bg-red-500/20 text-red-500'
                        }>
                          {coupon.status === 'pending' ? 'Beklemede' : 
                           coupon.status === 'won' ? 'Kazanıldı' : 'Kaybedildi'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {formatFirestoreDate(coupon.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e2736]">
                    <TableHead className="text-gray-400">Tarih</TableHead>
                    <TableHead className="text-gray-400">Tip</TableHead>
                    <TableHead className="text-gray-400">Miktar</TableHead>
                    <TableHead className="text-gray-400">Açıklama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id} className="border-[#1e2736]">
                      <TableCell className="text-gray-400">
                        {formatFirestoreDate(transaction.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          transaction.type === 'bet' ? 'bg-red-500/20 text-red-500' :
                          transaction.type === 'win' ? 'bg-green-500/20 text-green-500' :
                          transaction.type === 'credit_add' ? 'bg-blue-500/20 text-blue-500' :
                          'bg-gray-500/20 text-gray-500'
                        }>
                          {transaction.type === 'bet' ? 'Bahis' :
                           transaction.type === 'win' ? 'Kazanç' :
                           transaction.type === 'credit_add' ? 'Kredi Eklendi' :
                           transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={
                        transaction.amount > 0 ? 'text-green-500' : 'text-red-500'
                      }>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString('tr-TR')} ₺
                      </TableCell>
                      <TableCell className="text-gray-400">{transaction.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayerPanel;

