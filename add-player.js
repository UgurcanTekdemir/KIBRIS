/**
 * Player Ekleme Scripti
 * 
 * Kullanım:
 * node add-player.js <UID> <email> <username> <agentUID>
 * 
 * Örnek:
 * node add-player.js abc123 player@test.com player1 <agent-uid>
 */

const admin = require('firebase-admin');

// Firebase Admin SDK'yı initialize et
if (!admin.apps.length) {
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './firebase-service-account-key.json';
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'my-kibris'
    });
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialize edilemedi:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function addPlayer() {
  const uid = process.argv[2];
  const email = process.argv[3];
  const username = process.argv[4];
  const parentId = process.argv[5]; // Agent UID

  if (!uid || !email || !username || !parentId) {
    console.error('❌ Kullanım: node add-player.js <UID> <email> <username> <agentUID>');
    console.error('\nÖrnek:');
    console.error('node add-player.js abc123 player@test.com player1 <agent-uid>');
    console.error('\n💡 Agent UID\'sini bilmiyorsanız, önce agent\'i ekleyin ve UID\'sini alın.');
    process.exit(1);
  }

  try {
    console.log('\n🔐 Player ekleniyor...\n');
    console.log(`UID: ${uid}`);
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Parent ID (Agent): ${parentId}\n`);

    const userData = {
      email: email,
      username: username,
      role: 'player',
      parentId: parentId,
      balance: 0,
      credit: 0,
      isBanned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(userData);
    
    console.log('✅ Player başarıyla eklendi!\n');
    console.log('📋 Eklenen bilgiler:');
    console.log(`   UID: ${uid}`);
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${username}`);
    console.log(`   Role: player`);
    console.log(`   Parent ID (Agent): ${parentId}`);
    console.log(`   Balance: 0`);
    console.log(`   Credit: 0`);
    console.log(`   Banned: false\n`);
    console.log('🎯 Şimdi http://localhost:3000/login adresinden giriş yapabilirsiniz!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    process.exit(1);
  }
}

addPlayer();

