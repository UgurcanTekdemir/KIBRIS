# Environment Variables - Hızlı Referans

## 🚀 Railway (Backend) - Tüm Environment Variables

Railway Dashboard > Settings > Variables bölümüne ekleyin:

```env
# API Keys
THE_ODDS_API_KEY=1506840105ed45a22668cdec6147f2e7
STATPAL_API_KEY=75d51040-917d-4a51-a957-4fa2222cc9f3
NOSY_API_TOKEN=2zCF5YF9l3th90LYkR4hKeMWRLEictnmFPYm2TFt6Caj7sPKiROOOr3WBVRl

# Database
DB_NAME=kibris_db
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/kibris_db?retryWrites=true&w=majority

# CORS (Frontend URL'inizi ekleyin)
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000,http://localhost:3001
```

## 🌐 Vercel (Frontend) - Environment Variables

Vercel Dashboard > Settings > Environment Variables bölümüne ekleyin:

```env
REACT_APP_API_URL=https://web-production-c33a1.up.railway.app
```

⚠️ **ÖNEMLİ**: URL `https://` ile başlamalı ve sonunda `/api` olmamalı!

## 📝 Adım Adım Ekleme

### Railway'de Ekleme

1. [Railway Dashboard](https://railway.app) → Projenizi seçin
2. **Settings** → **Variables** sekmesi
3. **New Variable** butonuna tıklayın
4. Her variable için:
   - **Name**: Variable adı (örn: `STATPAL_API_KEY`)
   - **Value**: Variable değeri (örn: `75d51040-917d-4a51-a957-4fa2222cc9f3`)
   - **Add** butonuna tıklayın

### Vercel'de Ekleme

1. [Vercel Dashboard](https://vercel.com) → Projenizi seçin
2. **Settings** → **Environment Variables** sekmesi
3. **Add New** butonuna tıklayın
4. Şu bilgileri girin:
   - **Key**: `REACT_APP_API_URL`
   - **Value**: Backend URL'iniz (örn: `https://your-backend.railway.app`)
   - **Environment**: Production, Preview, Development (hepsini seçin)
   - **Save** butonuna tıklayın
5. ⚠️ **YENİDEN DEPLOY EDİN!**

## ✅ Kontrol Listesi

### Railway
- [ ] `THE_ODDS_API_KEY` eklendi
- [ ] `STATPAL_API_KEY` eklendi
- [ ] `NOSY_API_TOKEN` eklendi
- [ ] `DB_NAME` eklendi
- [ ] `MONGO_URL` eklendi (veya Railway MongoDB Plugin kullanılıyor)
- [ ] `CORS_ORIGINS` eklendi (frontend URL'i dahil)

### Vercel
- [ ] `REACT_APP_API_URL` eklendi
- [ ] URL `https://` ile başlıyor
- [ ] URL'in sonunda `/api` yok
- [ ] Production, Preview ve Development için eklendi
- [ ] Environment variable ekledikten sonra **yeniden deploy** edildi

## 🧪 Test Etme

### Railway Backend Test
```bash
# Health check
curl https://web-production-c33a1.up.railway.app/api/health

# StatPal API test
curl https://web-production-c33a1.up.railway.app/api/test-statpal

# The Odds API test
curl https://web-production-c33a1.up.railway.app/api/test-odds-api
```

### Vercel Frontend Test
1. Browser console'u açın (F12)
2. Şunu görmelisiniz:
   ```
   🔧 API Configuration:
     - Final API_BASE_URL: https://web-production-c33a1.up.railway.app/api
   ```
3. Network tab'da API çağrıları başarılı olmalı (200 status)

## 📚 Detaylı Dokümantasyon

- Railway: `RAILWAY_ENV_SETUP.md`
- Vercel: `VERCEL_ENV_FIX.md`
- StatPal API: `STATPAL_API_SETUP.md`
- Genel API: `API_INTEGRATION.md`

