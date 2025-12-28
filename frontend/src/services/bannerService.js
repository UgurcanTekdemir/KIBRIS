/**
 * Banner Service
 * Handles banner operations with Firestore
 */
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc,
  getDocs, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const BANNERS_COLLECTION = 'banners';

/**
 * Get all banners
 * @param {boolean} activeOnly - Return only active banners
 * @returns {Promise<Array>} List of banners
 */
export const getBanners = async (activeOnly = false) => {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // Check if db is a mock object (development mode with Firebase errors)
    if (typeof db.collection !== 'function' || (db.collection.toString && db.collection.toString().includes('Firebase not initialized'))) {
      console.warn('⚠️ Firebase is not properly initialized. Returning empty banners array.');
      return [];
    }
    
    let q;
    if (activeOnly) {
      q = query(
        collection(db, BANNERS_COLLECTION),
        where('is_active', '==', true),
        orderBy('order', 'asc')
      );
    } else {
      q = query(
        collection(db, BANNERS_COLLECTION),
        orderBy('order', 'asc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching banners:', error);
    // In development, return empty array instead of throwing
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Returning empty banners array due to error (development mode)');
      return [];
    }
    throw new Error('Failed to fetch banners');
  }
};

/**
 * Get a single banner by ID
 * @param {string} bannerId - Banner ID
 * @returns {Promise<Object|null>} Banner data or null if not found
 */
export const getBanner = async (bannerId) => {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // Check if db is a mock object (development mode with Firebase errors)
    if (typeof db.collection !== 'function' || (db.collection.toString && db.collection.toString().includes('Firebase not initialized'))) {
      console.warn('⚠️ Firebase is not properly initialized. Returning null.');
      return null;
    }
    
    const docRef = doc(db, BANNERS_COLLECTION, bannerId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching banner:', error);
    // In development, return null instead of throwing
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Returning null due to error (development mode)');
      return null;
    }
    throw new Error('Failed to fetch banner');
  }
};

/**
 * Create a new banner
 * @param {Object} bannerData - Banner data
 * @returns {Promise<Object>} Created banner with ID
 */
export const createBanner = async (bannerData) => {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // Check if db is a mock object
    if (typeof db.collection !== 'function' || (db.collection.toString && db.collection.toString().includes('Firebase not initialized'))) {
      throw new Error('Firebase is not properly initialized');
    }
    
    const bannerDoc = {
      image_url: bannerData.image_url,
      title: bannerData.title || null,
      subtitle: bannerData.subtitle || null,
      link_url: bannerData.link_url || null,
      button_text: bannerData.button_text || null,
      is_active: bannerData.is_active !== undefined ? bannerData.is_active : true,
      order: bannerData.order || 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, BANNERS_COLLECTION), bannerDoc);
    return {
      id: docRef.id,
      ...bannerDoc
    };
  } catch (error) {
    console.error('Error creating banner:', error);
    throw new Error('Failed to create banner');
  }
};

/**
 * Update a banner
 * @param {string} bannerId - Banner ID
 * @param {Object} bannerData - Updated banner data
 * @returns {Promise<Object>} Updated banner
 */
export const updateBanner = async (bannerId, bannerData) => {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // Check if db is a mock object
    if (typeof db.collection !== 'function' || (db.collection.toString && db.collection.toString().includes('Firebase not initialized'))) {
      throw new Error('Firebase is not properly initialized');
    }
    
    const bannerRef = doc(db, BANNERS_COLLECTION, bannerId);
    
    const updateData = {
      updated_at: serverTimestamp()
    };
    
    if (bannerData.image_url !== undefined) updateData.image_url = bannerData.image_url;
    if (bannerData.title !== undefined) updateData.title = bannerData.title || null;
    if (bannerData.subtitle !== undefined) updateData.subtitle = bannerData.subtitle || null;
    if (bannerData.link_url !== undefined) updateData.link_url = bannerData.link_url || null;
    if (bannerData.button_text !== undefined) updateData.button_text = bannerData.button_text || null;
    if (bannerData.is_active !== undefined) updateData.is_active = bannerData.is_active;
    if (bannerData.order !== undefined) updateData.order = bannerData.order;
    
    await updateDoc(bannerRef, updateData);
    
    // Return updated banner
    const updatedDoc = await getDoc(bannerRef);
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };
  } catch (error) {
    console.error('Error updating banner:', error);
    throw new Error('Failed to update banner');
  }
};

/**
 * Delete a banner
 * @param {string} bannerId - Banner ID
 * @returns {Promise<void>}
 */
export const deleteBanner = async (bannerId) => {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // Check if db is a mock object
    if (typeof db.collection !== 'function' || (db.collection.toString && db.collection.toString().includes('Firebase not initialized'))) {
      throw new Error('Firebase is not properly initialized');
    }
    
    const bannerRef = doc(db, BANNERS_COLLECTION, bannerId);
    await deleteDoc(bannerRef);
  } catch (error) {
    console.error('Error deleting banner:', error);
    throw new Error('Failed to delete banner');
  }
};

