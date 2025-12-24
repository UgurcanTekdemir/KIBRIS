# Canlı Maçlar Kurulum Rehberi

## The Odds API Ücretli Paket Gereksinimleri

Canlı maç skorlarını almak için **The Odds API'nin ücretli paketlerinden birine** abone olmanız gerekmektedir.

### Paket Seçenekleri

1. **20K Plan** - $30/ay
   - 20,000 kredi/ay
   - Canlı skorlar dahil ✅
   - Tüm sporlar ve bahis siteleri

2. **100K Plan** - $59/ay
   - 100,000 kredi/ay
   - Canlı skorlar dahil ✅
   - Tüm sporlar ve bahis siteleri

3. **5M Plan** - $119/ay
   - 5,000,000 kredi/ay
   - Canlı skorlar dahil ✅
   - Tüm sporlar ve bahis siteleri

4. **15M Plan** - $249/ay
   - 15,000,000 kredi/ay
   - Canlı skorlar dahil ✅
   - Tüm sporlar ve bahis siteleri

**Not:** Free plan (500 kredi/ay) canlı skorları **desteklemez**.

## Kurulum Adımları

### 1. The Odds API'ye Üye Olun

1. [The Odds API](https://the-odds-api.com/#get-access) sitesine gidin
2. Ücretli bir paket seçin ve abone olun
3. Email'inizde API key'inizi alacaksınız

### 2. API Key'i Güncelleyin

Backend `.env` dosyanızda `THE_ODDS_API_KEY` değerini yeni API key ile güncelleyin:

```bash
# backend/.env
THE_ODDS_API_KEY=your_new_paid_api_key_here
```

### 3. Backend'i Yeniden Başlatın

```bash
cd backend
python3 -m uvicorn server:app --reload --port 8000
```

### 4. Test Edin

Canlı maçları test etmek için:

```bash
# Backend endpoint'ini test edin
curl http://localhost:8000/api/matches/live
```

Eğer canlı maçlar varsa, response'da `is_live: true` ve skorlar görünecektir.

## Nasıl Çalışıyor?

### Backend (`the_odds_api.py`)

1. **`get_scores()`** metodu: The Odds API'nin `/scores` endpoint'ini kullanarak canlı skorları çeker
2. **`get_live_matches()`** metodu: Canlı skorları odds verileriyle birleştirir

### Frontend (`matchMapper.js`)

Mapper, Scores API'den gelen veriyi parse eder:
- `scores` array'inden home/away skorlarını çıkarır
- `completed: false` ise maçı canlı olarak işaretler
- `last_update` ve `commence_time` kullanarak dakika bilgisini hesaplar

### API Endpoint (`/api/matches/live`)

- Ücretli plan varsa: Canlı maçları skorlarla birlikte döner
- Free plan ise: Yakında başlayacak maçları döner (fallback)

## Önemli Notlar

1. **Kredi Kullanımı**: Her `/scores` isteği 1 kredi kullanır
2. **Update Sıklığı**: Canlı maçları her 30-60 saniyede bir güncellemeniz önerilir
3. **Rate Limiting**: API'nin rate limit'lerine dikkat edin
4. **Free Plan**: Free plan'da bu özellik çalışmaz, fallback olarak yakın maçlar gösterilir

## Sorun Giderme

### "Canlı maç bulunamadı" hatası

1. API key'inizin ücretli plana ait olduğundan emin olun
2. Backend loglarını kontrol edin: `Error fetching live matches`
3. The Odds API dashboard'unuzda kredi kullanımını kontrol edin

### Skorlar görünmüyor

1. Mapper'ın `scores` array'ini doğru parse ettiğinden emin olun
2. Browser console'da API response'u kontrol edin
3. `is_live: true` flag'inin geldiğini doğrulayın

## Daha Fazla Bilgi

- [The Odds API Documentation](https://the-odds-api.com/liveapi/guides/v4/#scores-endpoint)
- [Scores API Endpoint](https://the-odds-api.com/liveapi/guides/v4/#get-scores)




