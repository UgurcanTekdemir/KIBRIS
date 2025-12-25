/**
 * Firebase Firestore'a Süperadmin Ekleme Scripti (İnteraktif)
 * 
 * Kullanım:
 * node add-superadmin-interactive.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

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
      console.log('✅ Service account key ile initialize edildi\n');
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'my-kibris'
      });
      console.log('✅ Application Default Credentials ile initialize edildi\n');
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
    process.exit(1);
  }
}

const db = admin.firestore();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function addSuperadmin() {
  console.log('🔐 Süperadmin Ekleme Scripti\n');
  console.log('📋 Önce Firebase Console\'da Authentication kullanıcısı oluşturun:');
  console.log('   1. https://console.firebase.google.com');
  console.log('   2. Authentication > Users > Add user');
  console.log('   3. Email ve Password girin');
  console.log('   4. UID\'yi kopyalayın\n');

  try {
    const uid = await question('Firebase Authentication UID: ');
    if (!uid || uid.trim() === '') {
      console.error('\n❌ UID gerekli!');
      rl.close();
      process.exit(1);
    }

    const email = await question('Email: ');
    if (!email || email.trim() === '') {
      console.error('\n❌ Email gerekli!');
      rl.close();
      process.exit(1);
    }

    const username = await question('Username (varsayılan: superadmin): ') || 'superadmin';

    console.log('\n🔐 Süperadmin ekleniyor...\n');

    const userData = {
      email: email.trim(),
      username: username.trim(),
      role: 'superadmin',
      balance: 0,
      credit: 0,
      isBanned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid.trim()).set(userData);
    
    console.log('✅ Süperadmin başarıyla eklendi!\n');
    console.log('📋 Eklenen bilgiler:');
    console.log(`   UID: ${uid.trim()}`);
    console.log(`   Email: ${email.trim()}`);
    console.log(`   Username: ${username.trim()}`);
    console.log(`   Role: superadmin`);
    console.log(`   Balance: 0`);
    console.log(`   Credit: 0`);
    console.log(`   Banned: false\n`);
    console.log('🎯 Şimdi http://localhost:3000/login adresinden giriş yapabilirsiniz!');
    
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    if (error.code === 'permission-denied') {
      console.error('\n💡 Firestore Security Rules izin vermiyor.');
      console.error('Firebase Console üzerinden manuel ekleme yapın veya');
      console.error('Security Rules\'ı güncelleyin.');
    }
    rl.close();
    process.exit(1);
  }
}

addSuperadmin();

