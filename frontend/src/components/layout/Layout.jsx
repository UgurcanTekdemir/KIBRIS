import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BetSlip from '../betting/BetSlip';
import { Toaster } from 'sonner';

const Layout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#080b10]">
      <Toaster position="top-right" theme="dark" richColors />
      <Header
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="pt-14 lg:pl-64">
        <div className="flex">
          {/* Main Content */}
          <main className="flex-1 min-h-[calc(100vh-56px)] p-4">
            {children}
          </main>
          
          {/* BetSlip Sidebar (Desktop) */}
          <aside className="hidden xl:block w-80 p-4 sticky top-14 h-[calc(100vh-56px)]">
            <BetSlip />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Layout;
