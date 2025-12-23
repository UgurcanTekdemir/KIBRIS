import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Header = ({ onMenuToggle, isMobileMenuOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogoClick = (e) => {
    e.preventDefault();
    // Always navigate to home page
    navigate('/');
    // Scroll to top after navigation
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 lg:hidden">
      {/* Mobile Header with Menu Button, Logo and Site Name */}
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 bg-gradient-to-r from-[#0a0e14] to-[#141b27] border-b border-[#1e2736]">
        <button
          onClick={onMenuToggle}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        
        {/* Logo & Site Name */}
        <a 
          href="/" 
          onClick={handleLogoClick}
          className="flex items-center gap-2 logo-container mobile-logo-shift cursor-pointer"
        >
          <img 
            src="https://img.icons8.com/?size=100&id=9ESZMOeUioJS&format=png&color=f59e0b" 
            alt="GuessBet Logo" 
            className="w-8 h-8 logo-box"
          />
          <span className="text-xl font-bold text-white site-name">
            Guess<span className="text-orange-500">Bet</span>
          </span>
        </a>
        
        {/* Spacer for centering */}
        <div className="w-10"></div>
      </div>
    </header>
  );
};

export default Header;
