# Login Hatası Giderme

## 🔍 Adımlar

### 1. Tarayıcı Console'unu Açın

1. Tarayıcıda **F12** veya **Cmd+Option+I** (Mac) tuşlarına basın
2. **Console** sekmesine gidin

### 2. Login Yapmayı Deneyin

1. http://localhost:3000/login adresine gidin
2. Email ve password girin
3. Console'da görünen mesajları kontrol edin

### 3. Olası Hatalar

#### Hata: "Kullanıcı bulunamadı"
- **Sebep:** Firestore'da `users/{uid}` document'ı yok
- **Çözüm:** Firebase Console'da users collection'ına kullanıcı document'ını ekleyin

#### Hata: "Permission denied" veya Firestore hatası
- **Sebep:** Firestore Security Rules izin vermiyor
- **Çözüm:** Firestore Rules'ı deploy edin:
  ```bash
  firebase deploy --only firestore:rules
  ```

#### Hata: "auth/user-not-found" veya "auth/wrong-password"
- **Sebep:** Firebase Authentication'da kullanıcı yok veya şifre yanlış
- **Çözüm:** Firebase Console > Authentication > Users'dan kontrol edin

### 4. Firestore Security Rules Kontrol

Firebase Console'da:
1. Firestore Database > Rules sekmesine gidin
2. Rules'ın deploy edildiğinden emin olun
3. Şu rule'ların olduğundan emin olun:

```javascript
match /users/{userId} {
  allow read: if isAuthenticated() && (request.auth.uid == userId || isSuperadmin() || (isAgent() && resource.data.parentId == request.auth.uid));
}
```

### 5. Kullanıcı Verilerini Kontrol

Firebase Console > Firestore Database > Data:
1. `users` collection'ına gidin
2. Kullanıcı UID'si ile document'ın olduğundan emin olun
3. Gerekli field'ların olduğundan emin olun:
   - email
   - username
   - role
   - balance
   - credit
   - isBanned
   - createdAt
   - updatedAt

