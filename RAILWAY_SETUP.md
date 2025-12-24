# Railway Deployment Setup

## Sorun
Railway root dizinde Python projesi bulamıyor çünkü backend klasöründe.

## Çözüm

### Yöntem 1: Railway Dashboard'da Root Directory Ayarlama (ÖNERİLEN)

1. Railway dashboard'a gidin
2. Projenizi seçin
3. "Settings" sekmesine gidin
4. "Root Directory" bölümünü bulun
5. Root directory'yi `backend` olarak ayarlayın
6. Deploy edin

### Yöntem 2: Railway.json ile

Railway.json dosyası güncellendi. Ancak Railway dashboard'da root directory'yi `backend` olarak ayarlamanız gerekiyor.

### Yöntem 3: Nixpacks.toml

`backend/nixpacks.toml` dosyası oluşturuldu. Bu dosya Railway'e Python projesinin backend klasöründe olduğunu söyler.

## Önemli Notlar

- Railway dashboard'da **Root Directory** ayarını `backend` olarak yapmanız **ZORUNLU**
- `.env` dosyasını Railway dashboard'da Environment Variables olarak ekleyin
- `PORT` değişkeni Railway tarafından otomatik sağlanır
- MongoDB bağlantısı için `MONGO_URL` environment variable'ını ekleyin

## Environment Variables

Railway dashboard'da şu environment variable'ları ekleyin:

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

Detaylı bilgi için `RAILWAY_ENV_SETUP.md` dosyasına bakın.

## Start Command

```
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Bu komut `railway.json` ve `Procfile` dosyalarında tanımlı.

