# Railway Deploy Hatası Düzeltme

## Sorun
Railway deploy sırasında `cd backend` komutunu çalıştırmaya çalışıyor ve hata veriyor:
```
/bin/bash: line 1: cd: backend: No such file or directory
```

## Çözüm Adımları

### 1. Railway Dashboard'da Root Directory Kontrolü
1. Railway dashboard'a gidin
2. Projenizi seçin
3. **Settings** sekmesine gidin
4. **Root Directory** bölümünü bulun
5. Değerin `backend` olduğundan emin olun
6. Eğer boşsa veya farklıysa, `backend` yazın ve kaydedin

### 2. Railway Dashboard'da Start Command Kontrolü
1. Railway dashboard → Projeniz → **Settings**
2. **Deploy** sekmesine gidin
3. **Start Command** bölümünü bulun
4. Değerin şu olması gerekiyor:
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
5. Eğer `cd backend && uvicorn...` şeklindeyse, `cd backend &&` kısmını silin
6. Sadece şunu bırakın:
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```

### 3. Railway.json Dosyası
`railway.json` dosyası güncellendi ve builder `RAILPACK` olarak ayarlandı. Bu dosya commit edilmeli.

### 4. Yeniden Deploy
1. Railway dashboard'da **Deployments** sekmesine gidin
2. **Redeploy** butonuna tıklayın veya yeni bir commit push edin
3. Build loglarını kontrol edin

## Önemli Notlar

- **Root Directory** ayarı `backend` olmalı
- **Start Command** içinde `cd backend` olmamalı
- Railway root directory'yi `backend` olarak ayarladığında, zaten backend klasöründesiniz
- `railway.json` dosyasındaki start command doğru ama Railway dashboard'daki override edebilir

## Kontrol Listesi

- [ ] Root Directory: `backend` olarak ayarlandı mı?
- [ ] Start Command: `cd backend` içermiyor mu?
- [ ] Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT` şeklinde mi?
- [ ] Environment Variables eklendi mi?
- [ ] MongoDB URL ayarlandı mı?


