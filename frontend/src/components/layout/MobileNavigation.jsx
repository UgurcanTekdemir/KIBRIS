import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Zap, Calendar, FileText, User } from 'lucide-react';
import { useBetSlip } from '../../context/BetSlipContext';
import { useAuth } from '../../context/AuthContext';

const MobileNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selections } = useBetSlip();
  const { user } = useAuth();

  const navItems = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/live', label: 'Canlı', icon: Zap, isLive: true },
    { path: '/betslip', label: 'Kupon', icon: FileText, badge: selections.length },
    { path: '/matches', label: 'Maçlar', icon: Calendar },
    { path: user ? '/dashboard' : '/login', label: user ? 'Hesap' : 'Giriş', icon: User },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path, e) => {
    e.preventDefault();
    
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e14] border-t border-[#1e2736] lg:hidden safe-area-bottom">
      {/* Magic Navigation Bar - Mobile */}
      <div className="flex justify-center items-center py-3 px-2 w-full">
        <ul className="magic-navigation-mobile">
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
                    <Icon size={20} />
                    {item.isLive && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse z-10"></span>
                    )}
                    {item.badge > 0 && (
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
    </nav>
  );
};

export default MobileNavigation;
