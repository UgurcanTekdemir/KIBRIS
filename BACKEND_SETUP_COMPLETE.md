# ✅ Backend Kurulumu Tamamlandı

## 📁 Oluşturulan Dosyalar

### `.env` Dosyası
✅ `backend/.env` dosyası oluşturuldu ve yapılandırıldı:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=kibris_db
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
NOSY_API_TOKEN=2zCF5YF9l3th90LYkR4hKeMWRLEictnmFPYm2TFt6Caj7sPKiROOOr3WBVRl
```

## 🚀 Backend'i Başlatma

### 1. Gerekli Paketleri Yükleyin

```bash
cd backend
pip install -r requirements.txt
```

**Not:** Eğer virtual environment kullanıyorsanız önce aktif edin:
```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
# veya
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Backend'i Başlatın

```bash
cd backend
uvicorn server:app --reload --port 8000
```

Backend başarıyla başladığında şu mesajı göreceksiniz:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

## 🧪 Test Endpoint'leri

### 1. API Bağlantı Testi

```
GET http://localhost:8000/api/test
```

Bu endpoint:
- NosyAPI bağlantısını test eder
- Token'ın doğru yapılandırıldığını kontrol eder
- API servis durumunu döner

### 2. Maçları Getirme

```
GET http://localhost:8000/api/matches?match_type=1
```

Bugünün maçları için (tarihi güncelleyin):
```
GET http://localhost:8000/api/matches?match_type=1&date=2025-01-15
```

### 3. Canlı Maçlar

```
GET http://localhost:8000/api/matches/live?match_type=1
```

### 4. Maç Detayı

```
GET http://localhost:8000/api/matches/{match_id}
```

Örnek:
```
GET http://localhost:8000/api/matches/122626
```

## 📚 API Dokümantasyonu

Backend çalışırken Swagger UI:
```
http://localhost:8000/docs
```

Alternatif ReDoc dokümantasyonu:
```
http://localhost:8000/redoc
```

## ⚠️ Önemli Notlar

1. **MongoDB**: MongoDB'nin çalıştığından emin olun. Eğer farklı bir MongoDB URL'i kullanıyorsanız `.env` dosyasındaki `MONGO_URL` değerini güncelleyin.

2. **CORS**: Frontend farklı bir portta çalışıyorsa, `.env` dosyasındaki `CORS_ORIGINS` değerine ekleyin.

3. **API Token**: Token doğru şekilde yapılandırıldı. Eğer API çağrıları başarısız olursa token'ın geçerli olduğundan emin olun.

## 🔍 Sorun Giderme

### Backend başlamıyor

1. Port 8000 kullanımda mı kontrol edin:
```bash
lsof -i :8000
```

2. Gerekli paketler kurulu mu kontrol edin:
```bash
pip list | grep -E "fastapi|uvicorn|httpx|dotenv"
```

### API çağrıları başarısız

1. Token'ın doğru yüklendiğini kontrol edin:
```bash
cd backend
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('NOSY_API_TOKEN'))"
```

2. NosyAPI servis durumunu kontrol edin:
```
http://localhost:8000/api/test
```

## 📝 Sonraki Adımlar

1. ✅ Backend'i başlatın
2. ⏳ API test endpoint'ini çağırın ve sonucu kontrol edin
3. ⏳ Gerçek API response'larını görüp `matchMapper.js` dosyasını güncelleyelim
4. ⏳ Frontend ile entegrasyonu test edelim

