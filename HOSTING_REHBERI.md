# 🌍 Hosting Rehberi - Yasal Olmayan Bahis Siteleri İçin

## ⚠️ ÖNEMLİ YASAL UYARI

Bu rehber sadece teknik bilgi amaçlıdır. Yasal olmayan bahis siteleri birçok ülkede yasaktır ve ciddi yasal sonuçlara yol açabilir. Bu tür bir siteyi barındırmadan önce mutlaka yasal danışmanlık alın.

## 🎯 Offshore Hosting Seçenekleri

### 1. **Offshore VPS/Cloud Providers** (Önerilen)

#### A. **FlokiNET** (İzlanda)
- ✅ DMCA'ya uymaz
- ✅ Anonimlik odaklı
- ✅ Bitcoin ödeme kabul eder
- ✅ Güçlü gizlilik politikası
- 💰 Fiyat: €5-50/ay
- 🌐 Website: flokinet.is

#### B. **Shinjiru** (Malezya)
- ✅ Offshore hosting uzmanı
- ✅ Bahis siteleri için özel paketler
- ✅ DMCA koruması
- ✅ 7/24 destek
- 💰 Fiyat: $10-100/ay
- 🌐 Website: shinjiru.com

#### C. **AbeloHost** (Hollanda)
- ✅ DMCA'ya uymaz
- ✅ Güçlü gizlilik
- ✅ Offshore VPS
- ✅ Bitcoin ödeme
- 💰 Fiyat: €5-40/ay
- 🌐 Website: abelohost.com

#### D. **1984 Hosting** (İzlanda)
- ✅ Güçlü gizlilik yasaları
- ✅ DMCA koruması
- ✅ Offshore VPS
- ✅ Anonim ödeme
- 💰 Fiyat: €5-50/ay
- 🌐 Website: 1984.hosting

### 2. **Bulgaristan/Romanya Hosting**

#### **HostKey** (Bulgaristan)
- ✅ Avrupa'da ama esnek yasalar
- ✅ Uygun fiyatlı
- ✅ Güçlü altyapı
- 💰 Fiyat: $5-30/ay

### 3. **Rusya/Kazakistan Hosting**

#### **Timeweb** (Rusya)
- ✅ Esnek içerik politikası
- ✅ Uygun fiyatlı
- ✅ Güçlü altyapı
- ⚠️ Yaptırımlar nedeniyle ödeme zorluğu olabilir
- 💰 Fiyat: ₽200-2000/ay

## 🏗️ Mimari Önerileri

### Önerilen Yapı:

```
Frontend (Static) → CDN → Offshore VPS
Backend (API) → Offshore VPS
Database → Offshore VPS (veya ayrı offshore DB)
```

### 1. **Frontend Hosting**

**Seçenek A: Offshore VPS + Nginx**
- Statik dosyaları Nginx ile serve edin
- CDN ekleyin (Cloudflare - ama dikkatli, içerik politikası var)

**Seçenek B: Decentralized Hosting**
- IPFS (InterPlanetary File System)
- Arweave (permanent storage)
- Bu seçenekler tam anonimlik sağlar

### 2. **Backend Hosting**

