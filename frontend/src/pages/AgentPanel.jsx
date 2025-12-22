import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockUsers, mockCoupons } from '../data/mockData';
import {
  LayoutDashboard, Users, FileText, Wallet,
  TrendingUp, Plus, Search, UserPlus
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

const AgentPanel = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');

  if (!user || user.role !== 'agent') {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-white">Bu sayfaya erişim yetkiniz yok</h2>
      </div>
    );
  }

  // Agent's sub-users
  const subUsers = mockUsers.filter((u) => u.parentId === user.id);
  const subUserIds = subUsers.map((u) => u.id);
  const subCoupons = mockCoupons.filter((c) => subUserIds.includes(c.userId));

  const totalSubBalance = subUsers.reduce((a, b) => a + b.balance, 0);
  const pendingCoupons = subCoupons.filter((c) => c.status === 'pending');

  const handleAddBalance = () => {
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Geçerli bir miktar girin');
      return;
    }
    toast.success(`Bakiye yüklendi: ${amount} ₺`);
    setBalanceAmount('');
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <LayoutDashboard size={24} className="text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Bayi Panel</h1>
          <p className="text-sm text-gray-400">Kullanıcı yönetimi</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Wallet size={16} />
            <span className="text-sm">Bakiyem</span>
          </div>
          <p className="text-2xl font-bold text-white">{user.balance.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users size={16} />
            <span className="text-sm">Alt Kullanıcı</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{subUsers.length}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <TrendingUp size={16} />
            <span className="text-sm">Toplam Alt Bakiye</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{totalSubBalance.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <FileText size={16} />
            <span className="text-sm">Açık Kupon</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{pendingCoupons.length}</p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="users">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-6">
          <TabsTrigger value="users" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <Users size={16} className="mr-2" />
            Kullanıcılarım
          </TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <FileText size={16} className="mr-2" />
            Kuponlar
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-0">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Kullanıcı ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-[#0d1117] border-[#1e2736] text-white"
              />
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                  <UserPlus size={16} className="mr-2" />
                  Yeni Kullanıcı
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0d1117] border-[#1e2736]">
                <DialogHeader>
                  <DialogTitle className="text-white">Yeni Kullanıcı Oluştur</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-gray-400">Kullanıcı Adı</Label>
                    <Input
                      placeholder="kullanici_adi"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Şifre</Label>
                    <Input
                      type="password"
                      placeholder="******"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Başlangıç Kredisi</Label>
                    <Input
                      type="number"
                      placeholder="1000"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                    />
                  </div>
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black">
                    Oluştur
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {subUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <Users size={32} className="text-gray-600" />
              </div>
              <p className="text-gray-500">Henüz alt kullanıcınız yok</p>
            </div>
          ) : (
            <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0a0e14]">
                  <tr>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Kullanıcı</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Bakiye</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Kredi</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2736]">
                  {subUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#1a2332]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-white font-medium">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{u.balance.toLocaleString('tr-TR')} ₺</td>
                      <td className="px-4 py-3 text-green-500 font-medium">{u.credit.toLocaleString('tr-TR')} ₺</td>
                      <td className="px-4 py-3">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                              <Plus size={14} className="mr-1" />
                              Yükle
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#0d1117] border-[#1e2736]">
                            <DialogHeader>
                              <DialogTitle className="text-white">Bakiye Yükle - {u.username}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div>
                                <Label className="text-gray-400">Miktar</Label>
                                <Input
                                  type="number"
                                  value={balanceAmount}
                                  onChange={(e) => setBalanceAmount(e.target.value)}
                                  placeholder="0.00"
                                  className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                                />
                              </div>
                              <Button
                                onClick={handleAddBalance}
                                className="w-full bg-green-500 hover:bg-green-600 text-white"
                              >
                                Yükle
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="mt-0">
          {subCoupons.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
                <FileText size={32} className="text-gray-600" />
              </div>
              <p className="text-gray-500">Henüz kupon yok</p>
            </div>
          ) : (
            <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0a0e14]">
                  <tr>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Kupon ID</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Kullanıcı</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Yatırılan</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Oran</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2736]">
                  {subCoupons.map((c) => (
                    <tr key={c.id} className="hover:bg-[#1a2332]">
                      <td className="px-4 py-3 text-white font-mono">{c.id}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {mockUsers.find((u) => u.id === c.userId)?.username}
                      </td>
                      <td className="px-4 py-3 text-white">{c.stake} ₺</td>
                      <td className="px-4 py-3 text-amber-500 font-medium">{c.totalOdds.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge className={
                          c.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                          c.status === 'won' ? 'bg-green-500/20 text-green-500' :
                          'bg-red-500/20 text-red-500'
                        }>
                          {c.status === 'pending' ? 'Beklemede' : c.status === 'won' ? 'Kazanıldı' : 'Kaybedildi'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentPanel;
