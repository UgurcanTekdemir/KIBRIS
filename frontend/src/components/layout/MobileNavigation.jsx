import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Zap, Calendar, FileText, User } from 'lucide-react';
import { useBetSlip } from '../../context/BetSlipContext';
import { useAuth } from '../../context/AuthContext';

const MobileNavigation = () => {
  const location = useLocation();
  const { selections } = useBetSlip();
  const { user } = useAuth();

  const navItems = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/live', label: 'Canlı', icon: Zap, isLive: true },
    { path: '/betslip', label: 'Kupon', icon: FileText, badge: selections.length },
    { path: '/matches', label: 'Maçlar', icon: Calendar },
    { path: user ? '/dashboard' : '/login', label: user ? 'Hesap' : 'Giriş', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e14] border-t border-[#1e2736] lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-2 relative transition-colors ${
                isActive ? 'text-amber-500' : 'text-gray-500'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {item.isLive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
                {item.badge > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-amber-500' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavigation;
