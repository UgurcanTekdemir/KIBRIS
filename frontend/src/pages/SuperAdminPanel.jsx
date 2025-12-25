import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllAgents, 
  getAllPlayers, 
  banUser, 
  unbanUser,
  createUser,
  updateUser
} from '../services/userService';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { createFirestoreUserForAuth } from '../utils/createFirestoreUsers';
import { addCredit, removeCredit, getSentCreditHistory, getPendingCredits, approveCredit } from '../services/creditService';
import { addBalance, removeBalance } from '../services/balanceService';
import { getAllTransactions } from '../services/transactionService';
import { getAllCoupons } from '../services/couponService';
import { formatFirestoreDate, formatFirestoreDateTime } from '../utils/dateUtils';
import {
  LayoutDashboard, Users, FileText, Wallet, TrendingUp, TrendingDown,
  Plus, Search, UserPlus, Ban, CheckCircle, XCircle, Shield, UserCog
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
  
  // Player creation dialog state
  const [newPlayerDialogOpen, setNewPlayerDialogOpen] = useState(false);
  const [newPlayerData, setNewPlayerData] = useState({
    email: '',
    username: '',
    password: '',
    parentId: '', // Optional agent ID
  });
  
  // Dialog for creating Firestore user for existing Firebase Auth user
  const [createFirestoreUserDialogOpen, setCreateFirestoreUserDialogOpen] = useState(false);
  const [firestoreUserData, setFirestoreUserData] = useState({
    email: '',
    password: '',
    role: 'player',
    username: '',
    parentId: '',
  });
  
  // Analytics date filters
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  
  // Ban dialog state
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [userToBan, setUserToBan] = useState(null);
  const [banReason, setBanReason] = useState('');
  
  // Coupon detail dialog state
  const [couponDetailDialogOpen, setCouponDetailDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  
  // Role management state
  const [roleManagementSearchTerm, setRoleManagementSearchTerm] = useState('');
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState(null);
  const [newRole, setNewRole] = useState('player');
  
  // Pending credits state
  const [pendingCredits, setPendingCredits] = useState([]);

  useEffect(() => {
    if (user && user.role === 'superadmin') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [agentsData, playersData, transactionsData, couponsData, pendingCreditsData] = await Promise.all([
        getAllAgents(),
        getAllPlayers(),
        getAllTransactions(200),
        getAllCoupons(200),
        getPendingCredits(user.id, 200),
      ]);
      setAgents(agentsData);
      setPlayers(playersData);
      setTransactions(transactionsData);
      setCoupons(couponsData);
      setPendingCredits(pendingCreditsData);
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
        <h2 className="text-xl font-semibold text-white mb-4">Bu sayfaya erişim yetkiniz yok</h2>
        <p className="text-gray-400 mb-6">
          SuperAdmin paneline erişmek için Firestore'da rolünüzün 'superadmin' olarak ayarlanması gerekiyor.
        </p>
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
          toast.success(`${amount} ₺ kredi beklemede olarak eklendi`);
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
        toast.success('Kullanıcı yasağı kaldırıldı');
      } else {
        // Open ban dialog instead of directly banning
        const user = [...agents, ...players].find(u => u.id === userId);
        if (user) {
          setUserToBan(user);
          setBanDialogOpen(true);
        }
      }
      await loadData();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handleConfirmBan = async () => {
    if (!userToBan) {
      toast.error('Kullanıcı seçilmedi');
      return;
    }

    try {
      await banUser(userToBan.id, banReason || '');
      toast.success('Kullanıcı yasaklandı');
      setBanDialogOpen(false);
      setUserToBan(null);
      setBanReason('');
      await loadData();
    } catch (error) {
      console.error('Ban error:', error);
      toast.error('Yasaklama işlemi başarısız: ' + (error.message || 'Bilinmeyen hata'));
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

  const handleCreatePlayer = async (e) => {
    e.preventDefault();
    if (!newPlayerData.email || !newPlayerData.username || !newPlayerData.password) {
      toast.error('Tüm alanları doldurun');
      return;
    }

    if (newPlayerData.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    try {
      setLoading(true);
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newPlayerData.email,
        newPlayerData.password
      );
      const firebaseUser = userCredential.user;

      // Create user document in Firestore
      const userData = {
        email: newPlayerData.email,
        username: newPlayerData.username,
        role: 'player',
        parentId: newPlayerData.parentId || null, // Agent ID if selected, otherwise null
        balance: 0,
        credit: 0,
        isBanned: false,
      };

      await createUser(firebaseUser.uid, userData);
      
      toast.success('Oyuncu başarıyla oluşturuldu');
      setNewPlayerDialogOpen(false);
      setNewPlayerData({ email: '', username: '', password: '', parentId: '' });
      await loadData();
    } catch (error) {
      console.error('Error creating player:', error);
      let errorMessage = 'Oyuncu oluşturulamadı';
      
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

  const handleCreateFirestoreUser = async (e) => {
    e.preventDefault();
    if (!firestoreUserData.email || !firestoreUserData.password || !firestoreUserData.role) {
      toast.error('E-posta, şifre ve rol gereklidir');
      return;
    }

    try {
      setLoading(true);
      const result = await createFirestoreUserForAuth(
        firestoreUserData.email,
        firestoreUserData.password,
        firestoreUserData.role,
        firestoreUserData.username || firestoreUserData.email.split('@')[0],
        firestoreUserData.parentId || null
      );

      if (result.success) {
        toast.success(result.message);
        setCreateFirestoreUserDialogOpen(false);
        setFirestoreUserData({
          email: '',
          password: '',
          role: 'player',
          username: '',
          parentId: '',
        });
        await loadData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error creating Firestore user:', error);
      toast.error('Firestore kullanıcısı oluşturulamadı: ' + error.message);
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

  const handleRoleChange = async () => {
    if (!userToChangeRole || !newRole) {
      toast.error('Lütfen kullanıcı ve rol seçin');
      return;
    }

    if (userToChangeRole.role === newRole) {
      toast.error('Kullanıcı zaten bu role sahip');
      return;
    }

    try {
      setLoading(true);
      await updateUser(userToChangeRole.id, { role: newRole });
      toast.success(`${userToChangeRole.username} kullanıcısının rolü '${newRole}' olarak güncellendi`);
      setRoleChangeDialogOpen(false);
      setUserToChangeRole(null);
      setNewRole('player');
      await loadData();
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Rol değiştirme başarısız: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get all users for role management (agents + players)
  const allUsersForRoleManagement = [...agents, ...players];
  const filteredUsersForRoleManagement = allUsersForRoleManagement.filter(u =>
    u.username?.toLowerCase().includes(roleManagementSearchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(roleManagementSearchTerm.toLowerCase())
  );

  const getRoleLabel = (role) => {
    switch (role) {
      case 'superadmin':
        return 'SuperAdmin';
      case 'agent':
        return 'Bayi';
      case 'player':
        return 'Oyuncu';
      default:
        return role || 'Belirtilmemiş';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-500/20 text-purple-500';
      case 'agent':
        return 'bg-blue-500/20 text-blue-500';
      case 'player':
        return 'bg-green-500/20 text-green-500';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <LayoutDashboard size={20} className="sm:w-6 sm:h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Süperadmin Panel</h1>
            <p className="text-xs sm:text-sm text-gray-400">Sistem yönetimi</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-2 sm:p-4">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
            <Users size={14} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">Toplam Bayi</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-white">{totalAgents}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-2 sm:p-4">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
            <Users size={14} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">Toplam Oyuncu</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-blue-500">{totalPlayers}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-2 sm:p-4">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
            <TrendingUp size={14} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">Toplam Kredi</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-green-500">{totalCredits.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-2 sm:p-4">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 mb-1 sm:mb-2">
            <Wallet size={14} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">Toplam Komisyon</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-amber-500">{totalCommissions.toLocaleString('tr-TR')} ₺</p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="agents">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-4 sm:mb-6 overflow-x-scroll overflow-y-hidden scrollbar-hide -mx-2 sm:mx-0 px-2 sm:px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsTrigger value="agents" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <Users size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">Bayiler</span>
            <span className="xs:hidden group-hover:hidden data-[state=active]:hidden">Bayi</span>
          </TabsTrigger>
          <TabsTrigger value="players" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <Users size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">Oyuncular</span>
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
          <TabsTrigger value="role-management" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <Shield size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">Rol Yönetimi</span>
            <span className="xs:hidden group-hover:hidden data-[state=active]:hidden">Rol</span>
          </TabsTrigger>
          <TabsTrigger value="credits" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] sm:text-sm whitespace-nowrap px-2 sm:px-3 flex-shrink-0 group">
            <Wallet size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
            <span className="hidden group-hover:inline data-[state=active]:inline sm:inline">Kredi Geçmişi</span>
            <span className="xs:hidden group-hover:hidden data-[state=active]:hidden">Kredi</span>
          </TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="sm:w-4 sm:h-4 absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Bayi ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 sm:pl-9 bg-[#080b10] border-[#1e2736] text-white text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Dialog open={createFirestoreUserDialogOpen} onOpenChange={setCreateFirestoreUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm whitespace-nowrap">
                      <UserPlus size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Mevcut Kullanıcı için Firestore Kaydı Oluştur</span>
                      <span className="sm:hidden">Firestore Kaydı</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Mevcut Firebase Auth Kullanıcısı için Firestore Kaydı Oluştur</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateFirestoreUser} className="space-y-4">
                      <div>
                        <Label>E-posta</Label>
                        <Input
                          type="email"
                          value={firestoreUserData.email}
                          onChange={(e) => setFirestoreUserData({ ...firestoreUserData, email: e.target.value })}
                          placeholder="kullanici@example.com"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label>Şifre (Doğrulama için)</Label>
                        <Input
                          type="password"
                          value={firestoreUserData.password}
                          onChange={(e) => setFirestoreUserData({ ...firestoreUserData, password: e.target.value })}
                          placeholder="Firebase Auth şifresi"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label>Rol</Label>
                        <select
                          value={firestoreUserData.role}
                          onChange={(e) => setFirestoreUserData({ ...firestoreUserData, role: e.target.value })}
                          className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2736] rounded-lg text-white"
                          required
                        >
                          <option value="superadmin">SuperAdmin</option>
                          <option value="agent">Agent (Bayi)</option>
                          <option value="player">Player (Oyuncu)</option>
                        </select>
                      </div>
                      <div>
                        <Label>Kullanıcı Adı (Opsiyonel)</Label>
                        <Input
                          type="text"
                          value={firestoreUserData.username}
                          onChange={(e) => setFirestoreUserData({ ...firestoreUserData, username: e.target.value })}
                          placeholder="Boş bırakılırsa e-posta kullanılır"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                        />
                      </div>
                      {firestoreUserData.role !== 'superadmin' && (
                        <div>
                          <Label>Parent ID (Opsiyonel - Agent/Oyuncu için)</Label>
                          <Input
                            type="text"
                            value={firestoreUserData.parentId}
                            onChange={(e) => setFirestoreUserData({ ...firestoreUserData, parentId: e.target.value })}
                            placeholder="Üst kullanıcı UID (boş bırakılabilir)"
                            className="bg-[#080b10] border-[#1e2736] text-white"
                          />
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateFirestoreUserDialogOpen(false)}
                          className="border-[#2a3a4d]"
                        >
                          İptal
                        </Button>
                        <Button type="submit" className="bg-blue-500 hover:bg-blue-600">
                          Oluştur
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                <div className="flex items-center gap-2">
                  <Dialog open={newAgentDialogOpen} onOpenChange={setNewAgentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-amber-500 hover:bg-amber-600 text-black text-xs sm:text-sm">
                        <Plus size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Yeni Bayi</span>
                        <span className="sm:hidden">Bayi</span>
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                  <Dialog open={newPlayerDialogOpen} onOpenChange={setNewPlayerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm">
                        <UserPlus size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Yeni Oyuncu</span>
                        <span className="sm:hidden">Oyuncu</span>
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Yeni Bayi Oluştur</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateAgent} className="space-y-4">
                      <div>
                        <Label>E-posta</Label>
                        <Input
                          type="email"
                          value={newAgentData.email}
                          onChange={(e) => setNewAgentData({ ...newAgentData, email: e.target.value })}
                          placeholder="bayi@example.com"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label>Kullanıcı Adı</Label>
                        <Input
                          type="text"
                          value={newAgentData.username}
                          onChange={(e) => setNewAgentData({ ...newAgentData, username: e.target.value })}
                          placeholder="Bayi kullanıcı adı"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label>Şifre</Label>
                        <Input
                          type="password"
                          value={newAgentData.password}
                          onChange={(e) => setNewAgentData({ ...newAgentData, password: e.target.value })}
                          placeholder="En az 6 karakter"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                          required
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setNewAgentDialogOpen(false)}
                          className="border-[#2a3a4d]"
                        >
                          İptal
                        </Button>
                        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-black">
                          Oluştur
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                <Dialog open={newPlayerDialogOpen} onOpenChange={setNewPlayerDialogOpen}>
                  <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Yeni Oyuncu Oluştur</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreatePlayer} className="space-y-4">
                      <div>
                        <Label>E-posta</Label>
                        <Input
                          type="email"
                          value={newPlayerData.email}
                          onChange={(e) => setNewPlayerData({ ...newPlayerData, email: e.target.value })}
                          placeholder="oyuncu@example.com"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label>Kullanıcı Adı</Label>
                        <Input
                          type="text"
                          value={newPlayerData.username}
                          onChange={(e) => setNewPlayerData({ ...newPlayerData, username: e.target.value })}
                          placeholder="Oyuncu kullanıcı adı"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label>Şifre</Label>
                        <Input
                          type="password"
                          value={newPlayerData.password}
                          onChange={(e) => setNewPlayerData({ ...newPlayerData, password: e.target.value })}
                          placeholder="En az 6 karakter"
                          className="bg-[#080b10] border-[#1e2736] text-white"
                          required
                          minLength={6}
                        />
                      </div>
                      <div>
                        <Label>Bayi (Opsiyonel)</Label>
                        <select
                          value={newPlayerData.parentId}
                          onChange={(e) => setNewPlayerData({ ...newPlayerData, parentId: e.target.value })}
                          className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2736] rounded-lg text-white"
                        >
                          <option value="">Bayi seçin (opsiyonel)</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.username} ({agent.email})
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                          Bayi seçilmezse, oyuncu doğrudan SuperAdmin'e bağlı olur
                        </p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setNewPlayerDialogOpen(false);
                            setNewPlayerData({ email: '', username: '', password: '', parentId: '' });
                          }}
                          className="border-[#2a3a4d]"
                        >
                          İptal
                        </Button>
                        <Button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white" disabled={loading}>
                          {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                </div>
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
                        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAgent(agent);
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
                              setSelectedAgent(agent);
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
                            onClick={() => handleBanUser(agent.id, agent.isBanned)}
                            className="bg-red-500 hover:bg-red-600 text-white border-red-500 px-2 sm:px-3 py-1 h-auto"
                          >
                            {agent.isBanned ? <CheckCircle size={12} className="sm:w-3.5 sm:h-3.5" /> : <Ban size={12} className="sm:w-3.5 sm:h-3.5" />}
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
                          <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPlayer(player);
                                setPlayerOperationAction('add');
                                setPlayerOperationType('balance');
                                setPlayerDialogOpen(true);
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
                                setPlayerOperationAction('remove');
                                setPlayerOperationType('balance');
                                setPlayerDialogOpen(true);
                              }}
                              className="border-[#2a3a4d] text-[10px] sm:text-xs px-2 sm:px-3 py-1 h-auto"
                            >
                              <span className="hidden sm:inline">Bakiye Çıkar</span>
                              <span className="sm:hidden">Çıkar</span>
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
                                setPlayerOperationAction('remove');
                                setPlayerOperationType('credit');
                                setPlayerDialogOpen(true);
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

        {/* Role Management Tab */}
        <TabsContent value="role-management">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="sm:w-4 sm:h-4 absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Kullanıcı ara (isim veya e-posta)..."
                  value={roleManagementSearchTerm}
                  onChange={(e) => setRoleManagementSearchTerm(e.target.value)}
                  className="pl-7 sm:pl-9 bg-[#080b10] border-[#1e2736] text-white text-sm"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e2736]">
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Kullanıcı Adı</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">E-posta</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Mevcut Rol</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Bakiye</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Kredi</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Durum</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsersForRoleManagement.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        Kullanıcı bulunamadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsersForRoleManagement.map((userItem) => (
                      <TableRow key={userItem.id} className="border-[#1e2736]">
                        <TableCell className="text-white text-xs sm:text-sm">{userItem.username || '-'}</TableCell>
                        <TableCell className="text-gray-400 text-xs sm:text-sm">{userItem.email || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(userItem.role)}>
                            {getRoleLabel(userItem.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white text-xs sm:text-sm">
                          {(userItem.balance || 0).toLocaleString('tr-TR')} ₺
                        </TableCell>
                        <TableCell className="text-white text-xs sm:text-sm">
                          {(userItem.credit || 0).toLocaleString('tr-TR')} ₺
                        </TableCell>
                        <TableCell>
                          {userItem.isBanned ? (
                            <Badge variant="destructive" className="text-xs">Yasaklı</Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-500 text-xs">Aktif</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUserToChangeRole(userItem);
                              setNewRole(userItem.role || 'player');
                              setRoleChangeDialogOpen(true);
                            }}
                            className="border-[#2a3a4d] text-xs sm:text-sm"
                          >
                            <UserCog size={14} className="sm:w-4 sm:h-4 mr-1" />
                            <span className="hidden sm:inline">Rol Değiştir</span>
                            <span className="sm:hidden">Rol</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-3 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">Bekleyen Krediler</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e2736]">
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Tarih</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Kime</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Miktar</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Durum</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">Açıklama</TableHead>
                    <TableHead className="text-gray-400 text-xs sm:text-sm">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCredits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                        Bekleyen kredi yok
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingCredits.map((credit) => (
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
                          {credit.status === 'pending' ? (
                            <Badge className="bg-amber-500/20 text-amber-500 text-xs sm:text-sm">Beklemede</Badge>
                          ) : credit.status === 'paid' ? (
                            <Badge className="bg-green-500/20 text-green-500 text-xs sm:text-sm">Ödendi</Badge>
                          ) : (
                            <Badge className="bg-gray-500/20 text-gray-400 text-xs sm:text-sm">İptal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs sm:text-sm">
                          {credit.description || '-'}
                        </TableCell>
                        <TableCell>
                          {credit.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleApproveCredit(credit.id)}
                              className="bg-green-500 hover:bg-green-600 text-white text-xs"
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Ödendi
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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

      {/* Role Change Dialog */}
      <Dialog open={roleChangeDialogOpen} onOpenChange={setRoleChangeDialogOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rol Değiştir</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kullanıcı</Label>
              <Input 
                value={userToChangeRole?.username || ''} 
                disabled 
                className="bg-[#080b10] border-[#1e2736]" 
              />
              <p className="text-xs text-gray-400 mt-1">{userToChangeRole?.email}</p>
            </div>
            <div>
              <Label>Mevcut Rol</Label>
              <Input 
                value={getRoleLabel(userToChangeRole?.role)} 
                disabled 
                className="bg-[#080b10] border-[#1e2736]" 
              />
            </div>
            <div>
              <Label>Yeni Rol</Label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2736] rounded-lg text-white"
              >
                <option value="superadmin">SuperAdmin</option>
                <option value="agent">Agent (Bayi)</option>
                <option value="player">Player (Oyuncu)</option>
              </select>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs text-amber-500">
                ⚠️ Rol değişikliği anında uygulanır. Kullanıcı sayfayı yenilediğinde yeni rolüyle giriş yapacaktır.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setRoleChangeDialogOpen(false);
                  setUserToChangeRole(null);
                  setNewRole('player');
                }}
              >
                İptal
              </Button>
              <Button 
                onClick={handleRoleChange}
                disabled={loading || !userToChangeRole || userToChangeRole?.role === newRole}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                {loading ? 'Değiştiriliyor...' : 'Rolü Değiştir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white max-w-[95vw] sm:max-w-md">
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

