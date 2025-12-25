import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllAgents, 
  getAllPlayers, 
  banUser, 
  unbanUser,
  createUser 
} from '../services/userService';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { addCredit, removeCredit, getSentCreditHistory } from '../services/creditService';
import { addBalance, removeBalance } from '../services/balanceService';
import { getAllTransactions } from '../services/transactionService';
import { getAllCoupons } from '../services/couponService';
import { formatFirestoreDate, formatFirestoreDateTime } from '../utils/dateUtils';
import {
  LayoutDashboard, Users, FileText, Wallet, TrendingUp, TrendingDown,
  Plus, Search, UserPlus, Ban, CheckCircle, XCircle
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

const SuperAdminPanel = () => {
  const { user, refreshUser } = useAuth();
  const [agents, setAgents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  
  // Dialog states
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState('add');
  const [operationType, setOperationType] = useState('credit'); // 'credit' or 'balance'
  
  // Player dialog states
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerAmount, setPlayerAmount] = useState('');
  const [playerOperationType, setPlayerOperationType] = useState('credit'); // 'credit' or 'balance'
  const [playerOperationAction, setPlayerOperationAction] = useState('add'); // 'add' or 'remove'
  
  const [newAgentDialogOpen, setNewAgentDialogOpen] = useState(false);
  const [newAgentData, setNewAgentData] = useState({
    email: '',
    username: '',
    password: '',
  });

  useEffect(() => {
    if (user && user.role === 'superadmin') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [agentsData, playersData, transactionsData, couponsData] = await Promise.all([
        getAllAgents(),
        getAllPlayers(),
        getAllTransactions(200),
        getAllCoupons(200),
      ]);
      setAgents(agentsData);
      setPlayers(playersData);
      setTransactions(transactionsData);
      setCoupons(couponsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'superadmin') {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-white">Bu sayfaya erişim yetkiniz yok</h2>
      </div>
    );
  }

  // Calculate statistics
  const totalAgents = agents.length;
  const totalPlayers = players.length;
  const totalBets = transactions.filter(t => t.type === 'bet').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalWins = transactions.filter(t => t.type === 'win').reduce((sum, t) => sum + t.amount, 0);
  const totalCommissions = transactions.filter(t => t.type === 'commission').reduce((sum, t) => sum + t.amount, 0);
  const totalCredits = agents.reduce((sum, a) => sum + (a.credit || 0), 0);
  const totalBalance = agents.reduce((sum, a) => sum + (a.balance || 0), 0);

  const handleCreditOperation = async () => {
    if (!selectedAgent || !creditAmount) {
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
          await addCredit(user.id, selectedAgent.id, amount, `Süperadmin tarafından kredi eklendi`);
          toast.success(`${amount} ₺ kredi eklendi`);
        } else {
          await removeCredit(user.id, selectedAgent.id, amount, `Süperadmin tarafından kredi çıkarıldı`);
          toast.success(`${amount} ₺ kredi çıkarıldı`);
        }
      } else {
        // Balance operation
        if (creditType === 'add') {
          await addBalance(user.id, selectedAgent.id, amount, `Süperadmin tarafından bakiye eklendi`);
          toast.success(`${amount} ₺ bakiye eklendi`);
        } else {
          await removeBalance(user.id, selectedAgent.id, amount, `Süperadmin tarafından bakiye çıkarıldı`);
          toast.success(`${amount} ₺ bakiye çıkarıldı`);
        }
      }
      setCreditDialogOpen(false);
      setCreditAmount('');
      setSelectedAgent(null);
      setOperationType('credit');
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
        toast.success('Kullanıcı yasağı kaldırıldı');
      } else {
        await banUser(userId);
        toast.success('Kullanıcı yasaklandı');
      }
      await loadData();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newAgentData.email || !newAgentData.username || !newAgentData.password) {
      toast.error('Tüm alanları doldurun');
      return;
    }

    if (newAgentData.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    try {
      setLoading(true);
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newAgentData.email,
        newAgentData.password
      );
      const firebaseUser = userCredential.user;

      // Create user document in Firestore
      const userData = {
        email: newAgentData.email,
        username: newAgentData.username,
        role: 'agent',
        parentId: user.id, // Superadmin UID
        balance: 0,
        credit: 0,
        isBanned: false,
      };

      await createUser(firebaseUser.uid, userData);
      
      toast.success('Bayi başarıyla oluşturuldu');
      setNewAgentDialogOpen(false);
      setNewAgentData({ email: '', username: '', password: '' });
      await loadData();
    } catch (error) {
      console.error('Error creating agent:', error);
      let errorMessage = 'Bayi oluşturulamadı';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Bu e-posta adresi zaten kullanılıyor';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Şifre çok zayıf';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(a => 
    a.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPlayers = players.filter(p => 
    p.username?.toLowerCase().includes(playerSearchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(playerSearchTerm.toLowerCase())
  );

  // Helper function to calculate agent profit/loss
  const calculateAgentProfitLoss = (agentId, startDate = null, endDate = null) => {
    // Get agent's players
    const agentPlayers = players.filter(p => p.parentId === agentId);
    const playerIds = agentPlayers.map(p => p.id);

    // Filter coupons by agent's players
    let filteredCoupons = coupons.filter(c => playerIds.includes(c.userId));
    let filteredTransactions = transactions.filter(t => playerIds.includes(t.userId));

    // Apply date filter if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      filteredCoupons = filteredCoupons.filter(c => {
        const couponDate = c.createdAt?.toDate?.() || (c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null);
        if (!couponDate) return false;
        if (start && couponDate < start) return false;
        if (end && couponDate > end) return false;
        return true;
      });

      filteredTransactions = filteredTransactions.filter(t => {
        const transDate = t.createdAt?.toDate?.() || (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000) : null);
        if (!transDate) return false;
        if (start && transDate < start) return false;
        if (end && transDate > end) return false;
        return true;
      });
    }

    // Calculate totals
    const totalBets = filteredTransactions
      .filter(t => t.type === 'bet')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalWins = filteredTransactions
      .filter(t => t.type === 'win')
      .reduce((sum, t) => sum + t.amount, 0);

    // Also add potential wins from won coupons
    const wonCoupons = filteredCoupons.filter(c => c.status === 'won');
    const potentialWins = wonCoupons.reduce((sum, c) => sum + (c.potentialWin || 0), 0);
    
    // Total wins = actual wins from transactions + potential wins from coupons
    const totalWinsWithCoupons = totalWins + potentialWins;

    // Commission is 20% of total wins
    const commission = totalWinsWithCoupons * 0.20;

    // Net profit/loss = (Total Bets - Total Wins) + Commission
    // This represents: money collected from bets - money paid out + commission earned
    const netProfitLoss = (totalBets - totalWinsWithCoupons) + commission;

    return {
      agentId,
      playerCount: agentPlayers.length,
      totalBets,
      totalWins: totalWinsWithCoupons,
      commission,
      netProfitLoss,
    };
  };

  // Calculate analytics for all agents
  const agentAnalytics = agents.map(agent => {
    const stats = calculateAgentProfitLoss(agent.id, analyticsStartDate || null, analyticsEndDate || null);
    return {
      ...agent,
      ...stats,
    };
  });

  // Calculate overall totals
  const overallStats = agentAnalytics.reduce((acc, agent) => ({
    totalBets: acc.totalBets + agent.totalBets,
    totalWins: acc.totalWins + agent.totalWins,
    totalCommission: acc.totalCommission + agent.commission,
    netProfitLoss: acc.netProfitLoss + agent.netProfitLoss,
  }), { totalBets: 0, totalWins: 0, totalCommission: 0, netProfitLoss: 0 });

  const handlePlayerOperation = async () => {
    if (!selectedPlayer || !playerAmount) {
      toast.error('Lütfen miktar girin');
      return;
    }

    const amount = parseFloat(playerAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Geçerli bir miktar girin');
      return;
    }

    try {
      if (playerOperationType === 'credit') {
        if (playerOperationAction === 'add') {
          await addCredit(user.id, selectedPlayer.id, amount, `Süperadmin tarafından kredi eklendi`);
          toast.success(`${amount} ₺ kredi eklendi`);
        } else {
          await removeCredit(user.id, selectedPlayer.id, amount, `Süperadmin tarafından kredi çıkarıldı`);
          toast.success(`${amount} ₺ kredi çıkarıldı`);
        }
      } else {
        // Balance operation
        if (playerOperationAction === 'add') {
          await addBalance(user.id, selectedPlayer.id, amount, `Süperadmin tarafından bakiye eklendi`);
          toast.success(`${amount} ₺ bakiye eklendi`);
        } else {
          await removeBalance(user.id, selectedPlayer.id, amount, `Süperadmin tarafından bakiye çıkarıldı`);
          toast.success(`${amount} ₺ bakiye çıkarıldı`);
        }
      }
      setPlayerDialogOpen(false);
      setPlayerAmount('');
      setSelectedPlayer(null);
      setPlayerOperationType('credit');
      await loadData();
      await refreshUser();
    } catch (error) {
      toast.error(error.message || 'İşlem başarısız');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <LayoutDashboard size={24} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Süperadmin Panel</h1>
            <p className="text-sm text-gray-400">Sistem yönetimi</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users size={16} />
            <span className="text-sm">Toplam Bayi</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalAgents}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users size={16} />
            <span className="text-sm">Toplam Oyuncu</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{totalPlayers}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <TrendingUp size={16} />
            <span className="text-sm">Toplam Kredi</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{totalCredits.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Wallet size={16} />
            <span className="text-sm">Toplam Komisyon</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{totalCommissions.toLocaleString('tr-TR')} ₺</p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="agents">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-6">
          <TabsTrigger value="agents" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <Users size={16} className="mr-2" />
            Bayiler
          </TabsTrigger>
          <TabsTrigger value="players" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <Users size={16} className="mr-2" />
            Oyuncular
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

        {/* Agents Tab */}
        <TabsContent value="agents">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Bayi ara..."
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
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.id} className="border-[#1e2736]">
                      <TableCell className="text-white">{agent.username}</TableCell>
                      <TableCell className="text-gray-400">{agent.email}</TableCell>
                      <TableCell className="text-white">{(agent.balance || 0).toLocaleString('tr-TR')} ₺</TableCell>
                      <TableCell className="text-white">{(agent.credit || 0).toLocaleString('tr-TR')} ₺</TableCell>
                      <TableCell>
                        {agent.isBanned ? (
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
                              setSelectedAgent(agent);
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
                              setSelectedAgent(agent);
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
                            onClick={() => handleBanUser(agent.id, agent.isBanned)}
                            className="border-[#2a3a4d] text-xs"
                          >
                            {agent.isBanned ? <CheckCircle size={14} /> : <Ban size={14} />}
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

        {/* Players Tab */}
        <TabsContent value="players">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Oyuncu ara..."
                  value={playerSearchTerm}
                  onChange={(e) => setPlayerSearchTerm(e.target.value)}
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
                    <TableHead className="text-gray-400">Bayi</TableHead>
                    <TableHead className="text-gray-400">Bakiye</TableHead>
                    <TableHead className="text-gray-400">Kredi</TableHead>
                    <TableHead className="text-gray-400">Durum</TableHead>
                    <TableHead className="text-gray-400">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.map((player) => {
                    const agent = agents.find(a => a.id === player.parentId);
                    return (
                      <TableRow key={player.id} className="border-[#1e2736]">
                        <TableCell className="text-white">{player.username}</TableCell>
                        <TableCell className="text-gray-400">{player.email}</TableCell>
                        <TableCell className="text-gray-400">{agent?.username || '-'}</TableCell>
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPlayer(player);
                                setPlayerOperationAction('add');
                                setPlayerOperationType('balance');
                                setPlayerDialogOpen(true);
                              }}
                              className="border-[#2a3a4d] text-xs"
                            >
                              Bakiye Ekle
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPlayer(player);
                                setPlayerOperationAction('remove');
                                setPlayerOperationType('balance');
                                setPlayerDialogOpen(true);
                              }}
                              className="border-[#2a3a4d] text-xs"
                            >
                              Bakiye Çıkar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPlayer(player);
                                setPlayerOperationAction('add');
                                setPlayerOperationType('credit');
                                setPlayerDialogOpen(true);
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
                                setPlayerOperationAction('remove');
                                setPlayerOperationType('credit');
                                setPlayerDialogOpen(true);
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
                    <TableHead className="text-gray-400">Kullanıcı</TableHead>
                    <TableHead className="text-gray-400">Tip</TableHead>
                    <TableHead className="text-gray-400">Miktar</TableHead>
                    <TableHead className="text-gray-400">Açıklama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 100).map((transaction) => (
                    <TableRow key={transaction.id} className="border-[#1e2736]">
                      <TableCell className="text-gray-400">
                        {formatFirestoreDate(transaction.createdAt)}
                      </TableCell>
                      <TableCell className="text-white">{transaction.userId}</TableCell>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="space-y-6">
            {/* Date Filter */}
            <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-gray-400 mb-2 block">Başlangıç Tarihi</Label>
                  <Input
                    type="date"
                    value={analyticsStartDate}
                    onChange={(e) => setAnalyticsStartDate(e.target.value)}
                    className="bg-[#080b10] border-[#1e2736] text-white"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-gray-400 mb-2 block">Bitiş Tarihi</Label>
                  <Input
                    type="date"
                    value={analyticsEndDate}
                    onChange={(e) => setAnalyticsEndDate(e.target.value)}
                    className="bg-[#080b10] border-[#1e2736] text-white"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAnalyticsStartDate('');
                      setAnalyticsEndDate('');
                    }}
                    className="border-[#1e2736]"
                  >
                    Temizle
                  </Button>
                </div>
              </div>
            </div>

            {/* Overall Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-2">Toplam Bahis</div>
                <div className="text-white text-2xl font-bold">{overallStats.totalBets.toLocaleString('tr-TR')} ₺</div>
              </div>
              <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-2">Toplam Kazanç</div>
                <div className="text-green-500 text-2xl font-bold">{overallStats.totalWins.toLocaleString('tr-TR')} ₺</div>
              </div>
              <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-2">Toplam Komisyon</div>
                <div className="text-amber-500 text-2xl font-bold">{overallStats.totalCommission.toLocaleString('tr-TR')} ₺</div>
              </div>
              <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-2">Net Kar/Zarar</div>
                <div className={`text-2xl font-bold ${overallStats.netProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {overallStats.netProfitLoss.toLocaleString('tr-TR')} ₺
                </div>
              </div>
            </div>

            {/* Agent Profit/Loss Table */}
            <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Agent Bazlı Kar/Zarar Analizi</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#1e2736]">
                      <TableHead className="text-gray-400">Agent</TableHead>
                      <TableHead className="text-gray-400">E-posta</TableHead>
                      <TableHead className="text-gray-400">Oyuncu Sayısı</TableHead>
                      <TableHead className="text-gray-400">Toplam Bahis</TableHead>
                      <TableHead className="text-gray-400">Toplam Kazanç</TableHead>
                      <TableHead className="text-gray-400">Komisyon (%20)</TableHead>
                      <TableHead className="text-gray-400">Net Kar/Zarar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentAnalytics.map((agent) => (
                      <TableRow key={agent.id} className="border-[#1e2736]">
                        <TableCell className="text-white">{agent.username}</TableCell>
                        <TableCell className="text-gray-400">{agent.email}</TableCell>
                        <TableCell className="text-white">{agent.playerCount}</TableCell>
                        <TableCell className="text-white">{agent.totalBets.toLocaleString('tr-TR')} ₺</TableCell>
                        <TableCell className="text-green-500">{agent.totalWins.toLocaleString('tr-TR')} ₺</TableCell>
                        <TableCell className="text-amber-500">{agent.commission.toLocaleString('tr-TR')} ₺</TableCell>
                        <TableCell className={`font-semibold ${agent.netProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {agent.netProfitLoss >= 0 ? '+' : ''}{agent.netProfitLoss.toLocaleString('tr-TR')} ₺
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Credit/Balance Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white">
          <DialogHeader>
            <DialogTitle>
              {operationType === 'credit' 
                ? (creditType === 'add' ? 'Kredi Ekle' : 'Kredi Çıkar')
                : (creditType === 'add' ? 'Bakiye Ekle' : 'Bakiye Çıkar')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bayi</Label>
              <Input value={selectedAgent?.username || ''} disabled className="bg-[#080b10] border-[#1e2736]" />
            </div>
            <div>
              <Label>İşlem Tipi</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={operationType === 'credit' ? 'default' : 'outline'}
                  onClick={() => setOperationType('credit')}
                  className={operationType === 'credit' ? 'bg-amber-500 text-black' : ''}
                >
                  Kredi
                </Button>
                <Button
                  type="button"
                  variant={operationType === 'balance' ? 'default' : 'outline'}
                  onClick={() => setOperationType('balance')}
                  className={operationType === 'balance' ? 'bg-amber-500 text-black' : ''}
                >
                  Bakiye
                </Button>
              </div>
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

      {/* Player Operation Dialog */}
      <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white">
          <DialogHeader>
            <DialogTitle>
              {playerOperationType === 'credit' 
                ? (playerOperationAction === 'add' ? 'Kredi Ekle' : 'Kredi Çıkar')
                : (playerOperationAction === 'add' ? 'Bakiye Ekle' : 'Bakiye Çıkar')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Oyuncu</Label>
              <Input value={selectedPlayer?.username || ''} disabled className="bg-[#080b10] border-[#1e2736]" />
            </div>
            <div>
              <Label>İşlem Tipi</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={playerOperationType === 'credit' ? 'default' : 'outline'}
                  onClick={() => setPlayerOperationType('credit')}
                  className={playerOperationType === 'credit' ? 'bg-amber-500 text-black' : ''}
                >
                  Kredi
                </Button>
                <Button
                  type="button"
                  variant={playerOperationType === 'balance' ? 'default' : 'outline'}
                  onClick={() => setPlayerOperationType('balance')}
                  className={playerOperationType === 'balance' ? 'bg-amber-500 text-black' : ''}
                >
                  Bakiye
                </Button>
              </div>
            </div>
            <div>
              <Label>Miktar (₺)</Label>
              <Input
                type="number"
                value={playerAmount}
                onChange={(e) => setPlayerAmount(e.target.value)}
                className="bg-[#080b10] border-[#1e2736] text-white"
                placeholder="0"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setPlayerDialogOpen(false);
                setPlayerAmount('');
                setPlayerOperationType('credit');
              }}>
                İptal
              </Button>
              <Button onClick={handlePlayerOperation}>
                {playerOperationAction === 'add' ? 'Ekle' : 'Çıkar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white">
          <DialogHeader>
            <DialogTitle>Kullanıcıyı Yasakla</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kullanıcı</Label>
              <Input value={userToBan?.username || ''} disabled className="bg-[#080b10] border-[#1e2736]" />
            </div>
            <div>
              <Label>Yasaklama Nedeni (Opsiyonel)</Label>
              <Input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="bg-[#080b10] border-[#1e2736] text-white"
                placeholder="Yasaklama nedeni..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setBanDialogOpen(false);
                setUserToBan(null);
                setBanReason('');
              }}>
                İptal
              </Button>
              <Button onClick={handleConfirmBan} variant="destructive">
                Yasakla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coupon Detail Dialog */}
      <Dialog open={couponDetailDialogOpen} onOpenChange={setCouponDetailDialogOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kupon Detayları</DialogTitle>
          </DialogHeader>
          {selectedCoupon && (
            <div className="space-y-4">
              {/* Kupon Bilgileri */}
              <div className="bg-[#080b10] rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Kupon ID:</span>
                  <span className="text-white font-mono text-sm">{selectedCoupon.uniqueId || selectedCoupon.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Durum:</span>
                  <Badge className={
                    selectedCoupon.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                    selectedCoupon.status === 'won' ? 'bg-green-500/20 text-green-500' :
                    'bg-red-500/20 text-red-500'
                  }>
                    {selectedCoupon.status === 'pending' ? 'Beklemede' : selectedCoupon.status === 'won' ? 'Kazanan' : 'Kaybeden'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Tarih:</span>
                  <span className="text-white text-sm">{formatFirestoreDateTime(selectedCoupon.createdAt)}</span>
                </div>
              </div>

              {/* Kullanıcı Bilgileri */}
              {(() => {
                const couponPlayer = players.find(p => p.id === selectedCoupon.userId);
                const couponAgent = agents.find(a => a.id === selectedCoupon.agentId);
                return (
                  <div className="bg-[#080b10] rounded-lg p-4 space-y-2">
                    <h3 className="text-white font-semibold mb-2">Kullanıcı Bilgileri</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Kullanıcı:</span>
                      <span className="text-white">{couponPlayer?.username || selectedCoupon.userId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">E-posta:</span>
                      <span className="text-white text-sm">{couponPlayer?.email || '-'}</span>
                    </div>
                    {couponAgent && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Agent:</span>
                        <span className="text-white">{couponAgent.username}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Seçimler */}
              <div className="bg-[#080b10] rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3">Seçimler</h3>
                <div className="space-y-2">
                  {selectedCoupon.selections?.map((sel, idx) => (
                    <div key={idx} className="bg-[#0d1117] rounded-lg p-3 border border-[#1e2736]">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-white font-medium">{sel.matchName}</p>
                          <p className="text-gray-400 text-sm">{sel.marketName}: {sel.option}</p>
                          {sel.league && (
                            <p className="text-gray-500 text-xs mt-1">{sel.league}</p>
                          )}
                        </div>
                        <span className="text-amber-500 font-bold">{sel.odds?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Finansal Bilgiler */}
              <div className="bg-[#080b10] rounded-lg p-4 space-y-2">
                <h3 className="text-white font-semibold mb-2">Finansal Bilgiler</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400">Yatırılan:</span>
                    <p className="text-white font-semibold">{(selectedCoupon.stake || 0).toLocaleString('tr-TR')} ₺</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Toplam Oran:</span>
                    <p className="text-amber-500 font-semibold">{(selectedCoupon.totalOdds || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Potansiyel Kazanç:</span>
                    <p className="text-green-500 font-semibold">{(selectedCoupon.potentialWin || 0).toLocaleString('tr-TR')} ₺</p>
                  </div>
                  {selectedCoupon.status === 'won' && selectedCoupon.agentId && (() => {
                    const commission = (selectedCoupon.potentialWin || 0) * 0.20;
                    const netWin = (selectedCoupon.potentialWin || 0) - commission;
                    return (
                      <>
                        <div>
                          <span className="text-gray-400">Net Kazanç:</span>
                          <p className="text-green-500 font-semibold">{netWin.toLocaleString('tr-TR')} ₺</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Komisyon (%20):</span>
                          <p className="text-amber-500 font-semibold">{commission.toLocaleString('tr-TR')} ₺</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setCouponDetailDialogOpen(false)}>
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminPanel;

