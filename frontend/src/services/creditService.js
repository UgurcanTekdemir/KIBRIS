/**
 * Credit Service
 * Handles credit operations for superadmin and agents
 */
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc,
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
 * Add credit to user (pending - needs approval)
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

    // Validate parent relationship (superadmin can add to any agent/player, agent can only add to their players)
    if (fromUser.role === 'agent' && toUser.parentId !== fromUserId) {
      throw new Error('Invalid credit relationship');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Invalid amount');
    }

    // Create pending credit history record (NOT added to balance yet)
    const creditHistoryRef = doc(collection(db, CREDIT_HISTORY_COLLECTION));
    await addDoc(collection(db, CREDIT_HISTORY_COLLECTION), {
      fromUserId,
      toUserId,
      fromUsername: fromUser.username || fromUser.email,
      toUsername: toUser.username || toUser.email,
      amount: amountNum,
      type: 'add',
      status: 'pending', // pending, paid, cancelled
      isPaid: false,
      description: description || `Kredi eklendi (beklemede)`,
      createdAt: serverTimestamp(),
      paidAt: null,
    });

    return { success: true, message: 'Kredi beklemede olarak eklendi' };
  } catch (error) {
    console.error('Error adding credit:', error);
    throw error;
  }
};

/**
 * Approve pending credit (add to balance)
 */
export const approveCredit = async (creditHistoryId, approverUserId) => {
  try {
    const creditHistoryRef = doc(db, CREDIT_HISTORY_COLLECTION, creditHistoryId);
    const creditDoc = await getDoc(creditHistoryRef);
    
    if (!creditDoc.exists()) {
      throw new Error('Credit record not found');
    }

    const creditData = creditDoc.data();
    
    if (creditData.isPaid || creditData.status === 'paid') {
      throw new Error('Bu kredi zaten ödenmiş');
    }

    if (creditData.status === 'cancelled') {
      throw new Error('Bu kredi iptal edilmiş');
    }

    // Get approver and recipient users
    const approverUser = await getUserById(approverUserId);
    const toUser = await getUserById(creditData.toUserId);

    if (!approverUser || !toUser) {
      throw new Error('User not found');
    }

    // Validate approver permissions
    // Superadmin can approve any credit
    // Agent can only approve credits to their players
    if (approverUser.role === 'agent' && toUser.parentId !== approverUserId) {
      throw new Error('Bu krediyi onaylama yetkiniz yok');
    }

    if (approverUser.role === 'player') {
      throw new Error('Players cannot approve credits');
    }

    // Use batch for atomic operations
    const batch = writeBatch(db);

    // Update toUser credit and balance
    const toUserRef = doc(db, 'users', creditData.toUserId);
    const newCredit = (toUser.credit || 0) + creditData.amount;
    const newBalance = (toUser.balance || 0) + creditData.amount;
    batch.update(toUserRef, {
      credit: newCredit,
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    // Update credit history record
    batch.update(creditHistoryRef, {
      status: 'paid',
      isPaid: true,
      paidAt: serverTimestamp(),
      approvedBy: approverUserId,
      approvedByUsername: approverUser.username || approverUser.email,
    });

    // Commit batch
    await batch.commit();

    // Create transaction record
    await createTransaction({
      userId: creditData.toUserId,
      agentId: creditData.fromUserId,
      type: 'credit_add',
      amount: creditData.amount,
      description: creditData.description || `Kredi onaylandı - ${approverUser.username}`,
    });

    return { success: true, newCredit, newBalance };
  } catch (error) {
    console.error('Error approving credit:', error);
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

    // Parse amount to number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Invalid amount');
    }

    // Check if user has enough credit
    const currentCredit = toUser.credit || 0;
    const currentBalance = toUser.balance || 0;
    
    if (currentCredit < amountNum) {
      throw new Error(`Yetersiz kredi. Mevcut kredi: ${currentCredit.toLocaleString('tr-TR')} ₺, İstenen: ${amountNum.toLocaleString('tr-TR')} ₺`);
    }

    // Use batch for atomic operations
    const batch = writeBatch(db);

    // Update toUser credit (balance can go negative if they have active bets)
    const toUserRef = doc(db, 'users', toUserId);
    const newCredit = currentCredit - amountNum;
    const newBalance = Math.max(0, currentBalance - amountNum); // Balance can't go below 0
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
      fromUsername: fromUser.username || fromUser.email,
      toUsername: toUser.username || toUser.email,
      amount: amountNum,
      type: 'remove',
      status: 'paid', // Credit removal is immediate (not pending)
      isPaid: true,
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
      amount: -amountNum,
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
 * Get pending credits for a user (to approve)
 */
export const getPendingCredits = async (userId, limit = 100) => {
  try {
    // Get credits sent by this user that are pending
    const q = query(
      collection(db, CREDIT_HISTORY_COLLECTION),
      where('fromUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
  } catch (error) {
    console.error('Error getting pending credits:', error);
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

