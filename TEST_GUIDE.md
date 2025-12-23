# 🧪 API Test Rehberi

## Yöntem 1: Terminal/Command Line ile Test

### 1. Backend'i Başlatın

Yeni bir terminal penceresi açın ve:

```bash
cd /Users/uggrcn/KIBRIS-DEMO/KIBRIS/backend
pip install -r requirements.txt  # İlk defa çalıştırıyorsanız
uvicorn server:app --reload --port 8000
```

Backend başarıyla başladığında şunu göreceksiniz:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
INFO:     Started reloader process
```

### 2. Yeni Bir Terminal Penceresi Açın

Backend çalışırken, başka bir terminal penceresi açın ve test edin:

#### Test 1: API Bağlantı Testi
```bash
curl http://localhost:8000/api/test
```

#### Test 2: Maçları Getir (Bugünün Tarihi ile)
```bash
# Bugünün tarihini al (YYYY-MM-DD formatında)
curl "http://localhost:8000/api/matches?match_type=1"
```

#### Test 3: Belirli Bir Tarih ile Maçları Getir
```bash
curl "http://localhost:8000/api/matches?match_type=1&date=2025-01-15"
```

#### Test 4: Canlı Maçlar
```bash
curl "http://localhost:8000/api/matches/live?match_type=1"
```

---

## Yöntem 2: Tarayıcı ile Test

### 1. Backend'i Başlatın (Yukarıdaki gibi)

### 2. Tarayıcıda Açın

#### Test 1: API Test Endpoint
```
http://localhost:8000/api/test
```

#### Test 2: Maçları Getir
```
http://localhost:8000/api/matches?match_type=1
```

#### Test 3: Bugünün Maçları (tarihi değiştirin)
```
http://localhost:8000/api/matches?match_type=1&date=2025-01-15
```

#### Test 4: Swagger UI (İnteraktif API Dokümantasyonu)
```
http://localhost:8000/docs
```

Swagger UI'da:
- Tüm endpoint'leri görebilirsiniz
- Her endpoint'i direkt test edebilirsiniz
- Response'ları görebilirsiniz

---

## Yöntem 3: Postman ile Test

### 1. Postman'i Açın

### 2. Yeni Request Oluşturun

#### Test 1: API Bağlantı Testi
- **Method**: GET
- **URL**: `http://localhost:8000/api/test`
- **Send** butonuna tıklayın

#### Test 2: Maçları Getir
- **Method**: GET
- **URL**: `http://localhost:8000/api/matches`
- **Params** sekmesine geçin:
  - `match_type`: `1`
  - `date` (opsiyonel): `2025-01-15`
- **Send** butonuna tıklayın

---

## Beklenen Response Örnekleri

### Başarılı API Test Response:
```json
{
  "success": true,
  "message": "API connection successful",
  "api_response": { ... },
  "token_configured": true
}
```

### Maçlar Response:
```json
{
  "success": true,
  "data": [
    {
      "matchID": "123456",
      "homeTeam": "Galatasaray",
      "awayTeam": "Fenerbahçe",
      ...
    }
  ]
}
```

---

## Hata Durumları ve Çözümleri

### ❌ "Connection refused" Hatası
**Sebep**: Backend çalışmıyor
**Çözüm**: Backend'i başlatın (`uvicorn server:app --reload --port 8000`)

### ❌ "Module not found" Hatası
**Sebep**: Paketler yüklü değil
**Çözüm**: `pip install -r requirements.txt`

### ❌ "401 Unauthorized" veya API Hatası
**Sebep**: Token yanlış veya eksik
**Çözüm**: `.env` dosyasını kontrol edin, token'ın doğru olduğundan emin olun

### ❌ Port 8000 kullanımda
**Sebep**: Başka bir uygulama portu kullanıyor
**Çözüm**: 
```bash
# Portu kullanan işlemi bulun
lsof -i :8000
# İşlemi sonlandırın veya farklı bir port kullanın
uvicorn server:app --reload --port 8001
```

---

## Sonraki Adımlar

1. ✅ Backend'i başlatın
2. ✅ Test endpoint'lerini çağırın
3. ⏳ Response'ları inceleyin
4. ⏳ Response'ları bana gönderin (matchMapper.js'yi güncellemek için)
5. ⏳ Frontend'i test edin

---

## Hızlı Test Komutları (Tümünü Tek Seferde)

Backend çalışırken, yeni bir terminal'de:

```bash
# API Test
echo "=== API Test ==="
curl http://localhost:8000/api/test

# Maçlar
echo -e "\n=== Maçlar ==="
curl "http://localhost:8000/api/matches?match_type=1"

# Canlı Maçlar
echo -e "\n=== Canlı Maçlar ==="
curl "http://localhost:8000/api/matches/live?match_type=1"
```

