# 🧪 API Test Rehberi (MongoDB Olmadan)

## ✅ Durum

Backend MongoDB olmadan çalışacak şekilde yapılandırıldı. Sadece NosyAPI entegrasyonunu test edeceğiz.

## 🚀 Backend'i Başlatma

### Yöntem 1: Basit Script (Önerilen)

```bash
cd backend
./start_backend_simple.sh
```

### Yöntem 2: Manuel

```bash
cd backend
python3 -m uvicorn server:app --reload --port 8000
```

## 🧪 API Test Endpoint'leri

### 1. API Bağlantı Testi

**Tarayıcı:**
```
http://localhost:8000/api/test
```

**curl:**
```bash
curl http://localhost:8000/api/test
```

**Beklenen Response:**
```json
{
  "success": true,
  "message": "API connection successful",
  "token_configured": true,
  "api_response": { ... }
}
```

### 2. Maçları Getir

**Tarayıcı:**
```
http://localhost:8000/api/matches?match_type=1
```

**Bugünün maçları (tarihi güncelleyin):**
```
http://localhost:8000/api/matches?match_type=1&date=2025-01-15
```

**curl:**
```bash
curl "http://localhost:8000/api/matches?match_type=1"
```

### 3. Canlı Maçlar

**Tarayıcı:**
```
http://localhost:8000/api/matches/live?match_type=1
```

**curl:**
```bash
curl "http://localhost:8000/api/matches/live?match_type=1"
```

### 4. Swagger UI (İnteraktif Test)

**Tarayıcı:**
```
http://localhost:8000/docs
```

Swagger UI'da tüm endpoint'leri görebilir ve test edebilirsiniz.

## 📋 Test Adımları

1. ✅ Backend'i başlatın
2. ✅ Tarayıcıda `http://localhost:8000/api/test` açın
3. ✅ API bağlantısının başarılı olduğunu kontrol edin
4. ✅ `http://localhost:8000/api/matches?match_type=1` ile maçları getirin
5. ✅ Response'u kontrol edin ve bana gönderin (matchMapper.js'yi güncellemek için)

## ⚠️ Notlar

- MongoDB bağlantısı optional, hata vermeyecek
- Sadece `/api/status` endpoint'leri MongoDB gerektirir (bunları kullanmayacağız)
- Tüm match endpoint'leri MongoDB olmadan çalışır

## 🎯 Sonraki Adımlar

1. Backend'i başlatın
2. API response'larını test edin
3. Response'ları bana gönderin
4. Frontend'i test edelim

