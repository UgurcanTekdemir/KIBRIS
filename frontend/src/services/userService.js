/**
 * User Service
 * Handles user-related Firestore operations
 */
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const USERS_COLLECTION = 'users';

/**
 * Get user by ID
 */
export const getUserById = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

/**
 * Create user document in Firestore
 */
export const createUser = async (userId, userData) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userRef, {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isBanned: false,
      balance: 0,
      credit: 0,
    });
    return { id: userId, ...userData };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update user document
 */
export const updateUser = async (userId, updates) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { id: userId, ...updates };
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Ban/Unban user
 */
export const banUser = async (userId, banReason = '') => {
  return updateUser(userId, { 
    isBanned: true, 
    banReason,
    updatedAt: serverTimestamp() 
  });
};

export const unbanUser = async (userId) => {
  return updateUser(userId, { 
    isBanned: false, 
    banReason: '',
    updatedAt: serverTimestamp() 
  });
};

/**
 * Get all agents (for superadmin)
 */
export const getAllAgents = async () => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', 'agent'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting agents:', error);
    throw error;
  }
};

/**
 * Get all players for an agent
 */
export const getAgentPlayers = async (agentId) => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', 'player'),
      where('parentId', '==', agentId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting agent players:', error);
    throw error;
  }
};

/**
 * Get all players (for superadmin)
 */
export const getAllPlayers = async () => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', 'player'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all players:', error);
    throw error;
  }
};












