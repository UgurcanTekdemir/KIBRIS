# Süperadmin Ekleme Rehberi

## 🎯 Hızlı Yöntem: Firebase Console Üzerinden

### Adım 1: Authentication'da Kullanıcı Oluştur

1. Firebase Console'a gidin: https://console.firebase.google.com
2. Projenizi seçin: **my-kibris**
3. Sol menüden **Authentication** > **Users** seçin
4. **Add user** butonuna tıklayın
5. Bilgileri girin:
   - **Email:** `admin@my-kibris.com` (veya istediğiniz email)
   - **Password:** Güçlü bir şifre (en az 6 karakter)
6. **Add user** butonuna tıklayın
7. **UID'yi kopyalayın** (User ID kolonunda)

### Adım 2: Firestore'da Kullanıcı Verisini Oluştur

1. Firebase Console'da **Firestore Database** > **Data** sekmesine gidin
2. **Start collection** butonuna tıklayın (eğer `users` collection'ı yoksa)
   - Collection ID: `users`
3. **Add document** butonuna tıklayın
   - **Document ID:** Kopyaladığınız UID'yi yapıştırın
4. Aşağıdaki field'ları ekleyin:

| Field | Type | Value |
|-------|------|-------|
| `email` | string | admin@my-kibris.com |
| `username` | string | superadmin |
| `role` | string | superadmin |
| `balance` | number | 0 |
| `credit` | number | 0 |
| `isBanned` | boolean | false |
| `createdAt` | timestamp | (Set timestamp butonuna tıklayın) |
| `updatedAt` | timestamp | (Set timestamp butonuna tıklayın) |

5. **Save** butonuna tıklayın

### Adım 3: Test Edin

1. Uygulamaya gidin: http://localhost:3000/login
2. Oluşturduğunuz email ve password ile giriş yapın
3. `/superadmin` sayfasına yönlendirilmelisiniz

---

## 🔧 Alternatif: Firebase CLI ile (Gelişmiş)

### Önkoşullar

Firebase Admin SDK için service account key gerekli veya Application Default Credentials kullanılabilir.

### Service Account Key Alma

1. Firebase Console > Project Settings > Service Accounts
2. **Generate new private key** butonuna tıklayın
3. JSON dosyasını indirin ve güvenli bir yere kaydedin

### Script ile Oluşturma

```bash
# Service account key ile
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
node create_superadmin.js [UID] [email] [username]
```

---

## 📋 Örnek Süperadmin Bilgileri

```
Email: admin@my-kibris.com
Password: Admin123!
Username: superadmin
Role: superadmin
```

---

## ✅ Kontrol Listesi

- [ ] Firebase Authentication'da kullanıcı oluşturuldu
- [ ] UID kopyalandı
- [ ] Firestore'da `users/{uid}` document'ı oluşturuldu
- [ ] Tüm gerekli field'lar eklendi (email, username, role, balance, credit, isBanned, createdAt, updatedAt)
- [ ] `role` field'ı `superadmin` olarak ayarlandı
- [ ] Login test edildi
- [ ] `/superadmin` sayfasına erişilebildi

---

## 🚨 Sorun Giderme

### "Kullanıcı bulunamadı" hatası
- Firestore'da `users/{uid}` document'ının olduğundan emin olun
- UID'nin tam olarak eşleştiğinden emin olun

### "Bu sayfaya erişim yetkiniz yok" hatası
- Firestore'daki `role` field'ını kontrol edin (`superadmin` olmalı)

### Login yapamıyorum
- Authentication'da kullanıcının olduğundan emin olun
- Firestore'da `isBanned: false` olduğundan emin olun

---

## 📝 Diğer Roller İçin

Aynı yöntemi kullanarak **Agent** ve **Player** da ekleyebilirsiniz:

**Agent için:**
- `role: "agent"`
- `parentId: "[superadmin-uid]"` (süperadmin'in UID'si)

**Player için:**
- `role: "player"`
- `parentId: "[agent-uid]"` (agent'in UID'si)

