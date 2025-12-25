/**
 * Süperadmin Ekleme - Direkt Çalıştırma
 */

const admin = require('firebase-admin');

// Firebase Admin SDK'yı initialize et
if (!admin.apps.length) {
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (serviceAccountPath) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'my-kibris'
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'my-kibris'
      });
    }
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialize edilemedi:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function addSuperadmin() {
  const uid = '456UK2q0sjOfRUTcROIXWhmvHAM2';
  
  // Firebase Authentication'dan kullanıcı bilgilerini al
  let email = 'admin@my-kibris.com'; // Varsayılan, Firebase'den alınacak
  let username = 'superadmin'; // Varsayılan

  try {
    // Firebase Authentication'dan email'i al
    const userRecord = await admin.auth().getUser(uid);
    email = userRecord.email || email;
    username = userRecord.displayName || userRecord.email?.split('@')[0] || username;
    
    console.log('📧 Firebase Authentication\'dan alınan bilgiler:');
    console.log(`   Email: ${email}`);
  } catch (error) {
    console.log('⚠️  Firebase Authentication\'dan email alınamadı, varsayılan kullanılıyor');
  }

  try {
    console.log('\n🔐 Süperadmin ekleniyor...\n');
    console.log(`UID: ${uid}`);
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}\n`);

    const userData = {
      email: email,
      username: username,
      role: 'superadmin',
      balance: 0,
      credit: 0,
      isBanned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(userData);
    
    console.log('✅ Süperadmin başarıyla eklendi!\n');
    console.log('📋 Eklenen bilgiler:');
    console.log(`   UID: ${uid}`);
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${username}`);
    console.log(`   Role: superadmin`);
    console.log(`   Balance: 0`);
    console.log(`   Credit: 0`);
    console.log(`   Banned: false\n`);
    console.log('🎯 Şimdi http://localhost:3000/login adresinden giriş yapabilirsiniz!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    if (error.code === 'permission-denied') {
      console.error('\n💡 Firestore Security Rules izin vermiyor.');
      console.error('Security Rules\'ı güncelleyin veya Firebase Console üzerinden manuel ekleme yapın.');
    }
    process.exit(1);
  }
}

addSuperadmin();

