# Firebase Authentication 403 Hatası Çözümü

## 🔴 Sorun
```
POST https://securetoken.googleapis.com/v1/token?key=AIzaSyCQRESr4sjx0X1lbX7uxVX3SpPBtU3Iahk 403 (Forbidden)
```

Bu hata, Firebase Authentication token refresh işlemi sırasında oluşuyor. Google Cloud Console'da API key'in HTTP referrer kısıtlamaları eksik veya yanlış yapılandırılmış.

## ✅ Çözüm Adımları

### 1. Google Cloud Console'a Gidin
1. [Google Cloud Console](https://console.cloud.google.com/) → Projeniz: **My-kibris**
2. **APIs & Services** → **Credentials** sekmesine gidin
3. API key'inizi bulun: `AIzaSyCQRESr4sjx0X1lbX7uxVX3SpPBtU3Iahk`
4. API key'in yanındaki **✏️ Edit** (kalem) ikonuna tıklayın

### 2. Application Restrictions (Uygulama Kısıtlamaları) Ayarları

**"Application restrictions"** bölümünde:
- ✅ **HTTP referrers (web sites)** seçeneğini seçin
- **Website restrictions** bölümüne şu URL'leri ekleyin:

```
http://localhost:3000/*
http://localhost:3001/*
https://my-kibris.firebaseapp.com/*
https://my-kibris.web.app/*
```

**⚠️ ÖNEMLİ:**
- Her URL'nin sonunda `/*` olmalı
- `http://` veya `https://` ile başlamalı
- Her URL'yi ayrı satıra ekleyin

### 3. API Restrictions (API Kısıtlamaları) Ayarları

**"API restrictions"** bölümünde:
- ✅ **Restrict key** seçeneğini seçin
- Şu API'leri seçin (en azından şunlar olmalı):
  - ✅ **Firebase Authentication API**
  - ✅ **Identity Toolkit API**
  - ✅ **Cloud Firestore API**
  - ✅ **Cloud Storage API**
  - ✅ **Firebase Cloud Messaging API**

### 4. Kaydet ve Bekle
1. **Save** butonuna tıklayın
2. ⏱️ **5-10 dakika bekleyin** (değişikliklerin yayılması için)
3. Tarayıcıyı kapatıp yeniden açın
4. Sayfayı hard refresh yapın (Cmd+Shift+R veya Ctrl+Shift+R)

## 🔍 Kontrol Listesi

- [ ] `http://localhost:3000/*` eklendi mi?
- [ ] `http://localhost:3001/*` eklendi mi?
- [ ] `https://my-kibris.firebaseapp.com/*` eklendi mi?
- [ ] `https://my-kibris.web.app/*` eklendi mi?
- [ ] Her URL'nin sonunda `/*` var mı?
- [ ] Firebase Authentication API seçili mi?
- [ ] Identity Toolkit API seçili mi?
- [ ] Değişiklikler kaydedildi mi?
- [ ] 5-10 dakika beklendi mi?

## 🚨 Hala Çalışmıyorsa

1. **Tarayıcı cache'ini temizleyin:**
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Firefox: Settings → Privacy → Clear Data → Cached Web Content

2. **Gizli modda test edin:**
   - Yeni bir gizli pencere açın
   - Siteyi test edin

3. **API key'i kontrol edin:**
   - Google Cloud Console → APIs & Services → Credentials
   - API key'in durumunu kontrol edin
   - Eğer "Restricted" görünüyorsa, referrer'ları tekrar kontrol edin

## 📝 Notlar

- API key kısıtlamaları güvenlik için önemlidir
- Production'da Vercel URL'inizi de eklemeniz gerekebilir
- Değişikliklerin yayılması 5-10 dakika sürebilir

