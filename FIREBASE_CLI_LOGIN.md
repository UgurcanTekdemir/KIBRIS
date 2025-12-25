# Firebase CLI Login Rehberi

## 🔐 Firebase CLI'ye Giriş Yapma

Firebase CLI'ye giriş yapmak için terminal'de şu komutu çalıştırın:

```bash
firebase login
```

### Adımlar:

1. **Komutu çalıştırın:**
   ```bash
   firebase login
   ```

2. **Tarayıcı otomatik açılacak:**
   - Eğer açılmazsa, terminal'de görünen URL'yi tarayıcıda açın

3. **Google hesabınızla giriş yapın:**
   - Firebase projenize erişim izni olan Google hesabınızla giriş yapın

4. **İzin verin:**
   - Firebase CLI'nin hesabınıza erişmesi için izin verin

5. **Başarılı mesajı:**
   - Terminal'de "Success! Logged in as [email]" mesajını göreceksiniz

### Login Durumunu Kontrol Etme

```bash
firebase login:list
```

Bu komut, giriş yapmış hesapları listeler.

### Çıkış Yapma

```bash
firebase logout
```

### Projeyi Bağlama

Login olduktan sonra, projenizi Firebase'e bağlamak için:

```bash
firebase init
```

veya mevcut bir projeyle çalışmak için:

```bash
firebase use --add
```

## 📝 Firestore Rules Deploy Etme

Login olduktan sonra, Firestore Security Rules'ı deploy etmek için:

```bash
firebase deploy --only firestore:rules
```

Bu komut `firestore.rules` dosyasını Firebase'e yükler.

## 🎯 Hızlı Komutlar

```bash
# Login
firebase login

# Proje listesi
firebase projects:list

# Mevcut projeyi seç
firebase use my-kibris

# Firestore rules deploy
firebase deploy --only firestore:rules

# Tüm Firebase servislerini deploy
firebase deploy
```

## ⚠️ Not

Firebase login interaktif bir işlemdir ve tarayıcı gerektirir. Bu yüzden terminal'de manuel olarak çalıştırmanız gerekir.

