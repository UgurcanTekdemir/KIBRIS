/**
 * Utility to set user role in Firestore
 * This can be run from browser console to set your role to superadmin
 * 
 * Usage in browser console:
 * 1. Make sure you're logged in
 * 2. Open browser console (F12)
 * 3. Copy and paste this code:
 * 
 * import { updateUser } from './services/userService';
 * import { auth } from './config/firebase';
 * 
 * if (auth.currentUser) {
 *   updateUser(auth.currentUser.uid, { role: 'superadmin' })
 *     .then(() => console.log('✅ Role updated to superadmin!'))
 *     .catch(err => console.error('❌ Error:', err));
 * } else {
 *   console.log('❌ Please login first');
 * }
 */

import { updateUser } from '../services/userService';
import { auth } from '../config/firebase';

/**
 * Set current user's role in Firestore
 * @param {string} role - Role to set ('superadmin', 'agent', 'player')
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const setCurrentUserRole = async (role = 'superadmin') => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      return {
        success: false,
        message: 'Lütfen önce giriş yapın'
      };
    }

    await updateUser(currentUser.uid, { role });
    
    return {
      success: true,
      message: `Rol başarıyla '${role}' olarak ayarlandı. Sayfayı yenileyin.`
    };
  } catch (error) {
    console.error('Error setting user role:', error);
    return {
      success: false,
      message: `Hata: ${error.message}`
    };
  }
};

/**
 * Set role for any user by email
 * @param {string} email - User email
 * @param {string} role - Role to set
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const setUserRoleByEmail = async (email, role = 'superadmin') => {
  try {
    // Get user by email from Firestore
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('../config/firebase');
    
    const q = query(
      collection(db, 'users'),
      where('email', '==', email)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return {
        success: false,
        message: `E-posta ile kullanıcı bulunamadı: ${email}`
      };
    }
    
    const userDoc = snapshot.docs[0];
    await updateUser(userDoc.id, { role });
    
    return {
      success: true,
      message: `Kullanıcı '${email}' rolü '${role}' olarak ayarlandı`
    };
  } catch (error) {
    console.error('Error setting user role by email:', error);
    return {
      success: false,
      message: `Hata: ${error.message}`
    };
  }
};

