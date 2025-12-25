/**
 * Credit Service
 * Handles credit operations for superadmin and agents
 */
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUserById, updateUser } from './userService';
import { createTransaction } from './transactionService';

const CREDIT_HISTORY_COLLECTION = 'credit_history';

/**
 * Add credit to user (instant transfer)
 */
export const addCredit = async (fromUserId, toUserId, amount, description = '') => {
  try {
    // Get both users
    const fromUser = await getUserById(fromUserId);
    const toUser = await getUserById(toUserId);

    if (!fromUser || !toUser) {
      throw new Error('User not found');
    }

    if (toUser.isBanned) {
      throw new Error('Cannot add credit to banned user');
    }

    // Validate credit flow
    if (fromUser.role === 'superadmin' && toUser.role !== 'agent' && toUser.role !== 'player') {
      throw new Error('Superadmin can only add credit to agents or players');
    }
    if (fromUser.role === 'agent' && toUser.role !== 'player') {
      throw new Error('Agent can only add credit to players');
    }
    if (fromUser.role === 'player') {
      throw new Error('Players cannot add credit');
    }

    // Validate parent relationship (superadmin can remove from any agent/player, agent can only remove from their players)
    if (fromUser.role === 'agent' && toUser.parentId !== fromUserId) {
      throw new Error('Invalid credit relationship');
    }
    // Superadmin can remove credit from any agent or player (no parent check needed)

    // Use batch for atomic operations
    const batch = writeBatch(db);

    // Update toUser credit and balance
    const toUserRef = doc(db, 'users', toUserId);
    const newCredit = (toUser.credit || 0) + amount;
    const newBalance = (toUser.balance || 0) + amount;
    batch.update(toUserRef, {
      credit: newCredit,
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    // Create credit history record
    const creditHistoryRef = doc(collection(db, CREDIT_HISTORY_COLLECTION));
    batch.set(creditHistoryRef, {
      fromUserId,
      toUserId,
      amount,
      type: 'add',
      description: description || `Kredi eklendi`,
      createdAt: serverTimestamp(),
    });

    // Commit batch
    await batch.commit();

    // Create transaction record (async, doesn't need to be in batch)
    await createTransaction({
      userId: toUserId,
      agentId: fromUser.role === 'agent' ? fromUserId : null,
      type: 'credit_add',
      amount,
      description: description || `Kredi eklendi - ${fromUser.username}`,
    });

    return { success: true, newCredit, newBalance };
  } catch (error) {
    console.error('Error adding credit:', error);
    throw error;
  }
};

/**
 * Remove credit from user
 */
export const removeCredit = async (fromUserId, toUserId, amount, description = '') => {
  try {
    // Get both users
    const fromUser = await getUserById(fromUserId);
    const toUser = await getUserById(toUserId);

    if (!fromUser || !toUser) {
      throw new Error('User not found');
    }

    // Validate credit flow (same as add)
    if (fromUser.role === 'superadmin' && toUser.role !== 'agent' && toUser.role !== 'player') {
      throw new Error('Superadmin can only remove credit from agents or players');
    }
    if (fromUser.role === 'agent' && toUser.role !== 'player') {
      throw new Error('Agent can only remove credit from players');
    }
    if (fromUser.role === 'player') {
      throw new Error('Players cannot remove credit');
    }

    // Validate parent relationship (superadmin can remove from any agent/player, agent can only remove from their players)
    if (fromUser.role === 'agent' && toUser.parentId !== fromUserId) {
      throw new Error('Invalid credit relationship');
    }
    // Superadmin can remove credit from any agent or player (no parent check needed)

    // Check if user has enough credit
    const currentCredit = toUser.credit || 0;
    const currentBalance = toUser.balance || 0;
    
    if (currentCredit < amount) {
      throw new Error('Insufficient credit');
    }

    // Use batch for atomic operations
    const batch = writeBatch(db);

    // Update toUser credit (balance can go negative if they have active bets)
    const toUserRef = doc(db, 'users', toUserId);
    const newCredit = currentCredit - amount;
    const newBalance = Math.max(0, currentBalance - amount); // Balance can't go below 0
    batch.update(toUserRef, {
      credit: newCredit,
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    // Create credit history record
    const creditHistoryRef = doc(collection(db, CREDIT_HISTORY_COLLECTION));
    batch.set(creditHistoryRef, {
      fromUserId,
      toUserId,
      amount,
      type: 'remove',
      description: description || `Kredi çıkarıldı`,
      createdAt: serverTimestamp(),
    });

    // Commit batch
    await batch.commit();

    // Create transaction record
    await createTransaction({
      userId: toUserId,
      agentId: fromUser.role === 'agent' ? fromUserId : null,
      type: 'credit_remove',
      amount: -amount,
      description: description || `Kredi çıkarıldı - ${fromUser.username}`,
    });

    return { success: true, newCredit, newBalance };
  } catch (error) {
    console.error('Error removing credit:', error);
    throw error;
  }
};

/**
 * Get credit history for a user
 */
export const getCreditHistory = async (userId, limit = 50) => {
  try {
    const q = query(
      collection(db, CREDIT_HISTORY_COLLECTION),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
  } catch (error) {
    console.error('Error getting credit history:', error);
    throw error;
  }
};

/**
 * Get credit history sent by a user (for agents/superadmin)
 */
export const getSentCreditHistory = async (fromUserId, limit = 50) => {
  try {
    const q = query(
      collection(db, CREDIT_HISTORY_COLLECTION),
      where('fromUserId', '==', fromUserId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
  } catch (error) {
    console.error('Error getting sent credit history:', error);
    throw error;
  }
};

