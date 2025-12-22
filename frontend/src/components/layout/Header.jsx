import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, User, LogOut, Wallet, FileText, Settings, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const Header = ({ onMenuToggle, isMobileMenuOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'agent':
        return 'Bayi';
      default:
        return 'Kullanıcı';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#0a0e14] to-[#141b27] border-b border-[#1e2736]">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4">
        {/* Logo & Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center font-bold text-black text-lg">
              B
            </div>
            <span className="text-xl font-bold text-white hidden sm:block">BullBet</span>
          </Link>
        </div>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-gray-300 hover:text-amber-500 transition-colors font-medium">
            Ana Sayfa
          </Link>
          <Link to="/live" className="text-gray-300 hover:text-amber-500 transition-colors font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Canlı
          </Link>
          <Link to="/matches" className="text-gray-300 hover:text-amber-500 transition-colors font-medium">
            Maçlar
          </Link>
        </nav>

        {/* User Section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {/* Balance - Hidden on very small screens */}
              <div className="hidden xs:flex items-center gap-1.5 sm:gap-2 bg-[#1a2332] px-2 sm:px-3 py-1.5 rounded-lg border border-[#2a3a4d]">
                <Wallet size={14} className="text-amber-500 sm:w-4 sm:h-4" />
                <span className="text-white font-semibold text-sm sm:text-base">
                  {user.balance >= 1000 
                    ? `${(user.balance / 1000).toFixed(1)}K` 
                    : user.balance.toLocaleString('tr-TR')} ₺
                </span>
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-1.5 sm:gap-2 text-gray-300 hover:text-white hover:bg-[#1a2332] px-2 sm:px-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center">
                      <User size={14} className="text-black sm:w-4 sm:h-4" />
                    </div>
                    <span className="hidden sm:block text-sm">{user.username}</span>
                    <ChevronDown size={14} className="hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-[#1a2332] border-[#2a3a4d]">
                  <div className="px-3 py-2 border-b border-[#2a3a4d]">
                    <p className="text-white font-medium">{user.username}</p>
                    <p className="text-xs text-amber-500">{getRoleLabel(user.role)}</p>
                    <p className="text-sm text-gray-400 mt-1 xs:hidden">
                      Bakiye: {user.balance.toLocaleString('tr-TR')} ₺
                    </p>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer">
                      <User size={16} />
                      Hesabım
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/coupons" className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer">
                      <FileText size={16} />
                      Kuponlarım
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === 'admin' || user.role === 'agent') && (
                    <DropdownMenuItem asChild>
                      <Link
                        to={user.role === 'admin' ? '/admin' : '/agent'}
                        className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer"
                      >
                        <Settings size={16} />
                        {user.role === 'admin' ? 'Admin Panel' : 'Bayi Panel'}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-[#2a3a4d]" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    <LogOut size={16} />
                    Çıkış Yap
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
    </header>
  );
};

export default Header;
