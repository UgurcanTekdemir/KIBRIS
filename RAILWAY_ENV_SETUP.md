# Railway Environment Variables Setup

## Railway Dashboard'da Eklenmesi Gereken Environment Variables

Railway dashboard'da projenizin **Settings** > **Variables** bölümüne aşağıdaki environment variable'ları ekleyin:

### 1. The Odds API Key
```
THE_ODDS_API_KEY=1506840105ed45a22668cdec6147f2e7
```

### 2. MongoDB Configuration

**ÖNEMLİ:** Railway'de `localhost:27017` çalışmaz! İki seçeneğiniz var:

#### Seçenek A: Railway MongoDB Plugin Kullanma (Önerilen)
1. Railway dashboard'da projenize gidin
2. "New" butonuna tıklayın
3. "Database" > "MongoDB" seçin
4. Railway otomatik olarak `MONGO_URL` environment variable'ını ekler
5. Bu değişkeni kullanın

#### Seçenek B: MongoDB Atlas Kullanma
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) hesabı oluşturun
2. Free cluster oluşturun
3. Database Access'te kullanıcı oluşturun
4. Network Access'te IP adresini `0.0.0.0/0` olarak ekleyin (tüm IP'lere izin ver)
5. Cluster'ınızın "Connect" butonuna tıklayın
6. "Connect your application" seçeneğini seçin
7. Connection string'i kopyalayın ve şu formatta ekleyin:
```
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/kibris_db?retryWrites=true&w=majority
```

### 3. Database Name
```
DB_NAME=kibris_db
```

### 4. CORS Origins
Railway'de frontend URL'inizi ekleyin. Vercel URL'iniz:
```
CORS_ORIGINS=https://my-kibris-project.vercel.app,http://localhost:3000,http://localhost:3001
```

## Railway'de Environment Variable Ekleme Adımları

1. Railway dashboard'a gidin
2. Projenizi seçin
3. **Settings** sekmesine tıklayın
4. **Variables** bölümüne gidin
5. **New Variable** butonuna tıklayın
6. Her bir variable için:
   - **Name**: Variable adı (örn: `THE_ODDS_API_KEY`)
   - **Value**: Variable değeri (örn: `1506840105ed45a22668cdec6147f2e7`)
   - **Add** butonuna tıklayın

## Örnek Environment Variables Listesi

```
THE_ODDS_API_KEY=1506840105ed45a22668cdec6147f2e7
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/kibris_db?retryWrites=true&w=majority
DB_NAME=kibris_db
CORS_ORIGINS=https://your-frontend-domain.vercel.app,http://localhost:3000,http://localhost:3001
```

## Notlar

- Railway otomatik olarak `PORT` environment variable'ını sağlar, eklemenize gerek yok
- `MONGO_URL` için Railway MongoDB plugin kullanıyorsanız, Railway otomatik olarak ekler
- CORS_ORIGINS'a frontend URL'inizi mutlaka ekleyin, yoksa CORS hatası alırsınız
- Environment variable'ları ekledikten sonra Railway servisi otomatik olarak yeniden deploy edilir

