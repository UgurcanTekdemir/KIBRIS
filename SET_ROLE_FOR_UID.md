# Belirli UID'ye SuperAdmin Rolü Verme

UID: `3YrwSGjZAHXMgI0j5zg4pswuvJe2` için superadmin rolü ayarlama rehberi.

## Yöntem 1: Browser Console'dan (En Hızlı)

1. **Uygulamaya giriş yapın** (herhangi bir kullanıcı ile)
2. **Browser Console'u açın** (F12)
3. **Aşağıdaki kodu yapıştırın:**

```javascript
// Import gerekli fonksiyonlar
const { setUserRoleByUID } = await import('./utils/setUserRoleByUID');

// UID'ye superadmin rolü ver
const result = await setUserRoleByUID('3YrwSGjZAHXMgI0j5zg4pswuvJe2', 'superadmin');

if (result.success) {
  console.log('✅', result.message);
} else {
  console.error('❌', result.message);
}
```

## Yöntem 2: Firebase Console'dan (Manuel)

1. **Firebase Console'a gidin:** https://console.firebase.google.com
2. **Projenizi seçin:** "My-kibris"
3. **Firestore Database'e gidin**
4. **`users` collection'ını açın**
5. **Yeni document oluşturun:**
   - **Document ID:** `3YrwSGjZAHXMgI0j5zg4pswuvJe2` (UID ile aynı)
   - **Alanları ekleyin:**
     ```
     email: "kullanici@example.com" (Authentication'dan kontrol edin)
     username: "admin" (veya istediğiniz kullanıcı adı)
     role: "superadmin"
     balance: 0
     credit: 0
     isBanned: false
     createdAt: [Timestamp - şu anki zaman]
     updatedAt: [Timestamp - şu anki zaman]
     ```
6. **Save** butonuna tıklayın

## Yöntem 3: Doğrudan Firebase SDK ile

Browser Console'a yapıştırın:

```javascript
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

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

const uid = '3YrwSGjZAHXMgI0j5zg4pswuvJe2';
const userRef = doc(db, 'users', uid);

await setDoc(userRef, {
  email: 'user@example.com', // Authentication'dan kontrol edin
  username: 'admin',
  role: 'superadmin',
  balance: 999999,
  credit: 0,
  isBanned: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}, { merge: true });

console.log('✅ SuperAdmin rolü ayarlandı!');
```

## Kontrol

Rolün ayarlandığını kontrol etmek için:

```javascript
import { getUserById } from './services/userService';

const userData = await getUserById('3YrwSGjZAHXMgI0j5zg4pswuvJe2');
console.log('Kullanıcı verileri:', userData);
console.log('Rol:', userData?.role);
```

## Not

- E-posta adresini Firebase Console → Authentication → Users'dan kontrol edin
- UID ile e-posta eşleşmesi için Authentication'daki kullanıcıyı kontrol edin

