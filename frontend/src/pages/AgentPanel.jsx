import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAgentPlayers, 
  banUser, 
  unbanUser 
} from '../services/userService';
import { addCredit, removeCredit, getPendingCredits, approveCredit, getSentCreditHistory } from '../services/creditService';
import { addBalance, removeBalance, getSentBalanceHistory } from '../services/balanceService';
import { getAgentCoupons } from '../services/couponService';
import { getAgentTransactions } from '../services/transactionService';
import { formatFirestoreDate } from '../utils/dateUtils';
import {
  LayoutDashboard, Users, FileText, Wallet, TrendingUp, TrendingDown,
  Plus, Search, UserPlus, Ban, CheckCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const AgentPanel = () => {
  const { user, refreshUser } = useAuth();
  const [players, setPlayers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState('add');
  const [operationType, setOperationType] = useState('credit'); // 'credit' or 'balance'
  const [pendingCredits, setPendingCredits] = useState([]);
  const [creditHistory, setCreditHistory] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'credit', 'balance'

  useEffect(() => {
    if (user && user.role === 'agent') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playersData, couponsData, transactionsData, pendingCreditsData, creditHistoryData, balanceHistoryData] = await Promise.all([
        getAgentPlayers(user.id),
        getAgentCoupons(user.id, 200),
        getAgentTransactions(user.id, 200),
        getPendingCredits(user.id, 200),
        getSentCreditHistory(user.id, 200),
        getSentBalanceHistory(user.id, 200),
      ]);
      setPlayers(playersData);
      setCoupons(couponsData);
      setTransactions(transactionsData);
      setPendingCredits(pendingCreditsData);
      setCreditHistory(creditHistoryData);
      setBalanceHistory(balanceHistoryData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'agent') {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-white">Bu sayfaya erişim yetkiniz yok</h2>
      </div>
    );
  }

  // Calculate statistics
  const totalPlayers = players.length;
  const totalPlayerBalance = players.reduce((sum, p) => sum + (p.balance || 0), 0);
  const totalPlayerCredit = players.reduce((sum, p) => sum + (p.credit || 0), 0);
  const pendingCoupons = coupons.filter(c => c.status === 'pending');
  const totalBets = transactions.filter(t => t.type === 'bet').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalWins = transactions.filter(t => t.type === 'win').reduce((sum, t) => sum + t.amount, 0);
  const totalCommissions = transactions.filter(t => t.type === 'commission').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalCommissions - totalWins;

  const handleCreditOperation = async () => {
    if (!selectedPlayer || !creditAmount) {
      toast.error('Lütfen miktar girin');
      return;
    }

    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Geçerli bir miktar girin');
      return;
    }

    try {
      if (operationType === 'credit') {
      if (creditType === 'add') {
        await addCredit(user.id, selectedPlayer.id, amount, `Bayi tarafından kredi eklendi`);
          toast.success(`${amount} ₺ kredi beklemede olarak eklendi`);
      } else {
        await removeCredit(user.id, selectedPlayer.id, amount, `Bayi tarafından kredi çıkarıldı`);
        toast.success(`${amount} ₺ kredi çıkarıldı`);
        }
      } else {
        // Balance operation
        if (creditType === 'add') {
          await addBalance(user.id, selectedPlayer.id, amount, `Bayi tarafından bakiye eklendi`);
          toast.success(`${amount} ₺ bakiye eklendi`);
        } else {
          await removeBalance(user.id, selectedPlayer.id, amount, `Bayi tarafından bakiye çıkarıldı`);
          toast.success(`${amount} ₺ bakiye çıkarıldı`);
        }
      }
      setCreditDialogOpen(false);
      setCreditAmount('');
      setSelectedPlayer(null);
      setOperationType('credit');
      await loadData();
      await refreshUser();
    } catch (error) {
      toast.error(error.message || 'İşlem başarısız');
    }
  };

  const handleApproveCredit = async (creditId) => {
    try {
      await approveCredit(creditId, user.id);
      toast.success('Kredi onaylandı ve bakiyeye eklendi');
      await loadData();
      await refreshUser();
    } catch (error) {
      toast.error(error.message || 'Kredi onaylanamadı');
    }
  };

  const handleBanUser = async (userId, isBanned) => {
    try {
      if (isBanned) {
        await unbanUser(userId);
        toast.success('Oyuncu yasağı kaldırıldı');
      } else {
        await banUser(userId);
        toast.success('Oyuncu yasaklandı');
      }
      await loadData();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const filteredPlayers = players.filter(p => 
    p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <LayoutDashboard size={20} className="sm:w-6 sm:h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Bayi Panel</h1>
            <p className="text-xs sm:text-sm text-gray-400">Oyuncu yönetimi</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-2 sm:p-4">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
            <Wallet size={14} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">Bakiyem</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-white">{(user.balance || 0).toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-2 sm:p-4">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
            <Users size={14} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">Oyuncu</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-blue-500">{totalPlayers}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-2 sm:p-4">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
            <FileText size={14} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">Açık Kupon</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-amber-500">{pendingCoupons.length}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-2 sm:p-4">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
            <TrendingUp size={14} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">Net Kar/Zarar</span>
          </div>
          <p className={`text-lg sm:text-2xl font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {netProfit.toLocaleString('tr-TR')} ₺
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="players">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-4 sm:mb-6 overflow-x-scroll overflow-y-hidden scrollbar-hide -mx-2 sm:mx-0 px-2 sm:px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsTrigger value="players" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <Users size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">Oyuncularım</span>
            <span className="xs:hidden group-hover:hidden data-[state=active]:hidden">Oyuncu</span>
          </TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <FileText size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">Kuponlar</span>
            <span className="xs:hidden group-hover:hidden data-[state=active]:hidden">Kupon</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <FileText size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">İşlemler</span>
            <span className="xs:hidden group-hover:hidden data-[state=active]:hidden">İşlem</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <TrendingUp size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">Analiz</span>
            <span className="xs:hidden group-hover:hidden data-[state=active]:hidden">Analiz</span>
          </TabsTrigger>
          <TabsTrigger value="credits" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <Wallet size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">Kredi Geçmişi</span>
            <span className="xs:hidden group-hover:hidden data-[state=active]:hidden">Kredi</span>
          </TabsTrigger>
        </TabsList>

        {/* Players Tab */}
        <TabsContent value="players">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-3 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="sm:w-4 sm:h-4 absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Oyuncu ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 sm:pl-9 bg-[#080b10] border-[#1e2736] text-white text-sm"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e2736]">
                    <TableHead className="text-gray-400">Kullanıcı Adı</TableHead>
                    <TableHead className="text-gray-400">E-posta</TableHead>
                    <TableHead className="text-gray-400">Bakiye</TableHead>
                    <TableHead className="text-gray-400">Kredi</TableHead>
                    <TableHead className="text-gray-400">Durum</TableHead>
                    <TableHead className="text-gray-400">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.map((player) => (
                    <TableRow key={player.id} className="border-[#1e2736]">
                      <TableCell className="text-white">{player.username}</TableCell>
                      <TableCell className="text-gray-400">{player.email}</TableCell>
                      <TableCell className="text-white">{(player.balance || 0).toLocaleString('tr-TR')} ₺</TableCell>
                      <TableCell className="text-white">{(player.credit || 0).toLocaleString('tr-TR')} ₺</TableCell>
                      <TableCell>
                        {player.isBanned ? (
                          <Badge variant="destructive">Yasaklı</Badge>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-500">Aktif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setCreditType('add');
                              setOperationType('credit');
                              setCreditDialogOpen(true);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-white border-amber-500 text-[10px] sm:text-xs px-2 sm:px-3 py-1 h-auto"
                          >
                            <span className="hidden sm:inline">Kredi Ekle</span>
                            <span className="sm:hidden">Kredi</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setCreditType('add');
                              setOperationType('balance');
                              setCreditDialogOpen(true);
                            }}
                            className="border-[#2a3a4d] text-[10px] sm:text-xs px-2 sm:px-3 py-1 h-auto bg-blue-500/20 hover:bg-blue-500/30"
                          >
                            <span className="hidden sm:inline">Bakiye Ekle</span>
                            <span className="sm:hidden">Bakiye</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setCreditType('remove');
                              setOperationType('credit');
                              setCreditDialogOpen(true);
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white border-red-500 text-[10px] sm:text-xs px-2 sm:px-3 py-1 h-auto"
                          >
                            <span className="hidden sm:inline">Kredi Çıkar</span>
                            <span className="sm:hidden">Çıkar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBanUser(player.id, player.isBanned)}
                            className="bg-red-500 hover:bg-red-600 text-white border-red-500 px-2 sm:px-3 py-1 h-auto"
                          >
                            {player.isBanned ? <CheckCircle size={12} className="sm:w-3.5 sm:h-3.5" /> : <Ban size={12} className="sm:w-3.5 sm:h-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e2736]">
                    <TableHead className="text-gray-400">Kupon No</TableHead>
                    <TableHead className="text-gray-400">Oyuncu</TableHead>
                    <TableHead className="text-gray-400">Yatırılan</TableHead>
                    <TableHead className="text-gray-400">Oran</TableHead>
                    <TableHead className="text-gray-400">Olası Kazanç</TableHead>
                    <TableHead className="text-gray-400">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.slice(0, 100).map((coupon) => {
                    const player = players.find(p => p.id === coupon.userId);
                    return (
                      <TableRow key={coupon.id} className="border-[#1e2736]">
                        <TableCell className="text-white font-mono text-xs">{coupon.uniqueId || coupon.id}</TableCell>
                        <TableCell className="text-gray-400">{player?.username || '-'}</TableCell>
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
                      </TableRow>
                    );
                  })}
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
                    <TableHead className="text-gray-400">Oyuncu</TableHead>
                    <TableHead className="text-gray-400">Tip</TableHead>
                    <TableHead className="text-gray-400">Miktar</TableHead>
                    <TableHead className="text-gray-400">Açıklama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 100).map((transaction) => {
                    const player = players.find(p => p.id === transaction.userId);
                    return (
                      <TableRow key={transaction.id} className="border-[#1e2736]">
                      <TableCell className="text-gray-400">
                        {formatFirestoreDate(transaction.createdAt)}
                      </TableCell>
                        <TableCell className="text-white">{player?.username || transaction.userId}</TableCell>
                        <TableCell>
                          <Badge className={
                            transaction.type === 'bet' ? 'bg-red-500/20 text-red-500' :
                            transaction.type === 'win' ? 'bg-green-500/20 text-green-500' :
                            transaction.type === 'commission' ? 'bg-amber-500/20 text-amber-500' :
                            'bg-blue-500/20 text-blue-500'
                          }>
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={
                          transaction.amount > 0 ? 'text-green-500' : 'text-red-500'
                        }>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString('tr-TR')} ₺
                        </TableCell>
                        <TableCell className="text-gray-400">{transaction.description}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">İstatistikler</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Toplam Bahis</span>
                  <span className="text-white font-semibold">{totalBets.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Toplam Kazanç</span>
                  <span className="text-green-500 font-semibold">{totalWins.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Toplam Komisyon</span>
                  <span className="text-amber-500 font-semibold">{totalCommissions.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between border-t border-[#1e2736] pt-3">
                  <span className="text-gray-400">Net Kar/Zarar</span>
                  <span className={`font-semibold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {netProfit.toLocaleString('tr-TR')} ₺
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-white">Kredi ve Bakiye Geçmişi</h3>
              <div className="flex gap-2">
                <Button
                  variant={historyFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setHistoryFilter('all')}
                  className={historyFilter === 'all' ? 'bg-amber-500 text-black' : 'text-xs sm:text-sm'}
                  size="sm"
                >
                  Tümü
                </Button>
                <Button
                  variant={historyFilter === 'credit' ? 'default' : 'outline'}
                  onClick={() => setHistoryFilter('credit')}
                  className={historyFilter === 'credit' ? 'bg-amber-500 text-black' : 'text-xs sm:text-sm'}
                  size="sm"
                >
                  Kredi
                </Button>
                <Button
                  variant={historyFilter === 'balance' ? 'default' : 'outline'}
                  onClick={() => setHistoryFilter('balance')}
                  className={historyFilter === 'balance' ? 'bg-blue-500 text-white' : 'text-xs sm:text-sm'}
                  size="sm"
                >
                  Bakiye
                </Button>
              </div>
            </div>

            {/* Pending Credits Section */}
            {pendingCredits.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm sm:text-base font-semibold text-amber-500 mb-3">Bekleyen Krediler</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1e2736]">
                        <TableHead className="text-gray-400 text-xs sm:text-sm">Tarih</TableHead>
                        <TableHead className="text-gray-400 text-xs sm:text-sm">Kime</TableHead>
                        <TableHead className="text-gray-400 text-xs sm:text-sm">Miktar</TableHead>
                        <TableHead className="text-gray-400 text-xs sm:text-sm">Durum</TableHead>
                        <TableHead className="text-gray-400 text-xs sm:text-sm">İşlemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCredits.map((credit) => (
                        <TableRow key={credit.id} className="border-[#1e2736]">
                          <TableCell className="text-gray-400 text-xs sm:text-sm">
                            {credit.createdAt ? formatFirestoreDate(credit.createdAt) : '-'}
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm">
                            {credit.toUsername || credit.toUserId}
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm font-semibold">
                            {credit.amount?.toLocaleString('tr-TR')} ₺
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-500/20 text-amber-500 text-xs sm:text-sm">Beklemede</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleApproveCredit(credit.id)}
                              className="bg-green-500 hover:bg-green-600 text-white text-xs"
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Ödendi
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Credit and Balance History */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e2736]">
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Tarih</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Kime</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">İşlem Tipi</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Miktar</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Durum</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Açıklama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Combine credit and balance history
                    const allHistory = [
                      ...creditHistory.map(item => ({ ...item, historyType: 'credit' })),
                      ...balanceHistory.map(item => ({ ...item, historyType: 'balance' }))
                    ].sort((a, b) => {
                      const aDate = a.createdAt?.toDate?.() || a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
                      const bDate = b.createdAt?.toDate?.() || b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
                      return bDate - aDate;
                    });

                    // Filter based on historyFilter
                    const filteredHistory = historyFilter === 'all' 
                      ? allHistory 
                      : allHistory.filter(item => item.historyType === historyFilter);

                    if (filteredHistory.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                            {historyFilter === 'all' ? 'Henüz işlem yok' : `${historyFilter === 'credit' ? 'Kredi' : 'Bakiye'} geçmişi yok`}
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return filteredHistory.map((item) => {
                      const player = players.find(p => p.id === item.userId || p.id === item.toUserId);
                      return (
                        <TableRow key={item.id} className="border-[#1e2736]">
                          <TableCell className="text-gray-400 text-xs sm:text-sm">
                            {item.createdAt ? formatFirestoreDate(item.createdAt) : '-'}
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm">
                            {player?.username || item.toUsername || item.userId || '-'}
                          </TableCell>
                          <TableCell>
                            {item.historyType === 'credit' ? (
                              <Badge className="bg-amber-500/20 text-amber-500 text-xs sm:text-sm">Kredi</Badge>
                            ) : (
                              <Badge className="bg-blue-500/20 text-blue-500 text-xs sm:text-sm">Bakiye</Badge>
                            )}
                          </TableCell>
                          <TableCell className={`text-xs sm:text-sm font-semibold ${item.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {item.amount > 0 ? '+' : ''}{Math.abs(item.amount || 0).toLocaleString('tr-TR')} ₺
                          </TableCell>
                          <TableCell>
                            {item.status === 'pending' ? (
                              <Badge className="bg-amber-500/20 text-amber-500 text-xs sm:text-sm">Beklemede</Badge>
                            ) : item.status === 'paid' || item.historyType === 'balance' ? (
                              <Badge className="bg-green-500/20 text-green-500 text-xs sm:text-sm">Tamamlandı</Badge>
                            ) : (
                              <Badge className="bg-gray-500/20 text-gray-400 text-xs sm:text-sm">İptal</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs sm:text-sm">
                            {item.description || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Credit/Balance Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {operationType === 'credit' 
                ? (creditType === 'add' ? 'Kredi Ekle' : 'Kredi Çıkar')
                : (creditType === 'add' ? 'Bakiye Ekle' : 'Bakiye Çıkar')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={operationType === 'credit' ? 'default' : 'outline'}
                onClick={() => setOperationType('credit')}
                className={operationType === 'credit' ? 'bg-amber-500 text-black' : ''}
              >
                Kredi
              </Button>
              <Button
                variant={operationType === 'balance' ? 'default' : 'outline'}
                onClick={() => setOperationType('balance')}
                className={operationType === 'balance' ? 'bg-blue-500 text-white' : ''}
              >
                Bakiye
              </Button>
            </div>
            <div>
              <Label>Oyuncu</Label>
              <Input value={selectedPlayer?.username || ''} disabled className="bg-[#080b10] border-[#1e2736]" />
            </div>
            <div>
              <Label>Miktar (₺)</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="bg-[#080b10] border-[#1e2736] text-white"
                placeholder="0"
              />
            </div>
            {operationType === 'credit' && creditType === 'add' && (
              <p className="text-xs text-amber-500">
                ⚠️ Kredi beklemede olarak eklenecek, onaylandıktan sonra bakiyeye eklenecek
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setCreditDialogOpen(false);
                setCreditAmount('');
                setOperationType('credit');
              }}>
                İptal
              </Button>
              <Button onClick={handleCreditOperation}>
                {creditType === 'add' ? 'Ekle' : 'Çıkar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentPanel;
