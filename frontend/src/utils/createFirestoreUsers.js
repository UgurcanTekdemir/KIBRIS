/**
 * Utility script to create Firestore user documents for existing Firebase Authentication users
 * 
 * Usage:
 * 1. Open browser console on your app
 * 2. Import this function: import { createFirestoreUserForAuth } from './utils/createFirestoreUsers'
 * 3. Call: createFirestoreUserForAuth('user-email@example.com', 'superadmin', 'username')
 * 
 * Or use the SuperAdmin panel to create users
 */

import { createUser } from '../services/userService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

/**
 * Create Firestore user document for an existing Firebase Authentication user
 * @param {string} email - User email
 * @param {string} password - User password (to verify authentication)
 * @param {string} role - User role ('superadmin', 'agent', 'player')
 * @param {string} username - Username
 * @param {string} parentId - Parent ID (for agents and players)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const createFirestoreUserForAuth = async (
  email,
  password,
  role = 'player',
  username = null,
  parentId = null
) => {
  try {
    // First, try to sign in to verify the user exists in Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Sign out immediately after verification
    await auth.signOut();
    
    // Check if user already exists in Firestore
    const { getUserById } = await import('../services/userService');
    const existingUser = await getUserById(firebaseUser.uid);
    
    if (existingUser) {
      // Update existing user with new role/email if needed
      const { updateUser } = await import('../services/userService');
      await updateUser(firebaseUser.uid, {
        email: email,
        role: role,
        username: username || email.split('@')[0],
        parentId: parentId,
      });
      
      return {
        success: true,
        message: `Kullanıcı güncellendi: ${email} (${role})`
      };
    } else {
      // Create new user document
      const userData = {
        email: email,
        username: username || email.split('@')[0],
        role: role,
        parentId: parentId,
        balance: role === 'superadmin' ? 999999 : role === 'agent' ? 50000 : 0,
        credit: role === 'agent' ? 100000 : 0,
        isBanned: false,
      };
      
      await createUser(firebaseUser.uid, userData);
      
      return {
        success: true,
        message: `Kullanıcı oluşturuldu: ${email} (${role})`
      };
    }
  } catch (error) {
    console.error('Error creating Firestore user:', error);
    
    if (error.code === 'auth/user-not-found') {
      return {
        success: false,
        message: 'Firebase Authentication\'da bu kullanıcı bulunamadı. Önce Firebase Console\'dan kullanıcı oluşturun.'
      };
    } else if (error.code === 'auth/wrong-password') {
      return {
        success: false,
        message: 'Yanlış şifre. Lütfen doğru şifreyi girin.'
      };
    }
    
    return {
      success: false,
      message: `Hata: ${error.message}`
    };
  }
};

/**
 * Batch create Firestore users for multiple Firebase Auth users
 * @param {Array<{email: string, password: string, role: string, username?: string, parentId?: string}>} users
 * @returns {Promise<Array<{success: boolean, message: string}>>}
 */
export const batchCreateFirestoreUsers = async (users) => {
  const results = [];
  
  for (const user of users) {
    const result = await createFirestoreUserForAuth(
      user.email,
      user.password,
      user.role,
      user.username,
      user.parentId
    );
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
};

