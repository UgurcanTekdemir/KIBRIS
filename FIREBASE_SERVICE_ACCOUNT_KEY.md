# Firebase Service Account Key Alma Rehberi

## 🔑 Service Account Key Nasıl Alınır?

### Adım 1: Firebase Console'a Giriş

1. **Firebase Console'a gidin:**
   https://console.firebase.google.com

2. **Projenizi seçin:** `my-kibris`

### Adım 2: Project Settings'e Gidin

1. Sol üst köşedeki **⚙️ (Ayarlar)** ikonuna tıklayın
2. **"Project settings"** seçeneğine tıklayın

### Adım 3: Service Accounts Sekmesine Gidin

1. Açılan sayfada üstteki menüden **"Service accounts"** sekmesine tıklayın
2. Bu sekmede Firebase Admin SDK için gerekli bilgileri göreceksiniz

### Adım 4: Service Account Key Oluşturun

1. **"Generate new private key"** butonuna tıklayın
2. Bir uyarı penceresi açılacak:
   - "Are you sure you want to generate a new private key?"
   - **"Generate key"** butonuna tıklayın
3. JSON dosyası otomatik olarak indirilecek

**⚠️ ÖNEMLİ:** Bu JSON dosyası çok hassastır! Asla:
- Git repository'sine commit etmeyin
- Public olarak paylaşmayın
- Başkalarıyla paylaşmayın

### Adım 5: JSON Dosyasını Güvenli Bir Yere Kaydedin

1. İndirilen JSON dosyasını güvenli bir yere kaydedin
2. Örneğin: `~/firebase-service-account-key.json` veya proje klasöründe `.env` gibi ignore edilen bir yere

**Önerilen konum:**
```
/Users/uggrcn/kıbrıs 2.2/KIBRIS/firebase-service-account-key.json
```

**VEYA proje dışında:**
```
~/firebase-keys/my-kibris-service-account.json
```

### Adım 6: Environment Variable Ayarlayın

Terminal'de şu komutu çalıştırın (dosya yolunu kendi konumunuza göre değiştirin):

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/Users/uggrcn/kıbrıs 2.2/KIBRIS/firebase-service-account-key.json"
```

**Kalıcı olması için:**

**macOS/Linux (zsh/bash):**
```bash
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/Users/uggrcn/kıbrıs 2.2/KIBRIS/firebase-service-account-key.json"' >> ~/.zshrc
source ~/.zshrc
```

**Windows (PowerShell):**
```powershell
[System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', 'C:\path\to\firebase-service-account-key.json', 'User')
```

### Adım 7: .gitignore'a Ekleme (ÇOK ÖNEMLİ!)

Service account key dosyasını Git'e commit etmeyin:

```bash
# .gitignore dosyasına ekleyin
echo "firebase-service-account-key.json" >> .gitignore
echo "*service-account*.json" >> .gitignore
```

---

## ✅ Key'i Aldıktan Sonra Script Çalıştırma

Service account key'i aldıktan ve environment variable'ı ayarladıktan sonra:

```bash
# Environment variable'ı ayarlayın (her terminal açılışında)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-service-account-key.json"

# Scripti çalıştırın
node add-superadmin.js 456UK2q0sjOfRUTcROIXWhmvHAM2 admin@my-kibris.com superadmin
```

---

## 🔍 JSON Dosyası İçeriği (Örnek)

Service account key JSON dosyası şuna benzer görünür:

```json
{
  "type": "service_account",
  "project_id": "my-kibris",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@my-kibris.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

---

## 🛡️ Güvenlik Notları

1. **Asla commit etmeyin:** JSON dosyasını Git repository'sine eklemeyin
2. **.gitignore'a ekleyin:** Dosya adını `.gitignore`'a ekleyin
3. **Güvenli saklayın:** Dosyayı güvenli bir yerde saklayın
4. **İhtiyaç duyulmadığında silin:** Kullanmıyorsanız silin veya yenileyin
5. **Yetkileri sınırlayın:** Service account'a sadece gerekli izinleri verin

---

## 📝 Hızlı Komutlar

```bash
# Service account key dosyasını indirdikten sonra
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-service-account-key.json"

# Test etmek için
node add-superadmin.js 456UK2q0sjOfRUTcROIXWhmvHAM2 admin@my-kibris.com superadmin

# .gitignore'a ekle
echo "firebase-service-account-key.json" >> .gitignore
echo "*service-account*.json" >> .gitignore
```

---

## 🆘 Sorun Giderme

### "Could not load the default credentials" hatası
- Environment variable'ın doğru ayarlandığından emin olun
- Dosya yolunun doğru olduğunu kontrol edin
- JSON dosyasının okunabilir olduğundan emin olun

### "Permission denied" hatası
- Service account'un Firestore'a yazma yetkisi olduğundan emin olun
- Firebase Console > IAM & Admin > Service Accounts'tan kontrol edin

---

## 🎯 Alternatif: Firebase Console'dan Manuel Ekleme

Service account key almak istemiyorsanız, Firebase Console üzerinden manuel ekleme yapabilirsiniz. Bu daha hızlı ve kolaydır.

Detaylar için `ADD_SUPERADMIN_NOW.md` dosyasına bakın.

