/**
 * Transaction Service
 * Handles transaction logging
 */
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const TRANSACTIONS_COLLECTION = 'transactions';

/**
 * Create a transaction record
 */
export const createTransaction = async (transactionData) => {
  try {
    const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), {
      ...transactionData,
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, ...transactionData };
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
};

/**
 * Get transactions for a user
 */
export const getUserTransactions = async (userId, limit = 100) => {
  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
  } catch (error) {
    // If index is building, try without orderBy as fallback
    if (error.code === 'failed-precondition' || error.message.includes('index')) {
      console.warn('Index is building, fetching transactions without orderBy...');
      try {
        const q = query(
          collection(db, TRANSACTIONS_COLLECTION),
          where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        // Sort manually
        transactions.sort((a, b) => {
          const aDate = a.createdAt?.toDate?.() || a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
          const bDate = b.createdAt?.toDate?.() || b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
          return bDate - aDate;
        });
        return transactions.slice(0, limit);
      } catch (fallbackError) {
        console.error('Error getting user transactions (fallback):', fallbackError);
        throw error; // Throw original error
      }
    }
    console.error('Error getting user transactions:', error);
    throw error;
  }
};

/**
 * Get transactions for an agent's players
 */
export const getAgentTransactions = async (agentId, limit = 200) => {
  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('agentId', '==', agentId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
  } catch (error) {
    // If index is building, try without orderBy as fallback
    if (error.code === 'failed-precondition' || error.message.includes('index')) {
      console.warn('Index is building, fetching agent transactions without orderBy...');
      try {
        const q = query(
          collection(db, TRANSACTIONS_COLLECTION),
          where('agentId', '==', agentId)
        );
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        // Sort manually
        transactions.sort((a, b) => {
          const aDate = a.createdAt?.toDate?.() || a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
          const bDate = b.createdAt?.toDate?.() || b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
          return bDate - aDate;
        });
        return transactions.slice(0, limit);
      } catch (fallbackError) {
        console.error('Error getting agent transactions (fallback):', fallbackError);
        throw error; // Throw original error
      }
    }
    console.error('Error getting agent transactions:', error);
    throw error;
  }
};

/**
 * Get all transactions (for superadmin)
 */
export const getAllTransactions = async (limit = 500) => {
  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
  } catch (error) {
    console.error('Error getting all transactions:', error);
    throw error;
  }
};

