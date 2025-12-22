import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BetSlip from '../betting/BetSlip';
import MobileNavigation from './MobileNavigation';
import MagicNavigation from './MagicNavigation';
import Footer from './Footer';
import { Toaster } from 'sonner';

const Layout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#080b10]">
      <Toaster position="top-center" theme="dark" richColors />
      <Header
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      
      {/* Magic Navigation - Desktop Only (includes logo, site name, login/register) */}
      <div className="hidden md:block">
        <MagicNavigation />
      </div>
      
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="pt-14 md:pt-[116px] lg:pt-[116px] lg:pl-64 pb-20 lg:pb-0 flex flex-col min-h-screen">
        <div className="flex gap-0 lg:gap-4 flex-1">
          {/* Main Content */}
          <main className="flex-1 w-full lg:max-w-[calc(100%-22rem)] px-2 sm:px-3 lg:p-4">
            {children}
          </main>
          
          {/* BetSlip Sidebar (Desktop Only) */}
          <aside className="hidden xl:block w-80 flex-shrink-0 p-4 sticky top-[116px] h-[calc(100vh-116px)] overflow-hidden">
            <BetSlip />
          </aside>
        </div>

        {/* Footer */}
        <Footer />
      </div>

      {/* Mobile Navigation */}
      <MobileNavigation />
    </div>
  );
};

export default Layout;
