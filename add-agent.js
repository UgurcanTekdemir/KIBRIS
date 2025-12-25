/**
 * Agent Ekleme Scripti
 * 
 * Kullanım:
 * node add-agent.js <UID> <email> <username>
 * 
 * Örnek:
 * node add-agent.js abc123 agent@test.com agent1
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

async function addAgent() {
  const uid = process.argv[2];
  const email = process.argv[3];
  const username = process.argv[4];
  const parentId = process.argv[5] || '456UK2q0sjOfRUTcROIXWhmvHAM2'; // Süperadmin UID

  if (!uid || !email || !username) {
    console.error('❌ Kullanım: node add-agent.js <UID> <email> <username> [parentId]');
    console.error('\nÖrnek:');
    console.error('node add-agent.js abc123 agent@test.com agent1');
    process.exit(1);
  }

  try {
    console.log('\n🔐 Agent ekleniyor...\n');
    console.log(`UID: ${uid}`);
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Parent ID (Superadmin): ${parentId}\n`);

    const userData = {
      email: email,
      username: username,
      role: 'agent',
      parentId: parentId,
      balance: 0,
      credit: 0,
      isBanned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(userData);
    
    console.log('✅ Agent başarıyla eklendi!\n');
    console.log('📋 Eklenen bilgiler:');
    console.log(`   UID: ${uid}`);
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${username}`);
    console.log(`   Role: agent`);
    console.log(`   Parent ID: ${parentId}`);
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

addAgent();

