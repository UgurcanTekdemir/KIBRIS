# KIBRIS - Spor Bahis Platformu

## 📋 Proje Hakkında

KIBRIS, Sportmonks V3 API kullanarak futbol maçları, oranlar ve istatistikleri gösteren bir spor bahis platformudur.

## 🚀 Hızlı Başlatma

### Backend (FastAPI)
```bash
cd backend
python3 -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Backend API: `http://localhost:8000/api`
API Dokümantasyonu: `http://localhost:8000/docs`

### Frontend (React)

### Yöntem 1: Script ile (En Kolay)
```bash
./start.sh
```

### Yöntem 2: npm ile
```bash
cd frontend
npm start
```

### Yöntem 3: npm dev ile
```bash
cd frontend
npm run dev
```

**Not:** Sunucu otomatik olarak **port 3001**'de başlar. Tarayıcıda `http://localhost:3001` adresini açın.

## 📋 İlk Kurulum (Sadece İlk Seferinde)

Eğer daha önce bağımlılıkları yüklemediyseniz:

```bash
cd frontend
npm install --legacy-peer-deps
```

## 🛠️ Teknik Detaylar

- **Framework:** React 19
- **Build Tool:** Create React App + CRACO
- **UI Library:** Radix UI + Tailwind CSS
- **Routing:** React Router v7
- **Port:** 3001 (otomatik)

## 📝 Notlar

- Port 3001 kullanılıyorsa, React otomatik olarak bir sonraki boş portu kullanır
- Hot reload aktif - kod değişiklikleri otomatik yansır
- Development modunda çalışır

## 🧪 Test ve Doğrulama

### API Test Scripti

Proje root dizininde `test_api.py` scripti bulunmaktadır. Bu script ile API'leri test edebilirsiniz:

```bash
python3 test_api.py
```

Script şunları test eder:
- Health check endpoint
- Tüm maçlar (bugün + 7 gün)
- Canlı maçlar
- Ligler
- Maç detayları ve odds

### Test Edilmesi Gerekenler

#### ✅ Tamamlanan İyileştirmeler

1. **Backend Odds Include Parametreleri**
   - ✅ Nested include parametreleri eklendi (`odds.bookmaker;odds.market;odds.values`)
   - ✅ Tüm endpoint'lerde güncellendi

2. **Backend Odds Transformasyonu**
   - ✅ `_extract_and_normalize_odds()` fonksiyonu eklendi
   - ✅ Sportmonks V3 nested format doğru parse ediliyor

3. **Frontend Odds Extraction**
   - ✅ Backend'den gelen normalize format handle ediliyor
   - ✅ Tüm market tipleri gösteriliyor

4. **Market Mapping**
   - ✅ 30+ market tipi için Türkçe çeviri eklendi

5. **Maç Detayları**
   - ✅ Loading ve error state'leri iyileştirildi
   - ✅ İstatistikler, olaylar, kadrolar için include parametreleri genişletildi

6. **Performans Optimizasyonu**
   - ✅ Cache time'ları optimize edildi
   - ✅ Refetch interval'ları ayarlandı

#### ⚠️ Test Edilmesi Gerekenler (Kritik)

1. **Odds Verilerinin Match Detail'de Görünmemesi**
   - **Sorun**: `/matches/{id}/odds` endpoint'inden odds geliyor (285+ odds) ama `/matches/{id}` endpoint'inden dönen match detail'de odds array'i boş geliyor
   - **Test**: 
     - Bir maç ID'si ile `/api/matches/{id}` endpoint'ini çağırın
     - `odds` field'ının dolu olup olmadığını kontrol edin
     - `/api/matches/{id}/odds` endpoint'inden gelen odds'ların match detail'e dahil edilip edilmediğini kontrol edin
   - **Beklenen**: Match detail'de odds array'i dolu olmalı

2. **API Timeout Sorunları**
   - **Sorun**: Yavaş internet bağlantılarında `/matches` endpoint'i timeout veriyor (30-120 saniye)
   - **Test**:
     - Yavaş internet bağlantısında `/api/matches` endpoint'ini test edin
     - Timeout süresini artırın veya pagination ekleyin
   - **Öneri**: Pagination veya daha küçük date range'ler kullanılabilir

3. **Odds Normalizasyonu**
   - **Test**: 
     - Backend'den gelen odds formatının frontend'de doğru parse edildiğini kontrol edin
     - Tüm market tiplerinin (BTTS, Over/Under, Double Chance, vb.) gösterildiğini doğrula
     - Odds değerlerinin doğru formatta (number) olduğunu kontrol edin

4. **Maç Listesi Odds Gösterimi**
   - **Test**:
     - Ana sayfada ve maç listesinde odds'ların gözüktüğünü kontrol edin
     - Sadece 1X2 değil, diğer marketlerin de gösterildiğini doğrula
   - **Beklenen**: Tüm marketler (BTTS, Over/Under, vb.) gösterilmeli

5. **Canlı Maç Odds Güncellemeleri**
   - **Test**:
     - Canlı bir maç seçin
     - Odds'ların otomatik güncellenip güncellenmediğini kontrol edin
     - Odds değişikliklerinin gösterildiğini doğrula

6. **Maç Detayları İstatistikler**
   - **Test**:
     - Canlı veya bitmiş bir maçın detay sayfasına gidin
     - İstatistiklerin (possession, shots, corners) gösterildiğini kontrol edin
     - İstatistiklerin doğru formatta olduğunu doğrula

