# ⚡ Hızlı Başlangıç - Test Etme

## 🎯 En Kolay Yöntem

### Adım 1: Backend'i Başlat

Terminal'de:

```bash
./start_backend.sh
```

Veya manuel olarak:

```bash
cd backend
uvicorn server:app --reload --port 8000
```

### Adım 2: Yeni Terminal Aç ve Test Et

Backend çalışırken, **yeni bir terminal penceresi** açın ve:

```bash
./test_api.sh
```

Bu script otomatik olarak:
- ✅ Backend'in çalışıp çalışmadığını kontrol eder
- ✅ API bağlantı testini yapar
- ✅ Maçları getirir
- ✅ Canlı maçları getirir

---

## 🌐 Tarayıcı ile Test (En Kolay)

### 1. Backend'i Başlat (yukarıdaki gibi)

### 2. Tarayıcıda Aç

#### API Test:
```
http://localhost:8000/api/test
```

#### Swagger UI (Tüm endpoint'ler interaktif):
```
http://localhost:8000/docs
```

Swagger UI'da:
- Tüm endpoint'leri görebilirsiniz
- "Try it out" butonuna tıklayarak test edebilirsiniz
- Response'ları direkt görebilirsiniz

#### Maçları Getir:
```
http://localhost:8000/api/matches?match_type=1
```

---

## 📋 Manuel Test Komutları

### Terminal'de (curl ile):

```bash
# 1. API Test
curl http://localhost:8000/api/test

# 2. Maçları Getir
curl "http://localhost:8000/api/matches?match_type=1"

# 3. Bugünün Maçları (tarihi değiştirin)
curl "http://localhost:8000/api/matches?match_type=1&date=2025-01-15"

# 4. Canlı Maçlar
curl "http://localhost:8000/api/matches/live?match_type=1"
```

---

## ✅ Başarılı Test Sonucu

### API Test Response Örneği:
```json
{
  "success": true,
  "message": "API connection successful",
  "token_configured": true,
  "api_response": { ... }
}
```

### Maçlar Response Örneği:
```json
{
  "success": true,
  "data": [
    {
      "matchID": "123456",
      "homeTeam": "...",
      "awayTeam": "...",
      ...
    }
  ]
}
```

---

## ❌ Hata Durumları

### "Connection refused"
→ Backend çalışmıyor, `./start_backend.sh` ile başlatın

### "Module not found"
→ `cd backend && pip install -r requirements.txt`

### Port 8000 kullanımda
→ Farklı port kullanın: `uvicorn server:app --reload --port 8001`

---

## 🎯 Sonraki Adım

Test sonuçlarını (response'ları) bana gönderin, `matchMapper.js` dosyasını gerçek API yapısına göre güncelleyelim!

