import React from 'react';
import { Menu, X } from 'lucide-react';

const Header = ({ onMenuToggle, isMobileMenuOpen }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 lg:hidden">
      {/* Mobile Menu Button Only */}
      <div className="flex items-center h-14 px-3 sm:px-4 bg-gradient-to-r from-[#0a0e14] to-[#141b27] border-b border-[#1e2736]">
        <button
          onClick={onMenuToggle}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
