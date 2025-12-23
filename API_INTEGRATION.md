# NosyAPI Entegrasyonu - Kurulum ve Kullanım Kılavuzu

## 📋 Özet

NosyAPI entegrasyonu tamamlandı. Backend ve frontend'de gerekli servis katmanları oluşturuldu.

## 🔧 Kurulum

### 1. Backend Kurulumu

#### Gerekli paketleri yükleyin:
```bash
cd backend
pip install -r requirements.txt
```

#### Environment Variables

Backend klasöründe `.env` dosyası oluşturun (veya mevcut dosyaya ekleyin):

```env
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=kibris_db

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# NosyAPI Configuration
NOSY_API_TOKEN=your_nosyapi_token_here
```

**ÖNEMLİ:** `NOSY_API_TOKEN` değerini gerçek NosyAPI token'ınızla değiştirin.

### 2. Frontend Kurulumu

#### Environment Variables (Opsiyonel)

Frontend'de `.env` dosyası oluşturarak backend URL'ini özelleştirebilirsiniz:

```env
REACT_APP_API_URL=http://localhost:8000/api
```

Varsayılan olarak `http://localhost:8000/api` kullanılır.

## 📁 Oluşturulan Dosyalar

### Backend
- `backend/nosy_api.py` - NosyAPI servis katmanı
- `backend/server.py` - Match endpoint'leri eklendi

### Frontend
- `frontend/src/services/api.js` - API servis katmanı
- `frontend/src/utils/matchMapper.js` - API response mapping fonksiyonları
- `frontend/src/hooks/useMatches.js` - Custom React hooks (useMatches, useLiveMatches, useMatchDetails)

### Güncellenen Dosyalar
- `frontend/src/pages/MatchesPage.jsx` - API entegrasyonu ile güncellendi
- `frontend/src/pages/LiveMatchesPage.jsx` - API entegrasyonu ile güncellendi
- `frontend/src/pages/MatchDetailPage.jsx` - API entegrasyonu ile güncellendi

## 🔌 API Endpoint'leri

### Backend Endpoints (FastAPI)

Tüm endpoint'ler `/api` prefix'i ile başlar:

- `GET /api/matches` - Tüm maçları getir
  - Query params: `match_type`, `league`, `date`, `country`
  
- `GET /api/matches/live` - Canlı maçları getir
  - Query params: `match_type`
  
- `GET /api/matches/{match_id}` - Maç detaylarını getir
  
- `GET /api/matches/popular` - Popüler maçları getir
  - Query params: `match_type`
  
- `GET /api/leagues` - Ligleri getir
  - Query params: `match_type`, `country`
  
- `GET /api/countries` - Ülkeleri getir
  - Query params: `match_type`

## 🎯 Kullanım

### Frontend'de API Kullanımı

#### 1. useMatches Hook

```jsx
import { useMatches } from '../hooks/useMatches';

function MyComponent() {
  const { matches, loading, error, refetch } = useMatches({
    matchType: 1,
    date: '2025-01-15',
    league: 'Türkiye Süper Lig'
  });

  if (loading) return <div>Yükleniyor...</div>;
  if (error) return <div>Hata: {error}</div>;

  return (
    <div>
      {matches.map(match => (
        <div key={match.id}>{match.homeTeam} vs {match.awayTeam}</div>
      ))}
    </div>
  );
}
```

#### 2. useLiveMatches Hook

```jsx
import { useLiveMatches } from '../hooks/useMatches';

function LiveMatchesComponent() {
  // Otomatik olarak 30 saniyede bir yenilenir
  const { matches, loading, error, refetch } = useLiveMatches(1);

  // ...
}
```

#### 3. Direkt API Servis Kullanımı

```jsx
import { matchAPI } from '../services/api';

// Maçları getir
const matches = await matchAPI.getMatches({
  matchType: 1,
  date: '2025-01-15'
});

// Canlı maçları getir
const liveMatches = await matchAPI.getLiveMatches(1);

// Maç detayı getir
const details = await matchAPI.getMatchDetails('122626');
```

## ⚠️ ÖNEMLİ NOTLAR

### API Response Mapping

**`matchMapper.js` dosyasındaki mapping fonksiyonları placeholder olarak yazılmıştır.**

Gerçek NosyAPI response yapısını görmeden tam mapping yapılamaz. Aşağıdaki örnek response'ları sağladığınızda mapping fonksiyonlarını güncelleyeceğiz:

1. `GET /bettable-matches` endpoint'inden dönen örnek response
2. `GET /bettable-matches/details?matchID=122626` endpoint'inden dönen örnek response

Bu response'ları aldıktan sonra `matchMapper.js` dosyasındaki fonksiyonları gerçek API yapısına göre güncelleyeceğiz.

### Canlı Maç Tespiti

Canlı maçların nasıl tespit edileceği API response'una bağlıdır. Şu anda birkaç yöntem deniyor:
- API'den gelen `isLive` veya `status` alanı
- Maç zamanı ile şu anki zamanın karşılaştırılması
- `minute` alanının varlığı

API response'larını gördükten sonra bu mantığı optimize edeceğiz.

## 🧪 Test Etme

### 1. Backend'i Başlatın

```bash
cd backend
uvicorn server:app --reload --port 8000
```

### 2. Frontend'i Başlatın

```bash
cd frontend
npm start
```

### 3. API Token'ı Kontrol Edin

Backend'de `.env` dosyasında `NOSY_API_TOKEN` değerinin doğru olduğundan emin olun.

### 4. Test Endpoint'i

Tarayıcıda veya Postman'de test edin:

```
http://localhost:8000/api/matches?match_type=1
```

## 🔄 Sonraki Adımlar

1. ✅ API token'ı `.env` dosyasına ekleyin
2. ⏳ Gerçek API response örneklerini sağlayın
3. ⏳ `matchMapper.js` dosyasını gerçek response yapısına göre güncelleyelim
4. ⏳ Test edelim ve gerekli düzeltmeleri yapalım

## 📞 Destek

Sorularınız için:
- Backend endpoint'leri: `backend/server.py` ve `backend/nosy_api.py`
- Frontend API servisleri: `frontend/src/services/api.js`
- Mapping fonksiyonları: `frontend/src/utils/matchMapper.js`

