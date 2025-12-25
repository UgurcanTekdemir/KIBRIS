import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAgentPlayers, 
  banUser, 
  unbanUser 
} from '../services/userService';
import { addCredit, removeCredit } from '../services/creditService';
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

  useEffect(() => {
    if (user && user.role === 'agent') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playersData, couponsData, transactionsData] = await Promise.all([
        getAgentPlayers(user.id),
        getAgentCoupons(user.id, 200),
        getAgentTransactions(user.id, 200),
      ]);
      setPlayers(playersData);
      setCoupons(couponsData);
      setTransactions(transactionsData);
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
      if (creditType === 'add') {
        await addCredit(user.id, selectedPlayer.id, amount, `Bayi tarafından kredi eklendi`);
        toast.success(`${amount} ₺ kredi eklendi`);
      } else {
        await removeCredit(user.id, selectedPlayer.id, amount, `Bayi tarafından kredi çıkarıldı`);
        toast.success(`${amount} ₺ kredi çıkarıldı`);
      }
      setCreditDialogOpen(false);
      setCreditAmount('');
      setSelectedPlayer(null);
      await loadData();
      await refreshUser();
    } catch (error) {
      toast.error(error.message || 'İşlem başarısız');
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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <LayoutDashboard size={24} className="text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Bayi Panel</h1>
            <p className="text-sm text-gray-400">Oyuncu yönetimi</p>
          </div>
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
            <Users size={16} />
            <span className="text-sm">Oyuncu</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{totalPlayers}</p>
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
            <span className="text-sm">Net Kar/Zarar</span>
          </div>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {netProfit.toLocaleString('tr-TR')} ₺
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="players">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-6">
          <TabsTrigger value="players" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <Users size={16} className="mr-2" />
            Oyuncularım
          </TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <FileText size={16} className="mr-2" />
            Kuponlar
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <FileText size={16} className="mr-2" />
            İşlemler
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <TrendingUp size={16} className="mr-2" />
            Analiz
          </TabsTrigger>
        </TabsList>

        {/* Players Tab */}
        <TabsContent value="players">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Oyuncu ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-[#080b10] border-[#1e2736] text-white"
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
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setCreditType('add');
                              setCreditDialogOpen(true);
                            }}
                            className="border-[#2a3a4d] text-xs"
                          >
                            Kredi Ekle
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setCreditType('remove');
                              setCreditDialogOpen(true);
                            }}
                            className="border-[#2a3a4d] text-xs"
                          >
                            Kredi Çıkar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBanUser(player.id, player.isBanned)}
                            className="border-[#2a3a4d] text-xs"
                          >
                            {player.isBanned ? <CheckCircle size={14} /> : <Ban size={14} />}
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
      </Tabs>

      {/* Credit Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white">
          <DialogHeader>
            <DialogTitle>
              {creditType === 'add' ? 'Kredi Ekle' : 'Kredi Çıkar'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>
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
