/**
 * Set user role by UID
 * This script can be run from browser console to set role for a specific user
 */

import { updateUser, getUserById } from '../services/userService';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Set role for a user by UID
 * @param {string} uid - User UID from Firebase Authentication
 * @param {string} role - Role to set ('superadmin', 'agent', 'player')
 * @param {string} email - User email (optional, will be fetched if not provided)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const setUserRoleByUID = async (uid, role = 'superadmin', email = null) => {
  try {
    // Check if user exists in Firestore
    let userData = await getUserById(uid);
    
    if (userData) {
      // User exists, update role
      await updateUser(uid, { role });
      return {
        success: true,
        message: `Kullanıcı rolü '${role}' olarak güncellendi`
      };
    } else {
      // User doesn't exist, create new document
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        email: email || `user-${uid.substring(0, 8)}@example.com`,
        username: email ? email.split('@')[0] : `user-${uid.substring(0, 8)}`,
        role: role,
        balance: role === 'superadmin' ? 999999 : role === 'agent' ? 50000 : 0,
        credit: role === 'agent' ? 100000 : 0,
        isBanned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return {
        success: true,
        message: `Kullanıcı Firestore'da oluşturuldu ve rolü '${role}' olarak ayarlandı`
      };
    }
  } catch (error) {
    console.error('Error setting user role:', error);
    return {
      success: false,
      message: `Hata: ${error.message}`
    };
  }
};

/**
 * Quick function to set superadmin role for specific UID
 * Usage: setSuperAdmin('3YrwSGjZAHXMgI0j5zg4pswuvJe2')
 */
export const setSuperAdmin = async (uid) => {
  return setUserRoleByUID(uid, 'superadmin');
};

