# 🔧 Production API Bağlantı Sorunu Çözüm Rehberi

## 🎯 Sorun
Deploy sonrası frontend backend'e bağlanamıyor ve "Failed to fetch" hatası alınıyor.

## ✅ Çözüm Adımları

### 1. Frontend (Vercel) Environment Variables

Vercel Dashboard'da şu environment variable'ı ekleyin/güncelleyin:

1. **Vercel Dashboard** > Projeniz > **Settings** > **Environment Variables**
2. Şu değişkeni ekleyin:

```
REACT_APP_API_URL=https://your-backend-url.railway.app
```

⚠️ **ÖNEMLİ:**
- URL `https://` ile başlamalı (http değil!)
- URL'in sonunda `/api` olmamalı (otomatik ekleniyor)
- Örnek: `https://kibris-backend.railway.app` ✅
- Yanlış: `https://kibris-backend.railway.app/api` ❌
- Yanlış: `http://kibris-backend.railway.app` ❌

3. **Production**, **Preview** ve **Development** için aynı değeri ekleyin
4. Environment variable ekledikten sonra **yeniden deploy** edin!

### 2. Backend (Railway) Environment Variables

Railway Dashboard'da şu environment variable'ları kontrol edin:

1. **Railway Dashboard** > Projeniz > **Variables** sekmesi
2. Şu değişkenleri ekleyin/güncelleyin:

```env
CORS_ORIGINS=https://my-kibris-project.vercel.app,https://my-kibris-project-git-main.vercel.app,https://my-kibris-project-git-*.vercel.app
```

⚠️ **ÖNEMLİ:**
- Vercel size birden fazla URL verebilir (production, preview, branch deploys)
- Tüm Vercel URL'lerini CORS_ORIGINS'a ekleyin
- URL'ler `https://` ile başlamalı
- URL'ler arasında virgül (`,`) ile ayırın, boşluk olmamalı

**Vercel URL'lerinizi bulmak için:**
- Vercel Dashboard > Projeniz > **Deployments** sekmesi
- Her deployment'ın yanında URL göreceksiniz
- Production URL'i ve preview URL'lerini ekleyin

### 3. Backend URL'ini Kontrol Edin

Railway'de backend URL'inizi kontrol edin:

1. Railway Dashboard > Projeniz > **Settings** > **Domains**
2. Backend URL'inizi kopyalayın (örn: `https://kibris-backend.railway.app`)
3. Bu URL'i Vercel'deki `REACT_APP_API_URL` değişkenine ekleyin

### 4. Test Etme

#### Backend Health Check
Tarayıcıda veya curl ile test edin:

```bash
curl https://your-backend-url.railway.app/api/health
```

Beklenen yanıt:
```json
{
  "status": "healthy",
  "service": "KIBRIS API",
  "timestamp": "2025-01-XX...",
  "mongodb_connected": true/false
}
```

#### Frontend'den Test
1. Vercel'de deploy edilen frontend'i açın
2. Browser Console'u açın (F12)
3. Network tab'ına bakın
4. API çağrılarını kontrol edin
5. Console'da API URL'i loglanıyor mu kontrol edin (development mode'da)

### 5. Yaygın Hatalar ve Çözümleri

#### ❌ "Failed to fetch" Hatası
**Neden:** 
- Backend URL'i yanlış
- CORS ayarları yanlış
- Backend çalışmıyor

**Çözüm:**
1. Backend URL'inin doğru olduğundan emin olun
2. CORS_ORIGINS'a frontend URL'ini ekleyin
3. Backend'in çalıştığını kontrol edin (health check)

#### ❌ CORS Hatası
**Neden:**
- Backend'de CORS_ORIGINS'a frontend URL'i eklenmemiş

**Çözüm:**
1. Railway'de CORS_ORIGINS variable'ını güncelleyin
2. Tüm Vercel URL'lerini ekleyin (production + preview)
3. Backend'i yeniden deploy edin

#### ❌ Environment Variable Çalışmıyor
**Neden:**
- Variable ekledikten sonra yeniden deploy edilmemiş
- Variable adı yanlış (`REACT_APP_` ile başlamalı)

**Çözüm:**
1. Vercel'de environment variable'ı kontrol edin
2. Variable adının `REACT_APP_API_URL` olduğundan emin olun
3. **Yeniden deploy** edin (Settings > Redeploy)

### 6. Debug İpuçları

#### Frontend Console'da Kontrol
Browser console'da şunları görmelisiniz (development mode):
```
🔧 API Base URL: https://your-backend.railway.app/api
🔧 REACT_APP_API_URL: https://your-backend.railway.app
```

#### Network Tab'da Kontrol
1. F12 > Network tab
2. Bir API çağrısı yapın (örneğin matches sayfasına gidin)
3. İstek URL'ini kontrol edin
4. Status code'u kontrol edin:
   - 200: Başarılı ✅
   - 404: Endpoint bulunamadı ❌
   - 500: Backend hatası ❌
   - CORS error: CORS ayarları yanlış ❌

### 7. Hızlı Kontrol Listesi

- [ ] Vercel'de `REACT_APP_API_URL` environment variable'ı ekli
- [ ] URL `https://` ile başlıyor
- [ ] URL'in sonunda `/api` yok
- [ ] Railway'de `CORS_ORIGINS` variable'ı güncel
- [ ] Tüm Vercel URL'leri CORS_ORIGINS'a ekli
- [ ] Backend health check çalışıyor
- [ ] Environment variable ekledikten sonra yeniden deploy edildi
- [ ] Browser console'da hata mesajı yok

## 📞 Hala Çalışmıyorsa

1. **Backend Logları Kontrol Edin:**
   - Railway Dashboard > Projeniz > **Deployments** > Logs
   - CORS hatalarını kontrol edin

2. **Frontend Logları Kontrol Edin:**
   - Vercel Dashboard > Projeniz > **Deployments** > Logs
   - Build hatalarını kontrol edin

3. **Network Tab'da Detaylı İnceleme:**
   - Request URL'i doğru mu?
   - Response status code nedir?
   - Response body'de ne var?

4. **Manuel Test:**
   ```bash
   # Backend health check
   curl https://your-backend.railway.app/api/health
   
   # Backend matches endpoint
   curl https://your-backend.railway.app/api/matches
   ```

## 🎉 Başarılı Deploy Kontrolü

Her şey çalışıyorsa:
- ✅ Frontend'de maçlar listeleniyor
- ✅ Browser console'da hata yok
- ✅ Network tab'da API çağrıları 200 status code döndürüyor
- ✅ Backend health check çalışıyor

