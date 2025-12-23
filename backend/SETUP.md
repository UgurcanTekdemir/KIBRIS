# Backend Kurulum ve Yapılandırma

## 🔧 Hızlı Kurulum

### 1. Gerekli Paketleri Yükleyin

```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Variables (.env dosyası oluşturun)

Backend klasöründe `.env` dosyası oluşturun:

```env
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=kibris_db

# CORS Configuration (frontend URL'lerini ekleyin)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# NosyAPI Configuration
NOSY_API_TOKEN=2zCF5YF9l3th90LYkR4hKeMWRLEictnmFPYm2TFt6Caj7sPKiROOOr3WBVRl
```

**ÖNEMLİ:** 
- `NOSY_API_TOKEN` değerini yukarıdaki token ile değiştirin
- MongoDB bağlantı bilgilerini kendi ayarlarınıza göre güncelleyin

### 3. Backend'i Başlatın

```bash
cd backend
uvicorn server:app --reload --port 8000
```

Backend başarıyla başladığında:
- API dokümantasyonu: http://localhost:8000/docs
- Test endpoint: http://localhost:8000/api/api-test

## 🧪 API Bağlantısını Test Etme

### 1. API Test Endpoint'i

Tarayıcıda veya Postman'de test edin:

```
GET http://localhost:8000/api/api-test
```

Bu endpoint API bağlantısını ve token'ı test eder.

### 2. Maçları Getirme Testi

```
GET http://localhost:8000/api/matches?match_type=1
```

Bugünün maçlarını getirmek için:

```
GET http://localhost:8000/api/matches?match_type=1&date=2025-01-15
```

(2025-01-15 yerine bugünün tarihini YYYY-MM-DD formatında kullanın)

## 📝 Notlar

- Backend otomatik olarak `.env` dosyasını yükler
- Token backend başlatıldığında yüklenir
- Herhangi bir hata durumunda backend loglarını kontrol edin

