import React, { useEffect, useRef } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { BetSlipProvider } from "./context/BetSlipContext";
import Layout from "./components/layout/Layout";
import Loader from "./components/Loader";
import HomePage from "./pages/HomePage";
import LiveMatchesPage from "./pages/LiveMatchesPage";
import MatchesPage from "./pages/MatchesPage";
import MatchDetailPage from "./pages/MatchDetailPage";
import LeaguePage from "./pages/LeaguePage";
import LeaguesPage from "./pages/LeaguesPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import CouponsPage from "./pages/CouponsPage";
import AdminPanel from "./pages/AdminPanel";
import AgentPanel from "./pages/AgentPanel";
import BetSlipPage from "./pages/BetSlipPage";

// Helper function to get storage key
const getScrollStorageKey = (path) => `scrollPos_${path}`;

// Component to handle scroll restoration
const ScrollRestoration = () => {
  const location = useLocation();
  const isMatchDetail = location.pathname.startsWith('/match/');
  const prevPathRef = useRef(location.pathname);
  
  // Save scroll position continuously as user scrolls
  useEffect(() => {
    if (isMatchDetail) return;

    let rafId = null;
    let lastScrollY = 0;
    const storageKey = getScrollStorageKey(location.pathname);

    const handleScroll = () => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        
        // Only save if scroll position changed significantly (to avoid too many writes)
        if (Math.abs(scrollY - lastScrollY) > 10) {
          lastScrollY = scrollY;
          try {
            sessionStorage.setItem(storageKey, scrollY.toString());
          } catch (e) {
            // Ignore storage errors
          }
        }
        
        rafId = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      // Final save on unmount
      const finalScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      if (finalScrollY > 0) {
        try {
          sessionStorage.setItem(storageKey, finalScrollY.toString());
        } catch (e) {
          // Ignore storage errors
        }
      }
    };
  }, [location.pathname, isMatchDetail]);

  // Restore scroll position when route changes
  useEffect(() => {
    const currentPath = location.pathname;
    const storageKey = getScrollStorageKey(currentPath);
    
    if (isMatchDetail) {
      // Match detail pages: always scroll to top
      prevPathRef.current = currentPath;
      window.scrollTo(0, 0);
      return;
    }

    // Other pages: restore saved scroll position
    let savedScrollY = null;
    try {
      savedScrollY = sessionStorage.getItem(storageKey);
    } catch (e) {
      // Ignore storage errors
    }
    
    if (savedScrollY) {
      const scrollY = parseInt(savedScrollY, 10);
      if (isNaN(scrollY) || scrollY < 0) {
        window.scrollTo(0, 0);
        return;
      }
      
      // Multiple restoration attempts for slow-loading content
      const restoreScroll = () => {
        window.scrollTo(0, scrollY);
      };
      
      // Immediate
      restoreScroll();
      
      // After next tick
      const timer1 = setTimeout(restoreScroll, 0);
      
      // After short delay
      const timer2 = setTimeout(restoreScroll, 50);
      
      // After longer delay (for async content)
      const timer3 = setTimeout(() => {
        const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        if (Math.abs(currentScroll - scrollY) > 50) {
          restoreScroll();
        }
      }, 200);

      prevPathRef.current = currentPath;

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      // No saved position: scroll to top
      prevPathRef.current = currentPath;
      window.scrollTo(0, 0);
    }
  }, [location.pathname, isMatchDetail]);

  return null;
};

function AppContent() {
  return (
    <>
      <ScrollRestoration />
      <Layout>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="live" element={<LiveMatchesPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="match/:id" element={<MatchDetailPage />} />
          <Route path="leagues" element={<LeaguesPage />} />
          <Route path="league/:id" element={<LeaguePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="betslip" element={<BetSlipPage />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="agent" element={<AgentPanel />} />
        </Routes>
      </Layout>
    </>
  );
}

// Create a client for React Query with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // Data is fresh for 1 minute
      cacheTime: 300000, // Cache unused data for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on window focus
      retry: 1, // Only retry once on failure
    },
  },
});

function App() {
  // Enable browser's native scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return (
    <>
      <Loader />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BetSlipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<AuthPage />} />
                <Route path="/register" element={<AuthPage />} />
                <Route path="/*" element={<AppContent />} />
              </Routes>
            </BrowserRouter>
          </BetSlipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </>
  );
}

export default App;
