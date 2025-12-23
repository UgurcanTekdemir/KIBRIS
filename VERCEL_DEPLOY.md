# 🚀 Vercel Deployment - Hızlı Başlangıç

## 📋 Hızlı Adımlar

### 1. GitHub'a Push Edin (Opsiyonel ama Önerilir)

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Vercel Dashboard ile Deploy

1. **Vercel'e gidin**: [vercel.com/new](https://vercel.com/new)
2. **GitHub ile giriş yapın** ve repository'nizi seçin
3. **Proje Ayarları**:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend` ← **ÖNEMLİ!**
   - **Build Command**: `npm run build` (otomatik algılanır)
   - **Output Directory**: `build` (otomatik algılanır)
   - **Install Command**: `npm install --legacy-peer-deps` ← **ÖNEMLİ!**

4. **Environment Variables Ekle**:
   - **Key**: `REACT_APP_API_URL`
   - **Value**: Backend URL'iniz (örn: `https://your-backend.railway.app`)
   - Production, Preview ve Development için aynı değeri ekleyin

5. **Deploy** butonuna tıklayın! 🎉

### 3. Vercel CLI ile Deploy (Alternatif)

```bash
# Vercel CLI'yi yükleyin
npm install -g vercel

# Frontend klasörüne gidin
cd frontend

# Deploy edin
vercel

# Environment variable ekleyin
vercel env add REACT_APP_API_URL

# Production deploy
vercel --prod
```

## ⚠️ ÖNEMLİ NOTLAR

### Backend URL'i
Backend'inizi önce deploy etmeniz gerekiyor! Backend için şu platformları öneriyoruz:
- **Railway**: [railway.app](https://railway.app) (En kolay, ücretsiz başlangıç)
- **Render**: [render.com](https://render.com) (Ücretsiz tier var)
- **Fly.io**: [fly.io](https://fly.io) (Ücretsiz tier var)

### Environment Variables

Vercel Dashboard'da şu environment variable'ı ekleyin:

```
REACT_APP_API_URL=https://your-backend-url.railway.app
```

⚠️ **ÖNEMLİ**: Değer `http://` değil `https://` ile başlamalı!

### CORS Ayarları

Backend'inizdeki `.env` dosyasında şunu ekleyin/güncelleyin:

```env
CORS_ORIGINS=https://your-app.vercel.app,https://your-app-git-main.vercel.app
```

Vercel size URL'i deploy sonrası verecek. Bu URL'i backend CORS ayarlarına eklemelisiniz.

### Build Komutları

Vercel otomatik olarak algılar, ama manuel ayarlamak isterseniz:
- **Install Command**: `npm install --legacy-peer-deps`
- **Build Command**: `npm run build`
- **Output Directory**: `build`

## 🔍 Sorun Giderme

### Build Hatası
- `package.json` içinde `--legacy-peer-deps` kullanıldığından emin olun
- Node.js version 18+ kullandığınızdan emin olun (Vercel Dashboard > Settings > Node.js Version)

### API Bağlantı Hatası
- Browser console'u açın (F12) ve network tab'ına bakın
- `REACT_APP_API_URL` environment variable'ının doğru olduğundan emin olun
- CORS hatası alıyorsanız backend CORS ayarlarını kontrol edin
- Backend URL'inin `https://` ile başladığından emin olun

### Environment Variable Çalışmıyor
- Vercel'de environment variable ekledikten sonra **yeniden deploy** etmeniz gerekebilir
- Production, Preview ve Development için ayrı ayrı eklenmesi gerekebilir
- Variable adının `REACT_APP_` ile başladığından emin olun

## 📱 Test Etme

Deploy sonrası:
1. Vercel size bir URL verecek (örn: `https://your-app.vercel.app`)
2. Bu URL'i açın ve uygulamanın çalıştığını kontrol edin
3. API çağrılarının çalıştığını kontrol edin (F12 > Network tab)

## 🔄 Otomatik Deploy

Vercel otomatik olarak:
- `main` veya `master` branch'e push yaptığınızda **production** deploy yapar
- Diğer branch'lere push yaptığınızda **preview** deploy yapar

Her push'ta otomatik deploy olur! 🎉

## 📚 Daha Fazla Bilgi

- [Vercel Dokümantasyonu](https://vercel.com/docs)
- [Create React App Deploy](https://create-react-app.dev/docs/deployment/#vercel)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

