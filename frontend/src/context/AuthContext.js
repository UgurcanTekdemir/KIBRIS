import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserById, createUser, updateUser } from '../services/userService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Get user data from Firestore
          const userData = await getUserById(firebaseUser.uid);
          
          if (userData) {
            // Check if user is banned
            if (userData.isBanned) {
              await firebaseSignOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }
            
            // Merge Firebase user with Firestore user data
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              ...userData,
            });
          } else {
            // User doesn't exist in Firestore, sign them out
            await firebaseSignOut(auth);
            setUser(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Register new user
   * All new registrations are automatically set as 'player' role
   */
  const register = async (email, password, username, role = 'player', parentId = null) => {
    try {
      // Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Create user document in Firestore
      // IMPORTANT: All new registrations are always 'player' role
      // Role changes can only be done by SuperAdmin from the panel
      const userData = {
        email,
        username,
        role: 'player', // Force 'player' role for all new registrations
        parentId: null, // New registrations don't have parentId initially
        balance: 0,
        credit: 0,
        isBanned: false,
      };

      await createUser(firebaseUser.uid, userData);

      return { 
        success: true, 
        user: { id: firebaseUser.uid, ...userData } 
      };
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Kayıt sırasında bir hata oluştu';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Bu e-posta adresi zaten kullanılıyor';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Şifre çok zayıf. En az 6 karakter olmalıdır';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Login user
   */
  const login = async (email, password) => {
    try {
      console.log('🔐 Login attempt:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log('✅ Firebase auth success, UID:', firebaseUser.uid);

      // Get user data from Firestore
      console.log('📖 Fetching user data from Firestore...');
      const userData = await getUserById(firebaseUser.uid);
      console.log('📖 Firestore user data:', userData);
      
      if (!userData) {
        console.error('❌ User not found in Firestore');
        await firebaseSignOut(auth);
        return { success: false, error: 'Kullanıcı bulunamadı. Lütfen Firebase Console\'da users collection\'ında kullanıcı verilerinizin olduğundan emin olun.' };
      }

      // Check if user is banned
      if (userData.isBanned) {
        console.error('❌ User is banned');
        await firebaseSignOut(auth);
        return { success: false, error: 'Hesabınız yasaklanmış. Lütfen yönetici ile iletişime geçin.' };
      }

      console.log('✅ Login successful');
      // User data will be set by onAuthStateChanged listener
      return { success: true };
    } catch (error) {
      console.error('❌ Login error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      let errorMessage = 'Giriş yapılırken bir hata oluştu';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Kullanıcı bulunamadı';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Yanlış şifre';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Ağ hatası. İnternet bağlantınızı kontrol edin';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  /**
   * Update user balance
   */
  const updateBalance = async (amount) => {
    if (user && user.id) {
      try {
        const currentBalance = user.balance || 0;
        const newBalance = currentBalance + amount;
        
        await updateUser(user.id, { balance: newBalance });
        
        // Update local user state
        setUser({ ...user, balance: newBalance });
      } catch (error) {
        console.error('Error updating balance:', error);
        throw error;
      }
    }
  };

  /**
   * Refresh user data from Firestore
   */
  const refreshUser = async () => {
    if (firebaseUser) {
      try {
        const userData = await getUserById(firebaseUser.uid);
        if (userData) {
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email,
            ...userData,
          });
        }
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register,
      logout, 
      loading, 
      updateBalance,
      refreshUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
