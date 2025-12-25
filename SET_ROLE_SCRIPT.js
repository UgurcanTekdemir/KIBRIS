/**
 * Set SuperAdmin Role for UID: 3YrwSGjZAHXMgI0j5zg4pswuvJe2
 * 
 * Copy and paste this code into browser console (F12) while logged into the app
 */

(async () => {
  try {
    // Import Firebase functions
    const { getFirestore, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    
    // Firebase config
    const firebaseConfig = {
      apiKey: "AIzaSyCQRESr4sjx0X1lbX7uxVX3SpPBtU3Iahk",
      authDomain: "my-kibris.firebaseapp.com",
      projectId: "my-kibris",
      storageBucket: "my-kibris.firebaseapp.com",
      messagingSenderId: "142431125566",
      appId: "1:142431125566:web:89dfc357ffad71f91b516f"
    };
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Target UID
    const targetUID = '3YrwSGjZAHXMgI0j5zg4pswuvJe2';
    
    // Get user email from Authentication (optional - you can set it manually)
    // For now, we'll use a placeholder email
    const userRef = doc(db, 'users', targetUID);
    
    await setDoc(userRef, {
      email: 'admin@my-kibris.com', // Update this with actual email from Authentication
      username: 'superadmin',
      role: 'superadmin',
      balance: 999999,
      credit: 0,
      isBanned: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('✅ SuperAdmin rolü başarıyla ayarlandı!');
    console.log('📧 E-posta adresini Firebase Console → Authentication → Users\'dan kontrol edip güncelleyin');
    console.log('🔄 Sayfayı yenileyin (F5)');
    
  } catch (error) {
    console.error('❌ Hata:', error);
    console.error('Hata detayı:', error.message);
  }
})();

