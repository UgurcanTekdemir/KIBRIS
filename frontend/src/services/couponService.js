/**
 * Coupon Service
 * Handles coupon operations with Firestore
 */
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc,
  getDocs, 
  updateDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUserById, updateUser } from './userService';
import { createTransaction } from './transactionService';

const COUPONS_COLLECTION = 'coupons';

/**
 * Generate unique coupon ID
 */
const generateCouponId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KPN-${timestamp}-${random}`;
};

/**
 * Create a new coupon
 */
export const createCoupon = async (couponData) => {
  try {
    const { userId, agentId, selections, stake, totalOdds, potentialWin } = couponData;

    // Get user data
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isBanned) {
      throw new Error('Banned users cannot place bets');
    }

    // Check if user has enough balance
    const currentBalance = user.balance || 0;
    if (currentBalance < stake) {
      throw new Error('Yetersiz bakiye');
    }

    // Use batch for atomic operations
    const batch = writeBatch(db);

    // Create coupon document
    const couponRef = doc(collection(db, COUPONS_COLLECTION));
    const uniqueId = generateCouponId();
    batch.set(couponRef, {
      userId,
      agentId,
      selections,
      stake,
      totalOdds,
      potentialWin,
      status: 'pending',
      result: null,
      uniqueId,
      createdAt: serverTimestamp(),
      settledAt: null,
    });

    // Update user balance
    const userRef = doc(db, 'users', userId);
    const newBalance = currentBalance - stake;
    batch.update(userRef, {
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    // Commit batch
    await batch.commit();

    // Create transaction record (async, doesn't need to be in batch)
    await createTransaction({
      userId,
      agentId,
      type: 'bet',
      amount: -stake,
      description: `Kupon: ${uniqueId}`,
      relatedCouponId: couponRef.id,
    });

    return { 
      id: couponRef.id, 
      uniqueId,
      userId,
      agentId,
      selections,
      stake,
      totalOdds,
      potentialWin,
      status: 'pending',
    };
  } catch (error) {
    console.error('Error creating coupon:', error);
    throw error;
  }
};

/**
 * Get coupon by ID
 */
export const getCouponById = async (couponId) => {
  try {
    const couponDoc = await getDoc(doc(db, COUPONS_COLLECTION, couponId));
    if (couponDoc.exists()) {
      return { id: couponDoc.id, ...couponDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting coupon:', error);
    throw error;
  }
};

/**
 * Get coupons for a user
 */
export const getUserCoupons = async (userId, limit = 100) => {
  try {
    const q = query(
      collection(db, COUPONS_COLLECTION),
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
      console.warn('Index is building, fetching coupons without orderBy...');
      try {
        const q = query(
          collection(db, COUPONS_COLLECTION),
          where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const coupons = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        // Sort manually
        coupons.sort((a, b) => {
          const aDate = a.createdAt?.toDate?.() || a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
          const bDate = b.createdAt?.toDate?.() || b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
          return bDate - aDate;
        });
        return coupons.slice(0, limit);
      } catch (fallbackError) {
        console.error('Error getting user coupons (fallback):', fallbackError);
        throw error; // Throw original error
      }
    }
    console.error('Error getting user coupons:', error);
    throw error;
  }
};

/**
 * Get coupons for an agent's players
 */
export const getAgentCoupons = async (agentId, limit = 200) => {
  try {
    const q = query(
      collection(db, COUPONS_COLLECTION),
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
      console.warn('Index is building, fetching agent coupons without orderBy...');
      try {
        const q = query(
          collection(db, COUPONS_COLLECTION),
          where('agentId', '==', agentId)
        );
        const snapshot = await getDocs(q);
        const coupons = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        // Sort manually
        coupons.sort((a, b) => {
          const aDate = a.createdAt?.toDate?.() || a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
          const bDate = b.createdAt?.toDate?.() || b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
          return bDate - aDate;
        });
        return coupons.slice(0, limit);
      } catch (fallbackError) {
        console.error('Error getting agent coupons (fallback):', fallbackError);
        throw error; // Throw original error
      }
    }
    console.error('Error getting agent coupons:', error);
    throw error;
  }
};

/**
 * Get all coupons (for superadmin)
 */
export const getAllCoupons = async (limit = 500) => {
  try {
    const q = query(
      collection(db, COUPONS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
  } catch (error) {
    console.error('Error getting all coupons:', error);
    throw error;
  }
};

/**
 * Update coupon status (for settlement)
 */
export const updateCouponStatus = async (couponId, status, result = null) => {
  try {
    const couponRef = doc(db, COUPONS_COLLECTION, couponId);
    await updateDoc(couponRef, {
      status,
      result,
      settledAt: serverTimestamp(),
    });
    return { id: couponId, status, result };
  } catch (error) {
    console.error('Error updating coupon status:', error);
    throw error;
  }
};

/**
 * Settle winning coupon (distribute winnings and commission)
 */
export const settleWinningCoupon = async (couponId, commissionRate = 0.20) => {
  try {
    const coupon = await getCouponById(couponId);
    if (!coupon) {
      throw new Error('Coupon not found');
    }

    if (coupon.status !== 'pending') {
      throw new Error('Coupon already settled');
    }

    const { userId, agentId, stake, potentialWin } = coupon;

    // Calculate commission (20% of potential win)
    const commission = potentialWin * commissionRate;
    const netWin = potentialWin - commission;

    // Use batch for atomic operations
    const batch = writeBatch(db);

    // Get user and agent data
    const user = await getUserById(userId);
    const agent = agentId ? await getUserById(agentId) : null;

    // Update coupon status
    const couponRef = doc(db, COUPONS_COLLECTION, couponId);
    batch.update(couponRef, {
      status: 'won',
      result: 'win',
      settledAt: serverTimestamp(),
    });

    // Update player balance (add net win)
    const userRef = doc(db, 'users', userId);
    const newUserBalance = (user.balance || 0) + netWin;
    batch.update(userRef, {
      balance: newUserBalance,
      updatedAt: serverTimestamp(),
    });

    // Update agent balance (add commission)
    if (agent) {
      const agentRef = doc(db, 'users', agentId);
      const newAgentBalance = (agent.balance || 0) + commission;
      batch.update(agentRef, {
        balance: newAgentBalance,
        updatedAt: serverTimestamp(),
      });
    }

    // Commit batch
    await batch.commit();

    // Create transaction records (async)
    await Promise.all([
      createTransaction({
        userId,
        agentId,
        type: 'win',
        amount: netWin,
        description: `Kupon kazancı: ${coupon.uniqueId}`,
        relatedCouponId: couponId,
      }),
      agent && createTransaction({
        userId: agentId,
        agentId: null,
        type: 'commission',
        amount: commission,
        description: `Komisyon: ${coupon.uniqueId} (${userId})`,
        relatedCouponId: couponId,
      }),
    ].filter(Boolean));

    return { success: true, netWin, commission };
  } catch (error) {
    console.error('Error settling winning coupon:', error);
    throw error;
  }
};

/**
 * Settle losing coupon
 */
export const settleLosingCoupon = async (couponId) => {
  try {
    const coupon = await getCouponById(couponId);
    if (!coupon) {
      throw new Error('Coupon not found');
    }

    if (coupon.status !== 'pending') {
      throw new Error('Coupon already settled');
    }

    // Simply update status (no balance changes needed, stake was already deducted)
    await updateCouponStatus(couponId, 'lost', 'loss');

    return { success: true };
  } catch (error) {
    console.error('Error settling losing coupon:', error);
    throw error;
  }
};

