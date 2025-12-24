# 🚨 Vercel Environment Variable Sorunu - Hızlı Çözüm

## ❌ Mevcut Sorun
Frontend hala `localhost:8000` kullanıyor çünkü `REACT_APP_API_URL` environment variable'ı build'e dahil edilmemiş.

## ✅ Çözüm (5 Dakika)

### Adım 1: Vercel Dashboard'a Gidin
1. [vercel.com](https://vercel.com) → Projenizi seçin
2. **Settings** → **Environment Variables** sekmesine gidin

### Adım 2: Environment Variable Ekleyin
1. **"Add New"** butonuna tıklayın
2. Şu bilgileri girin:
   - **Key**: `REACT_APP_API_URL`
   - **Value**: `https://web-production-c33a1.up.railway.app`
   - ⚠️ **ÖNEMLİ**: URL `https://` ile başlamalı ve sonunda `/api` olmamalı!
3. **Environment** seçeneklerinde:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
   - (Hepsini seçin)
4. **"Save"** butonuna tıklayın

### Adım 3: YENİDEN DEPLOY EDİN! 🔄
⚠️ **KRİTİK**: Environment variable ekledikten sonra **mutlaka yeniden deploy** etmelisiniz!

**Yöntem 1: Otomatik (Önerilen)**
- GitHub'a push yapın veya
- Vercel Dashboard'da **Deployments** → En son deployment'ın yanındaki **"..."** → **"Redeploy"**

**Yöntem 2: Manuel**
```bash
cd frontend
vercel --prod
```

### Adım 4: Kontrol Edin
1. Deploy tamamlandıktan sonra siteyi açın
2. Browser Console'u açın (F12)
3. Artık `localhost:8000` yerine backend URL'inizi görmelisiniz
4. Network tab'da API çağrıları başarılı olmalı (200 status)

## 🔍 Backend URL'inizi Bulma

### Railway Kullanıyorsanız:
1. Railway Dashboard → Projeniz
2. **Settings** → **Domains** sekmesi
3. URL'i kopyalayın (örn: `https://web-production-c33a1.up.railway.app`)

**Mevcut Backend URL**: `https://web-production-c33a1.up.railway.app`

### Render Kullanıyorsanız:
1. Render Dashboard → Projeniz
2. URL'i kopyalayın (örn: `https://kibris-backend.onrender.com`)

## ⚠️ Yaygın Hatalar

### ❌ Hata: "localhost:8000" hala görünüyor
**Neden**: Environment variable ekledikten sonra yeniden deploy edilmemiş
**Çözüm**: Mutlaka yeniden deploy edin!

### ❌ Hata: CORS hatası
**Neden**: Backend'de CORS_ORIGINS'a frontend URL'i eklenmemiş
**Çözüm**: Railway'de `CORS_ORIGINS` variable'ına Vercel URL'inizi ekleyin

### ❌ Hata: "Failed to fetch"
**Neden**: Backend URL'i yanlış veya backend çalışmıyor
**Çözüm**: 
1. Backend URL'inin doğru olduğundan emin olun
2. Backend'in çalıştığını kontrol edin: `curl https://your-backend-url/api/health`

## 📋 Kontrol Listesi

- [ ] Vercel'de `REACT_APP_API_URL` environment variable'ı eklendi
- [ ] URL `https://` ile başlıyor
- [ ] URL'in sonunda `/api` yok
- [ ] Production, Preview ve Development için eklendi
- [ ] Environment variable ekledikten sonra **yeniden deploy** edildi
- [ ] Railway'de `CORS_ORIGINS` güncel
- [ ] Browser console'da `localhost:8000` görünmüyor
- [ ] Network tab'da API çağrıları başarılı (200 status)

## 🎯 Hızlı Test

Deploy sonrası browser console'da şunu görmelisiniz:
```
🔧 API Base URL: https://web-production-c33a1.up.railway.app/api
```

Eğer hala `localhost:8000` görüyorsanız, yeniden deploy edin!

## 💡 İpucu

Vercel'de environment variable ekledikten sonra **otomatik deploy** olmaz. Mutlaka manuel olarak yeniden deploy etmelisiniz!

