# StatPal API - Railway ve Vercel Kurulumu

## 🚀 Hızlı Kurulum

### Railway (Backend) - Environment Variables

Railway Dashboard'da projenizin **Settings** > **Variables** bölümüne aşağıdaki environment variable'ı ekleyin:

```
STATPAL_API_KEY=75d51040-917d-4a51-a957-4fa2222cc9f3
```

### Vercel (Frontend) - Environment Variables

Vercel'de frontend için environment variable eklemenize gerek yok. StatPal API backend üzerinden kullanılır.

## 📋 Railway'de Tüm Environment Variables

Railway Dashboard'da şu environment variable'ları ekleyin:

```
# API Keys
THE_ODDS_API_KEY=1506840105ed45a22668cdec6147f2e7
STATPAL_API_KEY=75d51040-917d-4a51-a957-4fa2222cc9f3
NOSY_API_TOKEN=2zCF5YF9l3th90LYkR4hKeMWRLEictnmFPYm2TFt6Caj7sPKiROOOr3WBVRl

# Database
DB_NAME=kibris_db
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/kibris_db?retryWrites=true&w=majority

# CORS
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000,http://localhost:3001
```

## 🔧 Railway'de Environment Variable Ekleme Adımları

1. [Railway Dashboard](https://railway.app) → Projenizi seçin
2. **Settings** sekmesine tıklayın
3. **Variables** bölümüne gidin
4. **New Variable** butonuna tıklayın
5. Her bir variable için:
   - **Name**: `STATPAL_API_KEY`
   - **Value**: `75d51040-917d-4a51-a957-4fa2222cc9f3`
   - **Add** butonuna tıklayın

## ✅ Test Etme

Environment variable'ı ekledikten sonra:

1. Railway servisi otomatik olarak yeniden deploy edilir
2. Deploy tamamlandıktan sonra test edin:
   ```
   https://web-production-c33a1.up.railway.app/api/test-statpal
   ```
3. Başarılı response alırsanız entegrasyon tamamlanmıştır!

**Backend URL**: `https://web-production-c33a1.up.railway.app`

## 📚 API Endpoint'leri

StatPal API endpoint'leri:

- `GET /api/matches/statpal` - Futbol maçları
- `GET /api/matches/statpal/live` - Canlı maçlar
- `GET /api/matches/statpal/{match_id}` - Maç detayı
- `GET /api/leagues/statpal` - Ligler
- `GET /api/teams/statpal` - Takımlar
- `GET /api/standings/statpal/{league_id}` - Lig sıralaması
- `GET /api/test-statpal` - API test endpoint'i

## 🔍 Sorun Giderme

### API Key Çalışmıyor
- Railway'de environment variable'ın doğru eklendiğinden emin olun
- Variable adının `STATPAL_API_KEY` olduğundan emin olun (büyük/küçük harf duyarlı)
- Railway servisinin yeniden deploy edildiğinden emin olun

### CORS Hatası
- Railway'de `CORS_ORIGINS` variable'ına frontend URL'inizi ekleyin
- URL'in `https://` ile başladığından emin olun

### Backend Çalışmıyor
- Railway logs'u kontrol edin
- `/api/health` endpoint'ini test edin: `https://web-production-c33a1.up.railway.app/api/health`
- Environment variable'ların doğru eklendiğinden emin olun

