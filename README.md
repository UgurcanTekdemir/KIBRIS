# KIBRIS - Frontend Projesi

## 🚀 Hızlı Başlatma

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
