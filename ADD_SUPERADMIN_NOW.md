# Süperadmin Ekleme - Hızlı Adımlar

## 🔥 UID: 456UK2q0sjOfRUTcROIXWhmvHAM2

### Firebase Console'dan Ekleme (2 Dakika)

1. **Firebase Console'a gidin:**
   https://console.firebase.google.com/project/my-kibris/firestore

2. **Firestore Database** > **Data** sekmesine gidin

3. **users** collection'ına gidin (yoksa oluşturun)

4. **Add document** butonuna tıklayın

5. **Document ID:** Aşağıdaki UID'yi yapıştırın:
   ```
   456UK2q0sjOfRUTcROIXWhmvHAM2
   ```

6. **Field'ları ekleyin:**

   | Field | Type | Value |
   |-------|------|-------|
   | `email` | string | `admin@my-kibris.com` (veya Authentication'daki email) |
   | `username` | string | `superadmin` |
   | `role` | string | `superadmin` |
   | `balance` | number | `0` |
   | `credit` | number | `0` |
   | `isBanned` | boolean | `false` |
   | `createdAt` | timestamp | **Set timestamp** butonuna tıklayın |
   | `updatedAt` | timestamp | **Set timestamp** butonuna tıklayın |

7. **Save** butonuna tıklayın

### ✅ Tamamlandı!

Şimdi http://localhost:3000/login adresinden giriş yapabilirsiniz.

---

## 📝 Alternatif: Service Account Key ile Script Kullanımı

Eğer script kullanmak isterseniz:

1. **Service Account Key alın:**
   - Firebase Console > Project Settings > Service Accounts
   - "Generate new private key" butonuna tıklayın
   - JSON dosyasını indirin

2. **Environment variable ayarlayın:**
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

3. **Scripti çalıştırın:**
   ```bash
   node add-superadmin.js 456UK2q0sjOfRUTcROIXWhmvHAM2 admin@my-kibris.com superadmin
   ```

---

## ⚡ En Hızlı Yöntem: Firebase Console

Firebase Console üzerinden manuel ekleme en hızlı ve kolay yöntemdir (2 dakika).