7. **Maç Detayları Olaylar**
   - **Test**:
     - Canlı veya bitmiş bir maçın olaylarını kontrol edin
     - Gol, kart, değişiklik gibi olayların gösterildiğini doğrula
     - Olayların doğru sırada (zaman bazlı) olduğunu kontrol edin

8. **Maç Detayları Kadrolar**
   - **Test**:
     - Bir maçın kadro bilgilerini kontrol edin
     - Starting XI ve yedeklerin gösterildiğini doğrula

#### 🔍 Bilinen Sorunlar ve Eksikler

1. **Match Detail'de Odds Eksik**
   - **Durum**: `/matches/{id}` endpoint'inden dönen match object'inde odds array'i boş
   - **Sebep**: `_transform_fixture_to_match` fonksiyonunda odds extraction çalışıyor ama match detail endpoint'inde normalize edilmiş odds'lar match object'ine eklenmiyor olabilir
   - **Çözüm**: `server.py`'deki `get_match_details` endpoint'inde odds'ların normalize edilmiş halinin match object'ine eklenmesi gerekebilir

2. **API Response Time**
   - **Durum**: `/matches` endpoint'i çok sayıda maç çektiğinde yavaş olabiliyor
   - **Sebep**: Her gün için ayrı API çağrısı yapılıyor (7 gün = 7 çağrı)
   - **Öneri**: 
     - Pagination eklenebilir
     - Date range sınırlandırılabilir
     - Paralel istekler optimize edilebilir

3. **Odds Market Filtreleme**
   - **Durum**: `/matches/{id}/odds` endpoint'inde sadece popüler marketler filtreleniyor
   - **Not**: Bu bilinçli bir tercih olabilir, ancak tüm marketlerin gösterilmesi isteniyorsa filtreleme kaldırılmalı

4. **Error Handling**
   - **Durum**: Bazı endpoint'lerde error handling eksik olabilir
   - **Test**: Hatalı match ID, network hataları, API rate limit gibi durumları test edin

5. **Frontend Odds Display**
   - **Durum**: Frontend'de odds'ların gösterilip gösterilmediği tam test edilmedi
   - **Test**: 
     - Ana sayfada odds'ların gözüktüğünü kontrol edin
     - Match card'larda odds'ların gösterildiğini doğrula
     - Match detail sayfasında tüm marketlerin gösterildiğini kontrol edin

### Test Senaryoları

#### Senaryo 1: Ana Sayfa - Maç Listesi
1. Ana sayfayı açın
2. Maç listesinde odds'ların gözüktüğünü kontrol edin
3. Farklı market tiplerinin (1X2, BTTS, Over/Under) gösterildiğini doğrula

#### Senaryo 2: Maç Detay Sayfası
1. Bir maça tıklayın
2. Odds sekmesinde tüm marketlerin gösterildiğini kontrol edin
3. Her market'in seçeneklerinin (options) gösterildiğini doğrula
4. Odds değerlerinin doğru olduğunu kontrol edin

#### Senaryo 3: Canlı Maç
1. Canlı bir maç seçin
2. Olaylar sekmesinde gol, kart gibi olayların gösterildiğini kontrol edin
3. İstatistikler sekmesinde possession, shots gibi istatistiklerin gösterildiğini doğrula
4. Odds'ların güncellendiğini kontrol edin

#### Senaryo 4: API Endpoint Testleri
```bash
# Health check
curl http://localhost:8000/api/health

# Tüm maçlar
curl "http://localhost:8000/api/matches?date_from=2025-12-28&date_to=2026-01-04"

# Canlı maçlar
curl http://localhost:8000/api/matches/live

# Maç detayları (bir match ID ile)
curl http://localhost:8000/api/matches/19577561

# Maç odds'ları
curl http://localhost:8000/api/matches/19577561/odds

# Ligler
curl http://localhost:8000/api/leagues
```

### Performans Testleri

1. **API Response Time**
   - `/matches` endpoint'inin response time'ını ölçün
   - 7 günlük veri için < 10 saniye hedeflenmeli

2. **Frontend Load Time**
   - Ana sayfanın yüklenme süresini ölçün
   - İlk render < 3 saniye hedeflenmeli

3. **Odds Update Frequency**
   - Canlı maçlarda odds'ların ne sıklıkla güncellendiğini kontrol edin
   - 20 saniye interval uygun görünüyor

### Sonraki Adımlar

1. ✅ Backend odds include parametreleri güncellendi
2. ✅ Backend odds transformasyonu iyileştirildi
3. ✅ Frontend odds extraction güncellendi
4. ✅ Market mapping genişletildi
5. ⚠️ **Match detail'de odds'ların gösterilmesi test edilmeli**
6. ⚠️ **API timeout sorunları çözülmeli**
7. ⚠️ **Frontend'de odds'ların gösterilmesi doğrulanmalı**
8. ⚠️ **Tüm market tiplerinin çalıştığı test edilmeli**

## 📝 Notlar

- Port 3001 kullanılıyorsa, React otomatik olarak bir sonraki boş portu kullanır
- Hot reload aktif - kod değişiklikleri otomatik yansır
- Development modunda çalışır
- Backend ve Frontend aynı anda çalışmalı (Backend: 8000, Frontend: 3000/3001)
