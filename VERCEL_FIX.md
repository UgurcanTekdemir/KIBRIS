# Vercel 404 Hatası Çözümü

## Sorun
Vercel'de deploy sonrası 404 NOT_FOUND hatası alıyorsunuz.

## Çözüm

### 1. Vercel Dashboard Ayarları

Vercel Dashboard'da projenizin ayarlarına gidin:

1. **Settings** > **General** sekmesine gidin
2. **Root Directory** ayarını kontrol edin:
   - ✅ `frontend` olarak ayarlanmış olmalı

3. **Build & Development Settings** bölümünde:
   - **Framework Preset**: `Create React App` veya `Other`
   - **Build Command**: `npm run build` (otomatik algılanır)
   - **Output Directory**: `build` (otomatik algılanır)
   - **Install Command**: `npm install --legacy-peer-deps` ← **ÖNEMLİ**

### 2. vercel.json Dosyası

`frontend/vercel.json` dosyası doğru yapılandırılmış olmalı (zaten düzelttik).

### 3. Yeniden Deploy

1. Vercel Dashboard'da **Deployments** sekmesine gidin
2. Son deployment'ın yanındaki **...** menüsüne tıklayın
3. **Redeploy** seçeneğini seçin

VEYA

GitHub'a yeni bir commit push edin:
```bash
git add frontend/vercel.json
git commit -m "Fix Vercel routing configuration"
git push origin main
```

### 4. Alternatif: Vercel CLI ile Test

```bash
cd frontend
vercel --prod
```

## Kontrol Listesi

- [ ] `frontend/vercel.json` dosyası mevcut ve doğru yapılandırılmış
- [ ] Vercel Dashboard'da Root Directory = `frontend`
- [ ] Install Command = `npm install --legacy-peer-deps`
- [ ] Build Command = `npm run build`
- [ ] Output Directory = `build`
- [ ] Environment Variable `REACT_APP_API_URL` eklendi
- [ ] Yeniden deploy edildi

## Hala Çalışmıyorsa

1. **Build loglarını kontrol edin**: Vercel Dashboard > Deployments > Build Logs
2. **Browser console'u kontrol edin**: F12 > Console sekmesi
3. **Network sekmesini kontrol edin**: F12 > Network sekmesi
4. Vercel Support'a ulaşın veya [Vercel Discord](https://vercel.com/discord) community'ye sorun