**Offshore VPS üzerinde:**
- Python/FastAPI backend
- Nginx reverse proxy
- SSL sertifikası (Let's Encrypt veya ücretli)

### 3. **Database**

**Seçenekler:**
- Aynı VPS üzerinde MongoDB/PostgreSQL
- Ayrı offshore database server (daha güvenli)
- Decentralized database (Gun.js, OrbitDB)

## 🔒 Güvenlik Önerileri

### 1. **Anonimlik**
- ✅ VPN kullanın (hosting'e bağlanırken)
- ✅ Tor Browser kullanın (mümkünse)
- ✅ Bitcoin/crypto ile ödeme yapın
- ✅ Kişisel bilgiler vermeyin

### 2. **Domain**
- ✅ Offshore domain registrar kullanın
- ✅ WHOIS privacy aktif edin
- ✅ Farklı bir ülkede domain alın

**Önerilen Domain Registrars:**
- Namecheap (WHOIS privacy ile)
- Njalla (anonim domain)
- OrangeWebsite (İzlanda)

### 3. **SSL Sertifikası**
- Let's Encrypt (ücretsiz ama IP loglanabilir)
- Ücretli SSL (daha güvenli)
- Self-signed (sadece test için)

### 4. **DDoS Koruması**
- Cloudflare (dikkatli - içerik politikası)
- Offshore DDoS protection servisleri
- VPS sağlayıcının DDoS koruması

## 💰 Maliyet Tahmini (Aylık)

### Minimal Setup:
- Offshore VPS: $10-20/ay
- Domain: $10-15/yıl
- SSL: $0-10/ay
- **Toplam: ~$15-30/ay**

### Orta Ölçekli:
- Offshore VPS: $30-50/ay
- CDN/DDoS Protection: $20-50/ay
- Domain: $10-15/yıl
- SSL: $10-20/ay
- **Toplam: ~$60-120/ay**

### Büyük Ölçekli:
- Offshore VPS Cluster: $100-300/ay
- CDN/DDoS: $100-200/ay
- Database Server: $50-100/ay
- Monitoring: $20-50/ay
- **Toplam: ~$270-650/ay**

## 📋 Deployment Checklist

### Backend Deployment:
- [ ] Offshore VPS'e SSH ile bağlanın
- [ ] Python 3.9+ yükleyin
- [ ] Nginx yükleyin ve yapılandırın
- [ ] SSL sertifikası ekleyin
- [ ] Environment variables ayarlayın
- [ ] Systemd service oluşturun (otomatik başlatma)
- [ ] Firewall kurallarını ayarlayın (sadece gerekli portlar)

### Frontend Deployment:
- [ ] Build alın (`npm run build`)
- [ ] Statik dosyaları VPS'e yükleyin
- [ ] Nginx'te static file serving yapılandırın
- [ ] CDN ekleyin (opsiyonel)

### Database:
- [ ] MongoDB/PostgreSQL yükleyin
- [ ] Güvenlik ayarlarını yapın
- [ ] Backup stratejisi oluşturun

## ⚠️ Riskler ve Dikkat Edilmesi Gerekenler

### 1. **Yasal Riskler**
- ⚠️ Hosting sağlayıcısı bile hesabınızı kapatabilir
- ⚠️ Domain registrar domain'i iptal edebilir
- ⚠️ Ülkenizde yasal sorunlar çıkabilir
- ⚠️ Ödeme sağlayıcıları hesabı kapatabilir

### 2. **Teknik Riskler**
- ⚠️ DDoS saldırıları
- ⚠️ Güvenlik açıkları
- ⚠️ Veri kaybı riski
- ⚠️ Uptime garantisi yok

### 3. **Ödeme Riskleri**
- ⚠️ Kredi kartı kullanmayın (izlenebilir)
- ⚠️ PayPal kullanmayın (hesap kapatılabilir)
- ✅ Bitcoin/crypto kullanın
- ✅ Prepaid kartlar (dikkatli)

## 🚀 Hızlı Başlangıç (FlokiNET Örneği)

### 1. VPS Satın Alın
```bash
# FlokiNET'ten VPS satın alın
# Ubuntu 22.04 LTS seçin
# Minimum: 2GB RAM, 1 CPU, 20GB SSD
```

### 2. Server Kurulumu
```bash
# SSH ile bağlanın
ssh root@your-server-ip

# Sistem güncellemesi
apt update && apt upgrade -y

# Nginx yükleyin
apt install nginx -y

# Python ve pip yükleyin
apt install python3 python3-pip -y

# MongoDB yükleyin (opsiyonel)
apt install mongodb -y
```

### 3. Backend Deployment
```bash
# Projeyi yükleyin
cd /var/www
git clone your-repo backend
cd backend

# Dependencies yükleyin
pip3 install -r requirements.txt

# Environment variables
nano .env
# THE_ODDS_API_KEY=...
# MONGO_URL=...
# CORS_ORIGINS=https://yourdomain.com

# Systemd service oluşturun
nano /etc/systemd/system/kibris-backend.service
```

### 4. Nginx Configuration
```nginx
# /etc/nginx/sites-available/kibris
server {
    listen 80;
    server_name yourdomain.com;

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend
    location / {
        root /var/www/frontend/build;
        try_files $uri $uri/ /index.html;
    }
}
```

## 📞 Destek ve Kaynaklar

### Offshore Hosting Forumları:
- LowEndTalk.com
- WebHostingTalk.com (offshore section)

### Güvenlik:
- OWASP Top 10
- SSL Labs test

## ⚖️ Son Notlar

1. **Yasal Danışmanlık**: Mutlaka bir avukatla görüşün
2. **Risk Analizi**: Tüm riskleri değerlendirin
3. **Backup Stratejisi**: Düzenli backup alın
4. **Monitoring**: Siteyi sürekli izleyin
5. **Plan B**: Alternatif hosting hazırlayın

**Unutmayın:** Bu tür siteler için hiçbir hosting %100 güvenli değildir. Her zaman risk vardır.

