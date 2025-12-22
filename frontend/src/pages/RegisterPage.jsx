import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User, Lock, Mail, Phone, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    setLoading(true);
    // Simulate registration
    setTimeout(() => {
      setLoading(false);
      toast.success('Kayıt başarılı! Giriş yapabilirsiniz.');
      navigate('/login');
    }, 1000);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-4 relative">
      {/* Back Button - Mobile Only */}
      <button
        onClick={() => navigate(-1)}
        className="lg:hidden fixed top-20 left-4 z-40 p-2 bg-[#0d1117] border border-[#1e2736] rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2332] transition-colors shadow-lg"
        aria-label="Geri"
      >
        <ArrowLeft size={20} />
      </button>
      
      <div className="w-full max-w-md">
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center">
              <span className="text-3xl font-bold text-black">B</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Kayıt Ol</h1>
            <p className="text-gray-500 mt-1">Yeni hesap oluşturun</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-6">
              <AlertCircle size={18} className="text-red-500" />
              <span className="text-red-500 text-sm">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-gray-400">Kullanıcı Adı</Label>
              <div className="relative mt-1">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Kullanıcı adınız"
                  className="pl-10 bg-[#1a2332] border-[#2a3a4d] text-white"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-400">E-posta</Label>
              <div className="relative mt-1">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="E-posta adresiniz"
                  className="pl-10 bg-[#1a2332] border-[#2a3a4d] text-white"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone" className="text-gray-400">Telefon</Label>
              <div className="relative mt-1">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="0555 555 55 55"
                  className="pl-10 bg-[#1a2332] border-[#2a3a4d] text-white"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-400">Şifre</Label>
              <div className="relative mt-1">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Şifreniz"
                  className="pl-10 bg-[#1a2332] border-[#2a3a4d] text-white"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-gray-400">Şifre Tekrar</Label>
              <div className="relative mt-1">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Şifrenizi tekrar girin"
                  className="pl-10 bg-[#1a2332] border-[#2a3a4d] text-white"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold py-3"
              disabled={loading}
            >
              {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-center mt-6 text-gray-500">
            Zaten hesabınız var mı?{' '}
            <Link to="/login" className="text-amber-500 hover:underline">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
