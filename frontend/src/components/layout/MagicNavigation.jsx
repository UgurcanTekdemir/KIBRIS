import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Zap, Calendar, User, FileText, Wallet, LogOut, Shield, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBetSlip } from '../../context/BetSlipContext';
import { Button } from '../ui/button';

const MagicNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { selections } = useBetSlip();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'superadmin':
        return 'SuperAdmin';
      case 'admin':
        return 'Admin';
      case 'agent':
        return 'Bayi';
      default:
        return 'Kullanıcı';
    }
  };

  // Get role-based button info
  const getRoleButtonInfo = (role) => {
    switch (role) {
      case 'superadmin':
        return {
          path: '/superadmin',
          label: 'SuperAdmin Panel',
          icon: Shield,
          className: 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'
        };
      case 'agent':
        return {
          path: '/agent',
          label: 'Agent Panel',
          icon: Building2,
          className: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
        };
      default:
        return {
          path: '/dashboard',
          label: 'Profil',
          icon: User,
          className: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black'
        };
    }
  };

  const navItems = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/live', label: 'Canlı', icon: Zap, isLive: true },
    { path: '/matches', label: 'Maçlar', icon: Calendar },
    { path: user ? '/dashboard' : '/login', label: user ? 'Hesabım' : 'Giriş', icon: User },
    { path: '/coupons', label: 'Kuponlarım', icon: FileText, badge: selections.length },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path, e) => {
    e.preventDefault();
    
    // Special handling for home page (logo click)
    if (path === '/') {
      navigate('/');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      return;
    }
    
    // Check if we're already on this page
    const isCurrentlyActive = isActive(path);
    
    if (isCurrentlyActive) {
      // If already on this page, scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // If on different page, navigate
      navigate(path);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#0a0e14] to-[#141b27] border-b border-[#1e2736]">
      {/* Magic Navigation Bar - Desktop Only - Integrated Header */}
      <div className="hidden md:flex justify-between items-center py-4 px-4 w-full magic-nav-wrapper">
        {/* Logo & Site Name - Left Side */}
        <a 
          href="/" 
          onClick={(e) => handleNavClick('/', e)}
          className="flex items-center gap-2 logo-container flex-shrink-0 cursor-pointer"
        >
          <img 
            src="https://img.icons8.com/?size=100&id=9ESZMOeUioJS&format=png&color=f59e0b" 
            alt="GuessBet Logo" 
            className="w-8 h-8 logo-box"
          />
          <span className="text-xl font-bold text-white hidden sm:block site-name">
            Guess<span className="text-orange-500">Bet</span>
          </span>
        </a>

        {/* Magic Navigation Items - Center */}
        <div className="flex-1 flex justify-center items-center">
          <ul className="magic-navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <li key={item.path} className={active ? 'active' : ''}>
                  <a 
                    href={item.path} 
                    onClick={(e) => handleNavClick(item.path, e)}
                    className="cursor-pointer"
                  >
                    <span className="icon" style={{ position: 'relative' }}>
                      <Icon size={24} />
                      {item.isLive && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse z-10"></span>
                      )}
                      {item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center z-10">
                          {item.badge}
                        </span>
                      )}
                    </span>
                    <span className="text">{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        {/* User Section or Login/Register Buttons - Right Side */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {user ? (
            <>
              {/* Balance */}
              <div className="hidden xs:flex items-center gap-1.5 sm:gap-2 bg-[#1a2332] px-2 sm:px-3 py-1.5 rounded-lg border border-[#2a3a4d]">
                <Wallet size={14} className="text-amber-500 sm:w-4 sm:h-4" />
                <span className="text-white font-semibold text-sm sm:text-base">
                  {(() => {
                    if (!user || user.balance === undefined || user.balance === null) return '0';
                    const balance = typeof user.balance === 'number' ? user.balance : parseFloat(user.balance);
                    if (isNaN(balance) || balance === 0 || !isFinite(balance)) return '0';
                    if (balance >= 1000) {
                      return `${(balance / 1000).toFixed(1)}K`;
                    }
                    try {
                      return balance.toLocaleString('tr-TR');
                    } catch (e) {
                      return balance.toString();
                    }
                  })()} ₺
                </span>
              </div>

              {/* Role-based Panel Button */}
              {(() => {
                const roleButton = getRoleButtonInfo(user.role);
                const RoleIcon = roleButton.icon;
                return (
                  <Link to={roleButton.path}>
                    <Button className={`${roleButton.className} font-semibold text-sm px-3 sm:px-4 flex items-center gap-2`}>
                      <RoleIcon size={16} />
                      <span className="hidden sm:block">{roleButton.label}</span>
                      <span className="sm:hidden">{roleButton.label.split(' ')[0]}</span>
                    </Button>
                  </Link>
                );
              })()}

              {/* Logout Button */}
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-gray-300 hover:text-red-400 hover:bg-[#1a2332] px-2 sm:px-3"
                title="Çıkış Yap"
              >
                <LogOut size={18} className="sm:w-5 sm:h-5" />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-[#1a2332] text-sm px-2 sm:px-4">
                  Giriş
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold text-sm px-3 sm:px-4">
                  Kayıt
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MagicNavigation;

