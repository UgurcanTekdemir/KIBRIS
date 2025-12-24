# Deployment URL'leri

## 🚂 Railway (Backend)

**Backend URL**: `https://web-production-c33a1.up.railway.app`

### Test Endpoint'leri

- Health Check: `https://web-production-c33a1.up.railway.app/api/health`
- StatPal API Test: `https://web-production-c33a1.up.railway.app/api/test-statpal`
- The Odds API Test: `https://web-production-c33a1.up.railway.app/api/test-odds-api`
- NosyAPI Test: `https://web-production-c33a1.up.railway.app/api/test`

### API Endpoint'leri

- Matches: `https://web-production-c33a1.up.railway.app/api/matches`
- Live Matches: `https://web-production-c33a1.up.railway.app/api/matches/live`
- StatPal Live Matches: `https://web-production-c33a1.up.railway.app/api/matches/statpal/live`
- Leagues: `https://web-production-c33a1.up.railway.app/api/leagues`
- StatPal Leagues: `https://web-production-c33a1.up.railway.app/api/leagues/statpal`

## 🌐 Vercel (Frontend)

**Frontend URL**: (Vercel deploy sonrası eklenecek)

Vercel'de environment variable olarak ekleyin:
```
REACT_APP_API_URL=https://web-production-c33a1.up.railway.app
```

⚠️ **ÖNEMLİ**: URL'in sonunda `/api` olmamalı!

## 📋 Railway Environment Variables

Railway Dashboard > Settings > Variables bölümüne ekleyin:

```env
# API Keys
THE_ODDS_API_KEY=1506840105ed45a22668cdec6147f2e7
STATPAL_API_KEY=75d51040-917d-4a51-a957-4fa2222cc9f3
NOSY_API_TOKEN=2zCF5YF9l3th90LYkR4hKeMWRLEictnmFPYm2TFt6Caj7sPKiROOOr3WBVRl

# Database
DB_NAME=kibris_db
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/kibris_db?retryWrites=true&w=majority

# CORS (Vercel URL'i eklendikten sonra güncelleyin)
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000,http://localhost:3001
```

## 🔧 Hızlı Test

### Backend Health Check
```bash
curl https://web-production-c33a1.up.railway.app/api/health
```

### StatPal API Test
```bash
curl https://web-production-c33a1.up.railway.app/api/test-statpal
```

### Browser'da Test
Tarayıcıda şu URL'leri açın:
- `https://web-production-c33a1.up.railway.app/api/health`
- `https://web-production-c33a1.up.railway.app/api/test-statpal`

## 📝 Notlar

- Railway URL'i otomatik olarak oluşturulur
- Vercel URL'i deploy sonrası otomatik oluşturulur
- Vercel URL'i aldıktan sonra Railway'deki `CORS_ORIGINS` variable'ını güncelleyin
- Her iki platformda da environment variable'ları doğru eklediğinizden emin olun

