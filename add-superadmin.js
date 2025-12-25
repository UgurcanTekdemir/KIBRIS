/**
 * Firebase Firestore'a Süperadmin Ekleme Scripti
 * 
 * Kullanım:
 * node add-superadmin.js <UID> <email> <username>
 * 
 * Örnek:
 * node add-superadmin.js abc123 admin@test.com superadmin
 */

const admin = require('firebase-admin');

// Firebase Admin SDK'yı initialize et
if (!admin.apps.length) {
  try {
    // Önce service account key dosyasını dene
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (serviceAccountPath) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'my-kibris'
      });
      console.log('✅ Service account key ile initialize edildi');
    } else {
      // Application Default Credentials dene
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'my-kibris'
      });
      console.log('✅ Application Default Credentials ile initialize edildi');
    }
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialize edilemedi:', error.message);
    console.log('\n💡 Çözüm:');
    console.log('1. Firebase Console > Project Settings > Service Accounts');
    console.log('2. "Generate new private key" butonuna tıklayın');
    console.log('3. JSON dosyasını indirin');
    console.log('4. Environment variable olarak ayarlayın:');
    console.log('   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"');
    console.log('\nVeya Firebase Console üzerinden manuel ekleme yapın.');
    console.log('Detaylar için ADD_SUPERADMIN_GUIDE.md dosyasına bakın.');
    process.exit(1);
  }
}

const db = admin.firestore();

async function addSuperadmin() {
  // Argümanları al
  const uid = process.argv[2];
  const email = process.argv[3];
  const username = process.argv[4];

  if (!uid || !email || !username) {
    console.error('❌ Kullanım: node add-superadmin.js <UID> <email> <username>');
    console.error('\nÖrnek:');
    console.error('node add-superadmin.js abc123def456 admin@test.com superadmin');
    console.error('\n💡 UID\'yi Firebase Console > Authentication > Users\'dan kopyalayın');
    process.exit(1);
  }

  try {
    console.log('\n🔐 Süperadmin ekleniyor...\n');
    console.log(`UID: ${uid}`);
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}\n`);

    // Firestore'da kullanıcı document'ı oluştur
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
      console.error('Firebase Console üzerinden manuel ekleme yapın veya');
      console.error('Security Rules\'ı güncelleyin.');
    }
    process.exit(1);
  }
}

addSuperadmin();

