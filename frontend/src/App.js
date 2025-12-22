import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { BetSlipProvider } from "./context/BetSlipContext";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import LiveMatchesPage from "./pages/LiveMatchesPage";
import MatchesPage from "./pages/MatchesPage";
import MatchDetailPage from "./pages/MatchDetailPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import CouponsPage from "./pages/CouponsPage";
import AdminPanel from "./pages/AdminPanel";
import AgentPanel from "./pages/AgentPanel";
import BetSlipPage from "./pages/BetSlipPage";

function App() {
  return (
    <AuthProvider>
      <BetSlipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route index element={<HomePage />} />
                    <Route path="live" element={<LiveMatchesPage />} />
                    <Route path="matches" element={<MatchesPage />} />
                    <Route path="match/:id" element={<MatchDetailPage />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="coupons" element={<CouponsPage />} />
                    <Route path="betslip" element={<BetSlipPage />} />
                    <Route path="admin" element={<AdminPanel />} />
                    <Route path="agent" element={<AgentPanel />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
        </BrowserRouter>
      </BetSlipProvider>
    </AuthProvider>
  );
}

export default App;
