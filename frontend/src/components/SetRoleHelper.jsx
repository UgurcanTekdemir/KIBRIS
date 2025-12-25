/**
 * Helper component to set user role
 * Can be temporarily added to any page for easy role setting
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUser } from '../services/userService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

const SetRoleHelper = () => {
  const { user } = useAuth();
  const [role, setRole] = useState('superadmin');
  const [loading, setLoading] = useState(false);

  const handleSetRole = async () => {
    if (!user || !user.id) {
      toast.error('Lütfen önce giriş yapın');
      return;
    }

    try {
      setLoading(true);
      await updateUser(user.id, { role });
      toast.success(`Rol başarıyla '${role}' olarak ayarlandı! Sayfayı yenileyin.`);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error setting role:', error);
      toast.error('Rol ayarlanırken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  // Show helper if user doesn't have superadmin role OR if we want to set role for specific UID
  // For now, always show if user is logged in
  if (!user) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-[#0d1117] border border-amber-500/50 rounded-lg p-4 shadow-lg z-50 max-w-sm">
      <h3 className="text-white font-bold mb-2">Rol Ayarla</h3>
      
      {/* Current User Role */}
      {user.role !== 'superadmin' && (
        <>
          <p className="text-gray-400 text-sm mb-3">
            Mevcut rol: <span className="text-amber-500">{user.role || 'Yok'}</span>
          </p>
          <div className="space-y-2 mb-4">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2736] rounded-lg text-white text-sm"
            >
              <option value="superadmin">SuperAdmin</option>
              <option value="agent">Agent (Bayi)</option>
              <option value="player">Player (Oyuncu)</option>
            </select>
            <Button
              onClick={handleSetRole}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black"
            >
              {loading ? 'Ayarlanıyor...' : 'Kendi Rolümü Ayarla'}
            </Button>
          </div>
        </>
      )}
      
      <p className="text-xs text-gray-500 mt-2">
        E-posta: {user.email}
      </p>
    </div>
  );
};

export default SetRoleHelper;

