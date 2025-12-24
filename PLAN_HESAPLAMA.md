# The Odds API Plan Hesaplama - 300 Kullanıcı İçin

## Kullanım Senaryoları

### Senaryo 1: Normal Kullanım (Canlı Maçlar Polling Yok)
- **300 kullanıcı/ay**
- Ortalama **5 sayfa görüntüleme/kullanıcı**
- Her sayfa **1 API request**
- Refresh ve navigasyon için **2x multiplier**
- **Toplam: 300 × 5 × 2 = 3,000 request/ay**

### Senaryo 2: Canlı Maçlar Polling İle (Önerilen)
- Canlı maçlar sayfasında **30 saniyede bir** otomatik refresh
- Bir kullanıcı canlı maçlar sayfasında **5 dakika** kalırsa: **10 request**
- 300 kullanıcının **%20'si** canlı maçlar sayfasını ziyaret ederse: **60 kullanıcı**
- Canlı maçlar için ekstra: **60 × 10 = 600 request**
- Normal kullanım: **3,000 request**
- **Toplam: 3,600 request/ay**

### Senaryo 3: Aktif Kullanım (Büyüme Senaryosu)
- **300 kullanıcı**
- Ortalama **10 sayfa/kullanıcı**
- Canlı maçlar polling dahil
- **Toplam: 300 × 10 × 1.5 = 4,500 request/ay**

## Önerilen Plan: **20K Plan ($30/ay)**

### Neden 20K Plan?
✅ **20,000 kredi/ay** - Normal ve aktif kullanım için yeterli  
✅ **Canlı skorlar dahil** - Scores API erişimi var  
✅ **Tüm sporlar ve bahis siteleri** - Tam özellik seti  
✅ **Maliyet-etkin** - En uygun ücretli plan  
✅ **Büyüme payı** - 300 kullanıcıdan 500'e çıkarsanız bile yeterli  

### Kredi Kullanım Tahmini
- **Tahmini kullanım:** 3,600 - 4,500 request/ay
- **20K plan limiti:** 20,000 request/ay
- **Kullanım oranı:** ~18-22% (güvenli marj)

## Alternatif: 100K Plan ($59/ay)

### Ne Zaman 100K Plan?
- Kullanıcı sayısı **500+** olursa
- Canlı maçlar polling'i **daha sık** yapmak isterseniz (örn: 15 saniye)
- **Çoklu lig** desteği ekleyecekseniz
- **Gelecek büyüme** planlarınız varsa

## Kredi Tasarrufu İpuçları

### 1. Backend Caching (Önerilen)
```python
# Backend'de 30-60 saniye cache ekleyin
# Aynı request 30 saniye içinde tekrar gelirse cache'den döner
# Kredi kullanımını %50-70 azaltır
```

### 2. Polling Interval'i Ayarlayın
```javascript
// frontend/src/hooks/useLiveMatches.js
// 30 saniye yerine 60 saniye yaparsanız kullanım yarıya iner
const interval = setInterval(() => {
  fetchLiveMatches();
}, 60000); // 60 saniye
```

### 3. Sadece Aktif Kullanıcılar İçin Polling
- Sayfa görünür değilse polling'i durdurun
- Kullanıcı başka sayfaya geçtiğinde polling'i durdurun

## Sonuç ve Öneri

**300 kullanıcı için: 20K Plan ($30/ay) yeterli ve önerilir**

- ✅ Maliyet-etkin
- ✅ İhtiyacınızı karşılar
- ✅ Büyüme payı var
- ✅ Canlı skorlar dahil

**İleride büyürseniz:** 100K plan'a kolayca geçiş yapabilirsiniz.




