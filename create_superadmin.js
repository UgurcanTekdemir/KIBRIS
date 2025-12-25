/**
 * Firebase Admin SDK ile Süperadmin Kullanıcısı Oluşturma Scripti
 * 
 * Kullanım:
 * 1. Firebase Console > Authentication > Add user ile kullanıcı oluşturun
 * 2. UID'yi kopyalayın
 * 3. Bu scripti çalıştırın: node create_superadmin.js [UID] [email] [username]
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Firebase Admin SDK'yı initialize et
// Not: Service account key dosyası gerekli veya Application Default Credentials kullanılabilir
if (!admin.apps.length) {
  try {
    // Application Default Credentials kullan (gcloud auth application-default login ile)
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'my-kibris'
    });
  } catch (error) {
    console.error('Firebase Admin SDK initialize edilemedi:', error.message);
    console.log('\nAlternatif: Firebase Console üzerinden manuel ekleme yapın.');
    console.log('Detaylar için FIREBASE_MANUAL_USER_ADD.md dosyasına bakın.');
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

async function createSuperadmin() {
  console.log('🔐 Süperadmin Kullanıcısı Oluşturma\n');
  
  // UID'yi al
  const uid = process.argv[2] || await question('Firebase Authentication UID: ');
  if (!uid) {
    console.error('❌ UID gerekli!');
    rl.close();
    process.exit(1);
  }

  // Email'i al
  const email = process.argv[3] || await question('Email: ');
  if (!email) {
    console.error('❌ Email gerekli!');
    rl.close();
    process.exit(1);
  }

  // Username'i al
  const username = process.argv[4] || await question('Username: ');
  if (!username) {
    console.error('❌ Username gerekli!');
    rl.close();
    process.exit(1);
  }

  try {
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
    
    console.log('\n✅ Süperadmin başarıyla oluşturuldu!');
    console.log(`   UID: ${uid}`);
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${username}`);
    console.log(`   Role: superadmin`);
    
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    rl.close();
    process.exit(1);
  }
}

createSuperadmin();

