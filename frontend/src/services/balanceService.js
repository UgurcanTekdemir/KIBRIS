/**
 * Balance Service
 * Handles balance operations for superadmin and agents
 */
import { 
  collection,
  doc,
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

const TRANSACTIONS_COLLECTION = 'transactions';

/**
 * Add balance to user (instant transfer)
 */
export const addBalance = async (fromUserId, toUserId, amount, description = '') => {
  try {
    // Get both users
    const fromUser = await getUserById(fromUserId);
    const toUser = await getUserById(toUserId);

    if (!fromUser || !toUser) {
      throw new Error('User not found');
    }

    if (toUser.isBanned) {
      throw new Error('Cannot add balance to banned user');
    }

    // Validate balance flow
    if (fromUser.role === 'superadmin' && toUser.role !== 'agent' && toUser.role !== 'player') {
      throw new Error('Superadmin can only add balance to agents or players');
    }
    if (fromUser.role === 'agent' && toUser.role !== 'player') {
      throw new Error('Agent can only add balance to players');
    }
    if (fromUser.role === 'player') {
      throw new Error('Players cannot add balance');
    }

    // Validate parent relationship for agent->player
    if (fromUser.role === 'agent' && toUser.parentId !== fromUserId) {
      throw new Error('Invalid balance relationship');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Invalid amount');
    }

    // Update balances using batch
    const batch = writeBatch(db);
    const toUserRef = doc(db, 'users', toUserId);
    
    const currentBalance = toUser.balance || 0;
    const newBalance = currentBalance + amountNum;

    batch.update(toUserRef, {
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Create transaction record
    await createTransaction({
      userId: toUserId,
      agentId: fromUser.role === 'agent' ? fromUserId : (toUser.role === 'player' ? toUser.parentId : null),
      type: 'balance_add',
      amount: amountNum,
      description: description || `Bakiye eklendi - ${fromUser.username}`,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error('Error adding balance:', error);
    throw error;
  }
};

/**
 * Remove balance from user
 */
export const removeBalance = async (fromUserId, toUserId, amount, description = '') => {
  try {
    // Get both users
    const fromUser = await getUserById(fromUserId);
    const toUser = await getUserById(toUserId);

    if (!fromUser || !toUser) {
      throw new Error('User not found');
    }

    // Validate balance flow (same as add)
    if (fromUser.role === 'superadmin' && toUser.role !== 'agent' && toUser.role !== 'player') {
      throw new Error('Superadmin can only remove balance from agents or players');
    }
    if (fromUser.role === 'agent' && toUser.role !== 'player') {
      throw new Error('Agent can only remove balance from players');
    }
    if (fromUser.role === 'player') {
      throw new Error('Players cannot remove balance');
    }

    // Validate parent relationship for agent->player
    if (fromUser.role === 'agent' && toUser.parentId !== fromUserId) {
      throw new Error('Invalid balance relationship');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Invalid amount');
    }

    // Check if user has enough balance
    const currentBalance = toUser.balance || 0;
    if (currentBalance < amountNum) {
      throw new Error('Insufficient balance');
    }

    // Update balances using batch
    const batch = writeBatch(db);
    const toUserRef = doc(db, 'users', toUserId);
    
    const newBalance = currentBalance - amountNum;

    batch.update(toUserRef, {
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Create transaction record
    await createTransaction({
      userId: toUserId,
      agentId: fromUser.role === 'agent' ? fromUserId : (toUser.role === 'player' ? toUser.parentId : null),
      type: 'balance_remove',
      amount: -amountNum,
      description: description || `Bakiye çıkarıldı - ${fromUser.username}`,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error('Error removing balance:', error);
    throw error;
  }
};

/**
 * Get balance history sent by an agent/superadmin
 */
export const getSentBalanceHistory = async (fromUserId, limit = 100) => {
  try {
    // Get balance transactions where agentId matches fromUserId
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('agentId', '==', fromUserId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    // Filter for balance operations only
    const balanceTransactions = snapshot.docs
      .map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }))
      .filter(t => t.type === 'balance_add' || t.type === 'balance_remove')
      .slice(0, limit);
    
    return balanceTransactions;
  } catch (error) {
    // If index is building, try without orderBy as fallback
    if (error.code === 'failed-precondition' || error.message.includes('index')) {
      console.warn('Index is building, fetching balance history without orderBy...');
      try {
        const q = query(
          collection(db, TRANSACTIONS_COLLECTION),
          where('agentId', '==', fromUserId)
        );
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs
          .map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          }))
          .filter(t => t.type === 'balance_add' || t.type === 'balance_remove');
        
        // Sort manually
        transactions.sort((a, b) => {
          const aDate = a.createdAt?.toDate?.() || a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
          const bDate = b.createdAt?.toDate?.() || b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
          return bDate - aDate;
        });
        return transactions.slice(0, limit);
      } catch (fallbackError) {
        console.error('Error getting balance history (fallback):', fallbackError);
        throw error; // Throw original error
      }
    }
    console.error('Error getting balance history:', error);
    throw error;
  }
};

