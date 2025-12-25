# SuperAdmin Rolü Ayarlama Rehberi

Firebase Authentication'da giriş yaptığınız kullanıcıya SuperAdmin rolü vermek için aşağıdaki yöntemlerden birini kullanabilirsiniz.

## Yöntem 1: Browser Console'dan (En Hızlı)

1. **Giriş yapın** - Firebase Authentication ile giriş yapın
2. **Browser Console'u açın** - F12 veya Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows)
3. **Aşağıdaki kodu yapıştırın ve Enter'a basın:**

```javascript
// Import gerekli fonksiyonlar
import { updateUser } from './services/userService';
import { auth } from './config/firebase';

// Mevcut kullanıcının rolünü superadmin yap
if (auth.currentUser) {
  updateUser(auth.currentUser.uid, { role: 'superadmin' })
    .then(() => {
      console.log('✅ Rol başarıyla superadmin olarak ayarlandı!');
      console.log('🔄 Sayfayı yenileyin (F5)');
      window.location.reload();
    })
    .catch(err => {
      console.error('❌ Hata:', err);
    });
} else {
  console.log('❌ Lütfen önce giriş yapın');
}
```

**Not:** Eğer import çalışmazsa, aşağıdaki alternatif yöntemi kullanın.

## Yöntem 2: Firebase Console'dan (Manuel)

1. **Firebase Console'a gidin:** https://console.firebase.google.com
2. **Projenizi seçin:** "My-kibris"
3. **Firestore Database'e gidin**
4. **`users` collection'ını açın**
5. **Kullanıcınızın UID'sini bulun:**
   - Authentication → Users bölümünden giriş yaptığınız kullanıcının UID'sini kopyalayın
6. **Firestore'da:**
   - `users` collection'ında UID ile document oluşturun (yoksa)
   - Veya mevcut document'i düzenleyin
   - Şu alanları ekleyin/güncelleyin:
     ```json
     {
       "email": "your-email@example.com",
       "username": "your-username",
       "role": "superadmin",
       "balance": 0,
       "credit": 0,
       "isBanned": false
     }
     ```

## Yöntem 3: SuperAdmin Panel'den (Eğer başka bir SuperAdmin varsa)

Eğer başka bir SuperAdmin hesabınız varsa:
1. O hesapla giriş yapın
2. `/superadmin` sayfasına gidin
3. "Mevcut Kullanıcı için Firestore Kaydı Oluştur" butonuna tıklayın
4. Formu doldurun:
   - E-posta: Kendi e-postanız
   - Şifre: Kendi şifreniz
   - Rol: superadmin
5. "Oluştur" butonuna tıklayın

## Yöntem 4: Geçici Admin Script (En Kolay)

Aşağıdaki kodu browser console'a yapıştırın:

```javascript
// Firebase'i import et
const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
const { getFirestore, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

// Firebase config (env.js'den alın)
const firebaseConfig = {
  apiKey: "AIzaSyCQRESr4sjx0X1lbX7uxVX3SpPBtU3Iahk",
  authDomain: "my-kibris.firebaseapp.com",
  projectId: "my-kibris",
  storageBucket: "my-kibris.firebaseapp.com",
  messagingSenderId: "142431125566",
  appId: "1:142431125566:web:89dfc357ffad71f91b516f"
};

const auth = getAuth();
const db = getFirestore();

// Mevcut kullanıcının UID'sini al
const currentUser = auth.currentUser;
if (currentUser) {
  const userRef = doc(db, 'users', currentUser.uid);
  await updateDoc(userRef, { role: 'superadmin' });
  console.log('✅ Rol superadmin olarak ayarlandı! Sayfayı yenileyin.');
  window.location.reload();
} else {
  console.log('❌ Lütfen önce giriş yapın');
}
```

## Kontrol

Rolü ayarladıktan sonra:
1. Sayfayı yenileyin (F5)
2. `/superadmin` sayfasına gidin
3. Artık SuperAdmin paneline erişebilmelisiniz

## Sorun Giderme

- **"Kullanıcı bulunamadı" hatası:** Firestore'da `users` collection'ında kullanıcı document'i yok. Önce document oluşturun.
- **"Permission denied" hatası:** Firestore security rules'ı kontrol edin.
- **Rol ayarlandı ama hala erişim yok:** Sayfayı yenileyin ve tekrar giriş yapın.

