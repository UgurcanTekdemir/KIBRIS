import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockUsers, mockCoupons, transactions } from '../data/mockData';
import {
  LayoutDashboard, Users, FileText, Settings, Wallet,
  TrendingUp, TrendingDown, Plus, Search, MoreVertical,
  UserPlus, Ban, Edit, Image, Trash2
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
import { bannerAPI } from '../services/api';

const AdminPanel = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [banners, setBanners] = useState([]);
  const [bannerForm, setBannerForm] = useState({
    image_url: '',
    title: '',
    subtitle: '',
    link_url: '',
    button_text: '',
    is_active: true,
    order: 0,
  });
  const [editingBanner, setEditingBanner] = useState(null);

  // Fetch banners - must be before early return
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    
    const fetchBanners = async () => {
      try {
        const data = await bannerAPI.getBanners();
        setBanners(data || []);
      } catch (error) {
        console.error('Error fetching banners:', error);
        toast.error('Bannerlar yüklenirken bir hata oluştu');
      }
    };
    fetchBanners();
  }, [user]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-white">Bu sayfaya erişim yetkiniz yok</h2>
      </div>
    );
  }

  const allUsers = mockUsers.filter((u) => u.id !== 1); // Exclude admin
  const allCoupons = mockCoupons;
  const totalDeposits = transactions.filter((t) => t.type === 'deposit').reduce((a, b) => a + b.amount, 0);
  const totalBets = transactions.filter((t) => t.type === 'bet').reduce((a, b) => a + Math.abs(b.amount), 0);

  const filteredUsers = allUsers.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBalanceUpdate = (type) => {
    if (!selectedUser || !balanceAmount) return;
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Geçerli bir miktar girin');
      return;
    }
    toast.success(`${selectedUser.username} kullanıcısına ${type === 'add' ? '+' : '-'}${amount} ₺ işlendi`);
    setBalanceAmount('');
    setSelectedUser(null);
  };


  const handleBannerSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBanner) {
        await bannerAPI.updateBanner(editingBanner.id, bannerForm);
        toast.success('Banner güncellendi');
      } else {
        await bannerAPI.createBanner(bannerForm);
        toast.success('Banner oluşturuldu');
      }
      
      setBannerForm({
        image_url: '',
        title: '',
        subtitle: '',
        link_url: '',
        button_text: '',
        is_active: true,
        order: 0,
      });
      setEditingBanner(null);
      
      // Refresh banners
      const data = await bannerAPI.getBanners();
      setBanners(data || []);
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error(error.message || 'Banner kaydedilemedi');
    }
  };

  const handleBannerDelete = async (id) => {
    if (!window.confirm('Bu bannerı silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await bannerAPI.deleteBanner(id);
      toast.success('Banner silindi');
      setBanners(banners.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error(error.message || 'Banner silinemedi');
    }
  };

  const handleBannerEdit = (banner) => {
    setEditingBanner(banner);
    setBannerForm({
      image_url: banner.image_url,
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      link_url: banner.link_url || '',
      button_text: banner.button_text || '',
      is_active: banner.is_active,
      order: banner.order || 0,
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
          <LayoutDashboard size={24} className="text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400">Sistem yönetimi</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users size={16} />
            <span className="text-sm">Toplam Kullanıcı</span>
          </div>
          <p className="text-2xl font-bold text-white">{allUsers.length}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <FileText size={16} />
            <span className="text-sm">Toplam Kupon</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{allCoupons.length}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <TrendingUp size={16} />
            <span className="text-sm">Toplam Yükleme</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{totalDeposits.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <TrendingDown size={16} />
            <span className="text-sm">Toplam Bahis</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{totalBets.toLocaleString('tr-TR')} ₺</p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="users">
        <TabsList className="bg-[#0d1117] border border-[#1e2736] p-1 mb-6">
          <TabsTrigger value="users" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <Users size={16} className="mr-2" />
            Kullanıcılar
          </TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <FileText size={16} className="mr-2" />
            Kuponlar
          </TabsTrigger>
          <TabsTrigger value="banners" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <Image size={16} className="mr-2" />
            Bannerlar
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <Settings size={16} className="mr-2" />
            Ayarlar
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
            <Button className="bg-amber-500 hover:bg-amber-600 text-black">
              <UserPlus size={16} className="mr-2" />
              Yeni Kullanıcı
            </Button>
          </div>

          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0a0e14]">
                <tr>
                  <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Kullanıcı</th>
                  <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Rol</th>
                  <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Bakiye</th>
                  <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Kredi</th>
                  <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2736]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#1a2332]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black font-bold text-sm">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={u.role === 'agent' ? 'bg-blue-500/20 text-blue-500' : 'bg-gray-500/20 text-gray-400'}>
                        {u.role === 'agent' ? 'Bayi' : 'Kullanıcı'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{u.balance.toLocaleString('tr-TR')} ₺</td>
                    <td className="px-4 py-3 text-green-500 font-medium">{u.credit.toLocaleString('tr-TR')} ₺</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-400 hover:text-green-500"
                              onClick={() => setSelectedUser(u)}
                            >
                              <Wallet size={16} />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#0d1117] border-[#1e2736]">
                            <DialogHeader>
                              <DialogTitle className="text-white">Bakiye İşlemleri - {u.username}</DialogTitle>
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
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleBalanceUpdate('add')}
                                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                                >
                                  <Plus size={16} className="mr-2" />
                                  Yükle
                                </Button>
                                <Button
                                  onClick={() => handleBalanceUpdate('remove')}
                                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                                >
                                  <TrendingDown size={16} className="mr-2" />
                                  Düş
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-amber-500">
                          <Edit size={16} />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-500">
                          <Ban size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="mt-0">
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
                {allCoupons.map((c) => (
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
        </TabsContent>

        {/* Banners Tab */}
        <TabsContent value="banners" className="mt-0">
          <div className="space-y-6">
            {/* Add/Edit Banner Form */}
            <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">
                {editingBanner ? 'Banner Düzenle' : 'Yeni Banner Ekle'}
              </h3>
              <form onSubmit={handleBannerSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Görsel URL *</Label>
                    <Input
                      type="url"
                      value={bannerForm.image_url}
                      onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Sıra</Label>
                    <Input
                      type="number"
                      value={bannerForm.order}
                      onChange={(e) => setBannerForm({ ...bannerForm, order: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Başlık</Label>
                    <Input
                      type="text"
                      value={bannerForm.title}
                      onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                      placeholder="Banner başlığı"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Alt Başlık</Label>
                    <Input
                      type="text"
                      value={bannerForm.subtitle}
                      onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                      placeholder="Banner alt başlığı"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Link URL</Label>
                    <Input
                      type="url"
                      value={bannerForm.link_url}
                      onChange={(e) => setBannerForm({ ...bannerForm, link_url: e.target.value })}
                      placeholder="/live veya /matches"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Buton Metni</Label>
                    <Input
                      type="text"
                      value={bannerForm.button_text}
                      onChange={(e) => setBannerForm({ ...bannerForm, button_text: e.target.value })}
                      placeholder="Canlı Maçlar"
                      className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bannerForm.is_active}
                      onChange={(e) => setBannerForm({ ...bannerForm, is_active: e.target.checked })}
                      className="w-4 h-4 rounded bg-[#1a2332] border-[#2a3a4d] text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-gray-400">Aktif</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-black">
                    {editingBanner ? 'Güncelle' : 'Ekle'}
                  </Button>
                  {editingBanner && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingBanner(null);
                        setBannerForm({
                          image_url: '',
                          title: '',
                          subtitle: '',
                          link_url: '',
                          button_text: '',
                          is_active: true,
                          order: 0,
                        });
                      }}
                      className="border-[#2a3a4d] text-white"
                    >
                      İptal
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* Banners List */}
            <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#1e2736]">
                <h3 className="text-white font-semibold">Mevcut Bannerlar ({banners.length})</h3>
              </div>
              {banners.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Henüz banner eklenmemiş
                </div>
              ) : (
                <div className="divide-y divide-[#1e2736]">
                  {banners.map((banner) => (
                    <div key={banner.id} className="p-4 hover:bg-[#1a2332] transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-32 h-20 rounded-lg overflow-hidden bg-[#1a2332] flex-shrink-0">
                          <img
                            src={banner.image_url}
                            alt={banner.title || 'Banner'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%231a2332" width="100" height="100"/%3E%3Ctext fill="%23666" x="50" y="50" text-anchor="middle" dy=".3em"%3EResim Yok%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {banner.title && (
                                <h4 className="text-white font-medium mb-1">{banner.title}</h4>
                              )}
                              {banner.subtitle && (
                                <p className="text-gray-400 text-sm mb-2">{banner.subtitle}</p>
                              )}
                              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                <span>Sıra: {banner.order}</span>
                                {banner.link_url && <span>• Link: {banner.link_url}</span>}
                                {banner.button_text && <span>• Buton: {banner.button_text}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={banner.is_active ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'}>
                                {banner.is_active ? 'Aktif' : 'Pasif'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-400 hover:text-amber-500"
                                onClick={() => handleBannerEdit(banner)}
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-400 hover:text-red-500"
                                onClick={() => handleBannerDelete(banner.id)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-0">
          <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Sistem Ayarları</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-400">Minimum Bahis Miktarı</Label>
                <Input
                  type="number"
                  defaultValue="10"
                  className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1 max-w-xs"
                />
              </div>
              <div>
                <Label className="text-gray-400">Maksimum Bahis Miktarı</Label>
                <Input
                  type="number"
                  defaultValue="10000"
                  className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1 max-w-xs"
                />
              </div>
              <div>
                <Label className="text-gray-400">Maksimum Kombine Sayısı</Label>
                <Input
                  type="number"
                  defaultValue="20"
                  className="bg-[#1a2332] border-[#2a3a4d] text-white mt-1 max-w-xs"
                />
              </div>
              <Button className="bg-amber-500 hover:bg-amber-600 text-black mt-4">
                Kaydet
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
