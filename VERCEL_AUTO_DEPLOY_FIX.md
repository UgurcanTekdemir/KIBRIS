# 🔧 Vercel Otomatik Deploy Sorunu - Çözüm Rehberi

## 📋 Sorun
Vercel otomatik redeploy yapmıyor ve kod güncellemeleri çekilmiyor. Manuel redeploy da işe yaramıyor.

## ✅ Adım Adım Çözüm

### 1. Vercel Dashboard Ayarlarını Kontrol Edin

#### A. Git Repository Bağlantısı
1. **Vercel Dashboard** → Projeniz → **Settings** → **Git**
2. **Connected Git Repository** bölümünü kontrol edin:
   - ✅ Repository bağlı mı?
   - ❌ Bağlı değilse **"Connect Git Repository"** butonuna tıklayın
   - Repository'yi yeniden bağlayın ve izinleri verin

#### B. Production Branch Ayarı
1. **Settings** → **Git** sekmesinde
2. **Production Branch** kontrolü:
   - ✅ `main` veya `master` olmalı (hangi branch kullanıyorsanız)
   - ❌ Yanlışsa düzeltin

#### C. Root Directory Ayarı
1. **Settings** → **General** sekmesine gidin
2. **Root Directory** bölümünü bulun:
   - ✅ **"Edit"** → `frontend` yazın → **"Save"**
   - ❌ Boş veya yanlışsa mutlaka düzeltin

#### D. Build & Development Settings
1. **Settings** → **General** → **Build & Development Settings**
2. Kontrol edin:
   - **Framework Preset**: `Create React App` veya `Other`
   - **Root Directory**: `frontend` ✅
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install --legacy-peer-deps` ✅
   - **Node.js Version**: `18.x` veya `20.x` (Settings → General → Node.js Version)

### 2. Git Webhook'larını Kontrol Edin

#### GitHub Repository Ayarları
1. **GitHub** → Repository'niz → **Settings** → **Webhooks**
2. Kontrol edin:
   - ✅ `https://api.vercel.com/v1/integrations/deploy` URL'li bir webhook var mı?
   - ❌ Yoksa Vercel otomatik olarak eklemeli, eklenmemişse:
     - Vercel Dashboard → Settings → Git → **"Disconnect"** yapın
     - Sonra tekrar **"Connect Git Repository"** ile bağlayın

### 3. Deploy Ayarlarını Sıfırlayın

#### Yöntem 1: Projeyi Yeniden Bağlayın (Önerilen)
1. **Vercel Dashboard** → Projeniz → **Settings** → **General**
2. En alta inin → **"Delete Project"** (projeyi silin)
3. **"Add New..."** → **"Project"**
4. Git Repository'nizi seçin
5. Ayarları tekrar yapın:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Create React App`
   - **Install Command**: `npm install --legacy-peer-deps`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

#### Yöntem 2: Manuel Webhook Ekleme
Eğer yukarıdaki yöntem çalışmazsa:

1. **GitHub** → Repository → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL**: `https://api.vercel.com/v1/integrations/deploy/${VERCEL_PROJECT_ID}`
   - `VERCEL_PROJECT_ID`'yi Vercel Dashboard → Settings → General → Project ID'den alın
3. **Content type**: `application/json`
4. **Secret**: Vercel'den alacağınız secret (Settings → Git → Webhook Secret)
5. **Events**: `Just the push event.` seçin
6. **Active**: ✅ İşaretli olsun
7. **Add webhook**

### 4. Build Cache'i Temizleyin

1. **Vercel Dashboard** → **Deployments**
2. Son deployment'a tıklayın
3. **"Redeploy"** → **"Use existing Build Cache"** checkbox'ını **KALDIRIN** ✅
4. **"Redeploy"** butonuna tıklayın

### 5. Test: Empty Commit ile Deploy Tetikleme

Terminal'de şu komutları çalıştırın:

```bash
cd /Users/uggrcn/KIBRIS-DEMO/KIBRIS

# Git durumunu kontrol edin
git status

# Tüm değişiklikleri commit edin (varsa)
git add .
git commit -m "Update: Test automatic deployment"

# Empty commit ile deploy tetikleyin
git commit --allow-empty -m "Trigger Vercel deployment - $(date)"
git push origin main
```

### 6. Vercel CLI ile Kontrol

```bash
# Vercel CLI'yi yükleyin (yoksa)
npm install -g vercel

# Frontend klasörüne gidin
cd frontend

# Vercel'e giriş yapın
vercel login

# Proje bağlantısını kontrol edin
vercel ls

# Manuel deploy deneyin
vercel --prod --force
```

### 7. Vercel Dashboard'dan Deployment Kontrolü

1. **Vercel Dashboard** → **Deployments**
2. En üstteki deployment'a tıklayın
3. Kontrol edin:
   - **Source**: GitHub commit bilgisi doğru mu?
   - **Commit**: Son commit'iniz görünüyor mu?
   - **Build Logs**: Hata var mı?

## 🔍 Sorun Tespiti

### Senaryo A: Deploy Hiç Yapılmıyor
- **Neden**: Git webhook'u çalışmıyor veya repository bağlantısı yok
- **Çözüm**: Adım 2 ve 3'ü uygulayın

### Senaryo B: Deploy Yapılıyor Ama Eski Kod
- **Neden**: Build cache veya Root Directory yanlış
- **Çözüm**: Adım 1C, 1D ve 4'ü uygulayın

### Senaryo C: Manuel Redeploy İşe Yaramıyor
- **Neden**: Build ayarları yanlış veya cache sorunu
- **Çözüm**: Adım 4'ü uygulayın (cache olmadan redeploy)

## ⚡ Hızlı Test Komutu

Aşağıdaki komutları çalıştırarak test edin:

```bash
cd /Users/uggrcn/KIBRIS-DEMO/KIBRIS

# Git branch kontrolü
git branch --show-current

# Son commit'i kontrol edin
git log --oneline -1

# Empty commit ile deploy tetikleyin
git commit --allow-empty -m "Test: Trigger Vercel auto-deploy $(date +%Y%m%d-%H%M%S)"
git push origin main
```

Push sonrası Vercel Dashboard → Deployments'ta yeni bir deployment başlamalı.

## 📞 Hala Çalışmıyorsa

1. **Vercel Support**: [vercel.com/support](https://vercel.com/support)
2. **Vercel Discord**: [vercel.com/discord](https://vercel.com/discord)
3. **GitHub Issues**: Repository'nizde issue açın

## ✅ Kontrol Listesi

- [ ] Git Repository Vercel'e bağlı
- [ ] Production Branch doğru ayarlanmış (`main` veya `master`)
- [ ] Root Directory = `frontend`
- [ ] Install Command = `npm install --legacy-peer-deps`
- [ ] Build Command = `npm run build`
- [ ] Output Directory = `build`
- [ ] Node.js Version = 18.x veya 20.x
- [ ] GitHub Webhook aktif
- [ ] Empty commit ile test edildi
- [ ] Build cache temizlenerek redeploy yapıldı

