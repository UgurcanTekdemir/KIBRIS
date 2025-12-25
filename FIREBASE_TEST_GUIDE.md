# Firebase Entegrasyonu Test Rehberi

## 🚀 Hızlı Başlangıç

### 1. Frontend'i Başlatın

```bash
cd frontend
npm start
```

Frontend `http://localhost:3000` adresinde çalışacaktır.

### 2. Firebase Console'da Yapılması Gerekenler

#### a. Firestore Database Oluşturma
1. Firebase Console'a gidin: https://console.firebase.google.com
2. Projenizi seçin (my-kibris)
3. Sol menüden "Firestore Database" seçin
4. "Create database" butonuna tıklayın
5. Production mode seçin (Security rules'ı sonra düzenleyeceğiz)
6. Location seçin (europe-west1 veya en yakın lokasyon)

#### b. Security Rules'ı Deploy Etme
1. Firestore Database sayfasında "Rules" sekmesine gidin
2. `firestore.rules` dosyasının içeriğini kopyalayın ve yapıştırın
3. "Publish" butonuna tıklayın

**Alternatif:** Firebase CLI ile:
```bash
firebase deploy --only firestore:rules
```

#### c. Authentication'ı Etkinleştirme
1. Sol menüden "Authentication" seçin
2. "Get started" butonuna tıklayın
3. "Sign-in method" sekmesine gidin
4. "Email/Password" provider'ını etkinleştirin

### 3. İlk Kullanıcı Oluşturma

#### Superadmin Oluşturma (Firebase Console'dan)
1. Authentication > Users > "Add user"
2. Email ve password girin
3. Firestore'da `users/{userId}` collection'ına şu veriyi ekleyin:

```javascript
{
  email: "admin@example.com",
  username: "superadmin",
  role: "superadmin",
  balance: 0,
  credit: 0,
  isBanned: false,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Not:** `createdAt` ve `updatedAt` için Firebase Timestamp kullanın.

#### Agent Oluşturma
1. Uygulamada Register sayfasından email/password ile kayıt olun
2. Firestore'da `users/{userId}` document'ını bulun
3. `role: "agent"` ve `parentId: "{superadminUserId}"` ekleyin

#### Player Oluşturma
1. Register sayfasından normal kayıt olun (varsayılan role: "player")
2. Agent panelinden kredi ekleyin

### 4. Test Senaryoları

#### Test 1: Kullanıcı Kaydı
1. `http://localhost:3000/register` adresine gidin
2. Email, username, password girin
3. "Hesap Oluştur" butonuna tıklayın
4. Firebase Console > Authentication'da yeni kullanıcıyı kontrol edin
5. Firestore > users collection'ında yeni document'ı kontrol edin

#### Test 2: Login
1. `http://localhost:3000/login` adresine gidin
2. Kayıt olduğunuz email ve password ile giriş yapın
3. Ana sayfaya yönlendirilmelisiniz

#### Test 3: Kredi Ekleme (Agent/Superadmin)
1. Agent veya Superadmin olarak giriş yapın
2. Agent Panel veya Superadmin Panel'e gidin
3. Bir oyuncuya kredi ekleyin
4. Firestore'da:
   - `users/{userId}` document'ında `credit` ve `balance` artmalı
   - `credit_history` collection'ında yeni bir kayıt oluşmalı
   - `transactions` collection'ında yeni bir transaction olmalı

#### Test 4: Kupon Oluşturma
1. Player olarak giriş yapın
2. Ana sayfadan bir maç seçin ve bahis yapın
3. Kupon sayfasına gidin (`/betslip`)
4. Bahis miktarını girin ve "Kupon Oluştur" butonuna tıklayın
5. Firestore'da:
   - `coupons` collection'ında yeni bir kupon oluşmalı
   - `users/{userId}` document'ında `balance` azalmalı
   - `transactions` collection'ında bet transaction'ı oluşmalı

#### Test 5: Kuponları Görüntüleme
1. `/coupons` sayfasına gidin
2. Oluşturduğunuz kuponları görüntüleyin

### 5. Bilinen Sorunlar ve Çözümler

#### Sorun: "Firebase: Error (auth/user-not-found)"
- **Çözüm:** Kullanıcı Firestore'da yoksa, Authentication'da olsa bile giriş yapamaz. Firestore'da `users/{userId}` document'ını oluşturun.

#### Sorun: "Permission denied" hatası
- **Çözüm:** Firestore Security Rules'ı deploy edin (`firestore.rules` dosyası)

#### Sorun: CORS hatası
- **Çözüm:** Backend'de `CORS_ORIGINS` environment variable'ını kontrol edin

### 6. Environment Variables

Frontend `.env.local` dosyası (oluşturmanız gerekebilir):

```env
REACT_APP_FIREBASE_API_KEY=AIzaSyAbt5TMnnoebYDFOLEhWeh6Q_mA1P1QdFk
REACT_APP_FIREBASE_AUTH_DOMAIN=my-kibris.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=my-kibris
REACT_APP_FIREBASE_STORAGE_BUCKET=my-kibris.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=142431125566
REACT_APP_FIREBASE_APP_ID=1:142431125566:web:89dfc357ffad71f91b516f
REACT_APP_API_URL=http://localhost:8000
```

### 7. Panel Erişim Route'ları

- Superadmin Panel: `http://localhost:3000/superadmin`
- Agent Panel: `http://localhost:3000/agent`
- Player Panel: `http://localhost:3000/player`
- Kuponlar: `http://localhost:3000/coupons`
- Kupon Oluştur: `http://localhost:3000/betslip`

### 8. Önemli Notlar

1. **Firestore Security Rules:** Mutlaka deploy edin, aksi takdirde tüm istekler reddedilir
2. **İlk Superadmin:** Firebase Console'dan manuel oluşturmanız gerekebilir
3. **Kupon Settlement:** Şu an otomatik değil, manuel olarak `couponService.settleWinningCoupon()` veya `couponService.settleLosingCoupon()` fonksiyonlarını çağırabilirsiniz
4. **Backend:** Backend çalışıyor olmalı (maç verileri için)

### 9. Test Checklist

- [ ] Firebase Authentication çalışıyor
- [ ] Kullanıcı kaydı Firestore'a yazılıyor
- [ ] Login çalışıyor
- [ ] Superadmin panel erişilebilir
- [ ] Agent panel erişilebilir
- [ ] Player panel erişilebilir
- [ ] Kredi ekleme çalışıyor
- [ ] Kupon oluşturma çalışıyor
- [ ] Kuponlar görüntülenebiliyor
- [ ] Transactions kaydediliyor
- [ ] Security Rules çalışıyor (sadece yetkili kullanıcılar erişebiliyor)

