# 🚀 Vercel Deployment Guide

Bu rehber KIBRIS projesini Vercel üzerinde deploy etmek için hazırlanmıştır.

## 📋 Gereksinimler

1. **Vercel Hesabı**: [vercel.com](https://vercel.com) üzerinden ücretsiz hesap oluşturun
2. **GitHub Repository**: Projenizin GitHub'da olması gerekiyor (önerilir)
3. **Backend URL**: Backend API'nizin çalıştığı URL (örn: Railway, Render, Heroku, vb.)

## 🔧 Adım 1: Backend'i Deploy Edin (Önce Backend)

Backend'inizi aşağıdaki platformlardan birine deploy edin:

### Seçenek 1: Railway (Önerilen)
1. [railway.app](https://railway.app) üzerinden hesap oluşturun
2. Yeni proje oluşturun
3. GitHub repository'yi bağlayın veya `backend` klasörünü yükleyin
4. Environment variables ekleyin:
   ```
   NOSY_API_TOKEN=your_token_here
   MONGO_URL=your_mongodb_url (opsiyonel)
   DB_NAME=kibris_db
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```
5. Deploy butonuna tıklayın
6. Backend URL'inizi not edin (örn: `https://your-app.railway.app`)

### Seçenek 2: Render
1. [render.com](https://render.com) üzerinden hesap oluşturun
2. "New Web Service" seçin
3. GitHub repository'yi bağlayın
4. Ayarlar:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Environment variables ekleyin
6. Deploy edin

### Seçenek 3: Heroku
```bash
cd backend
heroku create your-app-name
heroku config:set NOSY_API_TOKEN=your_token_here
heroku config:set CORS_ORIGINS=https://your-frontend.vercel.app
git push heroku main
```

## 🎨 Adım 2: Frontend'i Vercel'e Deploy Edin

### Yöntem 1: Vercel CLI ile (Önerilen)

1. **Vercel CLI'yi yükleyin:**
   ```bash
   npm install -g vercel
   ```

2. **Vercel'e giriş yapın:**
   ```bash
   vercel login
   ```

3. **Projeyi deploy edin:**
   ```bash
   cd frontend
   vercel
   ```

4. **Production deploy için:**
   ```bash
   vercel --prod
   ```

### Yöntem 2: GitHub ile (En Kolay)

1. **Projenizi GitHub'a push edin:**
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push origin main
   ```

2. **Vercel Dashboard'a gidin:**
   - [vercel.com/new](https://vercel.com/new) adresine gidin
   - GitHub repository'nizi seçin
   - "Import" butonuna tıklayın

3. **Proje Ayarlarını Yapın:**
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install --legacy-peer-deps`

4. **Environment Variables Ekleyin:**
   ```
   REACT_APP_API_URL=https://your-backend-url.railway.app
   ```
   (Backend URL'inizi yukarıda aldığınız URL ile değiştirin)

5. **Deploy butonuna tıklayın**

## ⚙️ Environment Variables

Vercel Dashboard'da veya CLI ile environment variables ekleyin:

### Frontend için:
```bash
REACT_APP_API_URL=https://your-backend-url.railway.app
```

### Vercel CLI ile eklemek için:
```bash
cd frontend
vercel env add REACT_APP_API_URL
# Production, Preview, Development için değerleri girin
```

## 🔄 Otomatik Deploy

Vercel, GitHub'a her push yaptığınızda otomatik olarak:
- Production branch (main/master) için production deploy
- Diğer branch'ler için preview deploy

yapar.

## 🌐 CORS Ayarları

Backend'inizde `CORS_ORIGINS` environment variable'ına Vercel domain'inizi ekleyin:

```
CORS_ORIGINS=https://your-app.vercel.app,https://your-app-git-main.vercel.app
```

## 📝 Deployment Checklist

- [ ] Backend deploy edildi ve çalışıyor
- [ ] Backend URL'i alındı
- [ ] Frontend için `REACT_APP_API_URL` environment variable eklendi
- [ ] Backend'de `CORS_ORIGINS` güncellendi
- [ ] Vercel'de proje oluşturuldu
- [ ] Build başarılı oldu
- [ ] Production URL test edildi

## 🐛 Sorun Giderme

### Build Hatası
- `npm install --legacy-peer-deps` kullanıldığından emin olun
- Node.js versiyonu 18+ olduğundan emin olun (Vercel Dashboard'da ayarlanabilir)

### API Bağlantı Hatası
- Backend URL'inin doğru olduğundan emin olun
- CORS ayarlarını kontrol edin
- Browser console'da hataları kontrol edin

### Environment Variables Çalışmıyor
- Environment variable'ların `REACT_APP_` ile başladığından emin olun
- Deploy sonrası değişiklik yaptıysanız yeniden deploy edin
- Production, Preview ve Development için ayrı ayrı eklenmesi gerekebilir

## 🔗 Yararlı Linkler

- [Vercel Dokümantasyonu](https://vercel.com/docs)
- [Create React App Deploy](https://create-react-app.dev/docs/deployment/)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

