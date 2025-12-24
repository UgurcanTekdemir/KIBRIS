# API Entegrasyonları - Kurulum ve Kullanım Kılavuzu

## 📋 Özet

Projede birden fazla API entegrasyonu mevcuttur:
- **NosyAPI** - Bahis maçları ve oranları
- **The Odds API** - Bahis oranları ve canlı skorlar
- **StatPal API** - Futbol canlı skorları ve maç verileri

Backend ve frontend'de gerekli servis katmanları oluşturuldu.

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

# The Odds API Configuration
THE_ODDS_API_KEY=your_the_odds_api_key_here

# StatPal API Configuration
STATPAL_API_KEY=your_statpal_api_key_here
```

**ÖNEMLİ:** 
- `NOSY_API_TOKEN` değerini gerçek NosyAPI token'ınızla değiştirin.
- `THE_ODDS_API_KEY` değerini gerçek The Odds API key'inizle değiştirin.
- `STATPAL_API_KEY` değerini gerçek StatPal API key'inizle değiştirin (örn: `75d51040-917d-4a51-a957-4fa2222cc9f3`).

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
- `backend/the_odds_api.py` - The Odds API servis katmanı
- `backend/statpal_api.py` - StatPal API servis katmanı
- `backend/server.py` - Tüm API endpoint'leri eklendi

### Frontend
- `frontend/src/services/api.js` - API servis katmanı (matchAPI, statpalAPI, bannerAPI)
- `frontend/src/utils/matchMapper.js` - API response mapping fonksiyonları
- `frontend/src/hooks/useMatches.js` - Custom React hooks (useMatches, useLiveMatches, useMatchDetails)

### Güncellenen Dosyalar
- `frontend/src/pages/MatchesPage.jsx` - API entegrasyonu ile güncellendi
- `frontend/src/pages/LiveMatchesPage.jsx` - API entegrasyonu ile güncellendi
- `frontend/src/pages/MatchDetailPage.jsx` - API entegrasyonu ile güncellendi

## 🔌 API Endpoint'leri

### Backend Endpoints (FastAPI)

Tüm endpoint'ler `/api` prefix'i ile başlar:

#### The Odds API Endpoints
- `GET /api/matches` - Tüm maçları getir (The Odds API)
  - Query params: `match_type`, `league`, `date`, `country`
  
- `GET /api/matches/live` - Canlı maçları getir (The Odds API)
  - Query params: `match_type`
  
- `GET /api/matches/{match_id}` - Maç detaylarını getir (The Odds API)
  
- `GET /api/matches/popular` - Popüler maçları getir (The Odds API)
  - Query params: `match_type`
  
- `GET /api/leagues` - Ligleri getir (The Odds API)
  - Query params: `match_type`, `country`
  
- `GET /api/countries` - Ülkeleri getir (The Odds API)
  - Query params: `match_type`

#### StatPal API Endpoints
- `GET /api/matches/statpal` - Futbol maçlarını getir (StatPal API)
  - Query params: `date` (YYYY-MM-DD), `league_id`, `team_id`
  
- `GET /api/matches/statpal/live` - Canlı futbol maçlarını getir (StatPal API)
  
- `GET /api/matches/statpal/{match_id}` - Maç detaylarını getir (StatPal API)
  
- `GET /api/leagues/statpal` - Ligleri getir (StatPal API)
  
- `GET /api/teams/statpal` - Takımları getir (StatPal API)
  - Query params: `league_id` (opsiyonel)
  
- `GET /api/standings/statpal/{league_id}` - Lig sıralamasını getir (StatPal API)

#### Test Endpoints
- `GET /api/test` - NosyAPI bağlantısını test et
- `GET /api/test-odds-api` - The Odds API bağlantısını test et
- `GET /api/test-statpal` - StatPal API bağlantısını test et

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

**The Odds API:**
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

**StatPal API:**
```jsx
import { statpalAPI } from '../services/api';

// Maçları getir
const matches = await statpalAPI.getMatches({
  date: '2025-01-15',
  leagueId: 123
});

// Canlı maçları getir
const liveMatches = await statpalAPI.getLiveMatches();

// Maç detayı getir
const details = await statpalAPI.getMatchDetails('match_123');

// Ligleri getir
const leagues = await statpalAPI.getLeagues();

// Takımları getir
const teams = await statpalAPI.getTeams({ leagueId: 123 });

// Lig sıralaması getir
const standings = await statpalAPI.getStandings(123);
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

### 3. API Key'leri Kontrol Edin

Backend'de `.env` dosyasında tüm API key'lerin doğru olduğundan emin olun:
- `NOSY_API_TOKEN`
- `THE_ODDS_API_KEY`
- `STATPAL_API_KEY`

### 4. Test Endpoint'leri

Tarayıcıda veya Postman'de test edin:

**The Odds API:**
```
http://localhost:8000/api/matches?match_type=1
http://localhost:8000/api/test-odds-api
```

**StatPal API:**
```
http://localhost:8000/api/matches/statpal/live
http://localhost:8000/api/test-statpal
```

## 🔄 Sonraki Adımlar

1. ✅ API key'leri `.env` dosyasına ekleyin
2. ⏳ Gerçek API response örneklerini sağlayın
3. ⏳ `matchMapper.js` dosyasını gerçek response yapısına göre güncelleyelim
4. ⏳ Test edelim ve gerekli düzeltmeleri yapalım

## 📞 Destek

Sorularınız için:
- Backend endpoint'leri: `backend/server.py`
- Backend API servisleri: 
  - `backend/nosy_api.py` (NosyAPI)
  - `backend/the_odds_api.py` (The Odds API)
  - `backend/statpal_api.py` (StatPal API)
- Frontend API servisleri: `frontend/src/services/api.js`
- Mapping fonksiyonları: `frontend/src/utils/matchMapper.js`

## 📚 StatPal API Hakkında

StatPal API, futbol canlı skorları ve maç verileri sağlar. API dokümantasyonu için:
- Base URL: `https://statpal.io/api/v2`
- Authentication: `access_key` query parameter
- Örnek endpoint: `/soccer/matches/live?access_key=YOUR_ACCESS_KEY`

Daha fazla bilgi için [StatPal Quick Start Tutorial](https://statpal.io/quick-start-tutorial/) sayfasını ziyaret edebilirsiniz.

