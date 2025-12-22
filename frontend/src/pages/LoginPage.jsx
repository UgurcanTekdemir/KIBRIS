import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User, Lock, AlertCircle } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = login(username, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-2xl p-6 sm:p-8">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center">
              <span className="text-2xl sm:text-3xl font-bold text-black">B</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Giriş Yap</h1>
            <p className="text-gray-500 mt-1 text-sm">Hesabınıza giriş yapın</p>
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınızı girin"
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
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
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-6 p-4 bg-[#1a2332] rounded-lg">
            <p className="text-xs text-gray-500 mb-2">Demo Hesaplar:</p>
            <div className="space-y-1 text-xs text-gray-400">
              <p><span className="text-amber-500">Admin:</span> admin / admin123</p>
              <p><span className="text-amber-500">Bayi:</span> bayi1 / bayi123</p>
              <p><span className="text-amber-500">Kullanıcı:</span> kullanici1 / user123</p>
            </div>
          </div>

          {/* Register Link */}
          <p className="text-center mt-6 text-gray-500">
            Hesabınız yok mu?{' '}
            <Link to="/register" className="text-amber-500 hover:underline">
              Kayıt Ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
