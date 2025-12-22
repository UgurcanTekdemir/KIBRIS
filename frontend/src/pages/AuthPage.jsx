import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

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
  const { login } = useAuth();
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

    const result = login(formData.username, formData.password);
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

    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    setLoading(true);
    // Simulate registration
    setTimeout(() => {
      setLoading(false);
      toast.success('Kayıt başarılı! Giriş yapabilirsiniz.');
      setIsSignIn(true);
      setFormData({ username: '', email: '', password: '', confirmPassword: '' });
    }, 1000);
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

          {/* Demo Accounts */}
          <div className="demo-accounts">
            <p className="demo-title">Demo Hesaplar:</p>
            <div className="demo-list">
              <p><span className="demo-label">Admin:</span> admin / admin123</p>
              <p><span className="demo-label">Bayi:</span> bayi1 / bayi123</p>
              <p><span className="demo-label">Kullanıcı:</span> kullanici1 / user123</p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

