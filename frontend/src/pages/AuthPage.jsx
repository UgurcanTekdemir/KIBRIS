import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';

const AuthPage = () => {
  const location = useLocation();
  const [isSignIn, setIsSignIn] = useState(location.pathname === '/login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setIsSignIn(location.pathname === '/login');
  }, [location.pathname]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.email || !formData.password) {
      setError('E-posta ve şifre gereklidir');
      setLoading(false);
      return;
    }

    const result = await login(formData.email, formData.password);
    setLoading(false);

    if (result.success) {
      toast.success('Giriş başarılı!');
      navigate('/');
    } else {
      setError(result.error);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username || !formData.email || !formData.password) {
      setError('Tüm alanları doldurun');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);
    try {
      const result = await register(formData.email, formData.password, formData.username, 'player');
      if (result.success) {
        // Show success dialog
        setShowSuccessDialog(true);
        toast.success('Kayıt başarılı! Giriş yapabilirsiniz.');
        setFormData({ username: '', email: '', password: '', confirmPassword: '' });
      } else {
        setError(result.error);
        toast.error(result.error || 'Kayıt başarısız oldu');
      }
    } catch (error) {
      const errorMessage = 'Kayıt sırasında bir hata oluştu';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-4 relative">
      {/* Back to Home Button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-20 md:top-24 left-4 z-40 flex items-center gap-2 p-2.5 bg-[#0d1117] border border-[#1e2736] rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2332] transition-colors shadow-lg"
        aria-label="Ana Sayfaya Dön"
      >
        <ArrowLeft size={20} />
        <span className="hidden sm:inline text-sm font-medium">Ana Sayfa</span>
      </button>

      <div className="flex flex-col items-center gap-6">
        {/* Logo & Site Name - Centered above forms */}
        <Link to="/" className="flex items-center gap-2 logo-container auth-logo-shift">
          <img 
            src="https://img.icons8.com/?size=100&id=9ESZMOeUioJS&format=png&color=f59e0b" 
            alt="GuessBet Logo" 
            className="w-12 h-12 logo-box"
          />
          <span className="text-2xl font-bold text-white site-name">
            Guess<span className="text-orange-500">Bet</span>
          </span>
        </Link>

        <div className={`auth-container ${isSignIn ? 'signinForm' : ''}`}>
          {/* Sign Up Form */}
          <div className={`auth-form signup ${isSignIn ? 'hidden' : ''}`}>
            <h2>Kayıt Ol</h2>
          <form onSubmit={handleSignup}>
            <div className="inputBox">
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
              <User className="icon" size={18} />
              <span>Kullanıcı Adı</span>
            </div>
            <div className="inputBox">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <Mail className="icon" size={18} />
              <span>E-posta Adresi</span>
            </div>
            <div className="inputBox">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <Lock className="icon" size={18} />
              <span>Şifre Oluştur</span>
            </div>
            <div className="inputBox">
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              <Lock className="icon" size={18} />
              <span>Şifreyi Onayla</span>
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="inputBox">
              <input type="submit" value={loading ? 'Kayıt yapılıyor...' : 'Hesap Oluştur'} disabled={loading} />
            </div>
            <p>
              Zaten üye misiniz?{' '}
              <a href="#" className="login" onClick={(e) => { e.preventDefault(); setIsSignIn(true); }}>
                Giriş Yap
              </a>
            </p>
          </form>
        </div>

        {/* Sign In Form */}
        <div className={`auth-form signin ${!isSignIn ? 'hidden' : ''}`}>
          <h2>Giriş Yap</h2>
          <form onSubmit={handleLogin}>
            <div className="inputBox">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <Mail className="icon" size={18} />
              <span>E-posta Adresi</span>
            </div>
            <div className="inputBox">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <Lock className="icon" size={18} />
              <span>Şifre</span>
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="inputBox">
              <input type="submit" value={loading ? 'Giriş yapılıyor...' : 'Giriş Yap'} disabled={loading} />
            </div>
            <p>
              Üye değil misiniz?{' '}
              <a href="#" className="create" onClick={(e) => { e.preventDefault(); setIsSignIn(false); }}>
                Hesap Oluştur
              </a>
            </p>
          </form>

        </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-[#0d1117] border-[#1e2736] text-white max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-center justify-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <span className="text-xl">Kayıt Başarılı!</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-gray-300 text-center">
              Hesabınız başarıyla oluşturuldu. Şimdi giriş yapabilirsiniz.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setShowSuccessDialog(false);
                  setIsSignIn(true);
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                Giriş Yap
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSuccessDialog(false);
                  navigate('/');
                }}
                className="w-full border-[#1e2736] text-gray-300 hover:text-white"
              >
                Ana Sayfaya Dön
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthPage;

