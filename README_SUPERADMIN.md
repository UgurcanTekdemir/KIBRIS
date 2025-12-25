# Süperadmin Ekleme - Hızlı Başlangıç

## 🚀 Otomatik Ekleme (Script ile)

### Adım 1: Firebase Console'da Authentication Kullanıcısı Oluşturun

1. **Firebase Console'a gidin:** https://console.firebase.google.com
2. **Proje:** my-kibris
3. **Authentication** > **Users** > **Add user**
4. Email ve Password girin
5. **UID'yi kopyalayın**

### Adım 2: Scripti Çalıştırın

**İnteraktif mod:**
```bash
node add-superadmin-interactive.js
```

Script size UID, email ve username soracak.

**Direkt mod:**
```bash
node add-superadmin.js <UID> <email> <username>
```

Örnek:
```bash
node add-superadmin.js abc123def456 admin@test.com superadmin
```

### Adım 3: Test Edin

1. http://localhost:3000/login adresine gidin
2. Oluşturduğunuz email ve password ile giriş yapın
3. `/superadmin` sayfasına yönlendirilmelisiniz

---

## 📝 Manuel Ekleme (Firebase Console)

Detaylı adımlar için `ADD_SUPERADMIN_GUIDE.md` dosyasına bakın.

---

## ⚠️ Notlar

- Script çalışmıyorsa, Firebase Admin SDK için service account key gerekebilir
- Alternatif olarak Firebase Console üzerinden manuel ekleme yapabilirsiniz
- Firestore Security Rules'ın deploy edilmiş olması gerekir

