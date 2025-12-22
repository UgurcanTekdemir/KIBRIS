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
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Balance */}
              <div className="hidden sm:flex items-center gap-2 bg-[#1a2332] px-3 py-1.5 rounded-lg border border-[#2a3a4d]">
                <Wallet size={16} className="text-amber-500" />
                <span className="text-white font-semibold">
                  {user.balance.toLocaleString('tr-TR')} ₺
                </span>
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-gray-300 hover:text-white hover:bg-[#1a2332]">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center">
                      <User size={16} className="text-black" />
                    </div>
                    <span className="hidden sm:block">{user.username}</span>
                    <ChevronDown size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-[#1a2332] border-[#2a3a4d]">
                  <div className="px-3 py-2 border-b border-[#2a3a4d]">
                    <p className="text-white font-medium">{user.username}</p>
                    <p className="text-xs text-amber-500">{getRoleLabel(user.role)}</p>
                    <p className="text-sm text-gray-400 mt-1 sm:hidden">
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
                <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-[#1a2332]">
                  Giriş Yap
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold">
                  Kayıt Ol
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Betslip Button */}
          {selections.length > 0 && (
            <Link to="/betslip" className="lg:hidden">
              <Button className="relative bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-3">
                <FileText size={18} />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                  {selections.length}
                </span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
