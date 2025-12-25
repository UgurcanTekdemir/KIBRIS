# Firebase Authentication - Manuel Üye Ekleme Rehberi

## 📝 Firebase Console'dan Kullanıcı Ekleme

### Adım 1: Firebase Console'a Giriş

1. **Firebase Console**'a gidin: https://console.firebase.google.com
2. Projenizi seçin: **my-kibris**
3. Sol menüden **"Authentication"** seçin

### Adım 2: Authentication'ı Etkinleştirme (İlk Kez)

Eğer Authentication henüz etkinleştirilmemişse:

1. **"Get started"** butonuna tıklayın
2. **"Sign-in method"** sekmesine gidin
3. **"Email/Password"** provider'ını bulun
4. Sağ taraftaki **"Enable"** toggle'ını açın
5. **"Save"** butonuna tıklayın

### Adım 3: Yeni Kullanıcı Ekleme

1. **"Users"** sekmesine gidin (sol üstte, "Sign-in method" yanında)
2. **"Add user"** butonuna tıklayın (üstte, sağ tarafta)
3. Bir form açılacak:
   - **Email:** Kullanıcının email adresini girin (örn: `admin@example.com`)
   - **Password:** Şifreyi girin (en az 6 karakter)
   - **Password (again):** Şifreyi tekrar girin
4. **"Add user"** butonuna tıklayın

### Adım 4: Kullanıcı ID'sini Kopyalama

Kullanıcı eklendikten sonra:

1. Users listesinde yeni eklediğiniz kullanıcıyı bulun
2. Kullanıcının **UID**'sini kopyalayın (User ID kolonunda)
   - Örnek UID: `abc123def456ghi789jkl012mno345`

**ÖNEMLİ:** Bu UID'yi bir yere not edin, sonraki adımda kullanacağız!

---

## 🔥 Firestore'da Kullanıcı Verilerini Oluşturma

Authentication'da kullanıcı oluşturmak yeterli değil. Firestore'da da kullanıcı verilerini oluşturmanız gerekiyor.

### Adım 1: Firestore Database'e Erişim

1. Firebase Console'da sol menüden **"Firestore Database"** seçin
2. **"Users"** collection'ına gidin (yoksa oluşturun)

### Adım 2: Yeni Document Oluşturma

1. **"Start collection"** butonuna tıklayın (eğer collection yoksa)
   - Collection ID: `users`
   - İlk document ID: **Kopyaladığınız UID'yi yapıştırın**

2. Document'ı oluşturun:

#### Document ID
```
[Kullanıcının UID'si - Authentication'dan kopyaladığınız]
```

#### Field'ları Ekleyin:

**Superadmin için:**
| Field | Type | Value |
|-------|------|-------|
| `email` | string | admin@example.com |
| `username` | string | superadmin |
| `role` | string | superadmin |
| `balance` | number | 0 |
| `credit` | number | 0 |
| `isBanned` | boolean | false |
| `createdAt` | timestamp | (Şu anki zamanı seçin) |
| `updatedAt` | timestamp | (Şu anki zamanı seçin) |

**Agent için:**
| Field | Type | Value |
|-------|------|-------|
| `email` | string | agent@example.com |
| `username` | string | agent1 |
| `role` | string | agent |
| `parentId` | string | [Superadmin'in UID'si] |
| `balance` | number | 0 |
| `credit` | number | 0 |
| `isBanned` | boolean | false |
| `createdAt` | timestamp | (Şu anki zamanı seçin) |
| `updatedAt` | timestamp | (Şu anki zamanı seçin) |

**Player için:**
| Field | Type | Value |
|-------|------|-------|
| `email` | string | player@example.com |
| `username` | string | player1 |
| `role` | string | player |
| `parentId` | string | [Agent'in UID'si] |
| `balance` | number | 0 |
| `credit` | number | 0 |
| `isBanned` | boolean | false |
| `createdAt` | timestamp | (Şu anki zamanı seçin) |
| `updatedAt` | timestamp | (Şu anki zamanı seçin) |

### Adım 3: Timestamp Ekleme

Firestore'da timestamp eklerken:

1. Field type olarak **"timestamp"** seçin
2. **"Set timestamp"** butonuna tıklayın
3. Otomatik olarak şu anki zaman eklenir

**Alternatif:** Field type olarak **"timestamp"** seçin ve tarih/saat seçiciyi kullanın.

---

## 🎯 Hızlı Test Senaryosu

### 1. Superadmin Oluşturma

**Authentication:**
- Email: `admin@test.com`
- Password: `admin123`

**Firestore (users/{uid}):**
```json
{
  "email": "admin@test.com",
  "username": "admin",
  "role": "superadmin",
  "balance": 0,
  "credit": 0,
  "isBanned": false,
  "createdAt": [timestamp],
  "updatedAt": [timestamp]
}
```

### 2. Agent Oluşturma

**Authentication:**
- Email: `agent@test.com`
- Password: `agent123`

**Firestore (users/{uid}):**
```json
{
  "email": "agent@test.com",
  "username": "agent1",
  "role": "agent",
  "parentId": "[superadmin-uid]",
  "balance": 0,
  "credit": 0,
  "isBanned": false,
  "createdAt": [timestamp],
  "updatedAt": [timestamp]
}
```

### 3. Player Oluşturma

**Authentication:**
- Email: `player@test.com`
- Password: `player123`

**Firestore (users/{uid}):**
```json
{
  "email": "player@test.com",
  "username": "player1",
  "role": "player",
  "parentId": "[agent-uid]",
  "balance": 0,
  "credit": 0,
  "isBanned": false,
  "createdAt": [timestamp],
  "updatedAt": [timestamp]
}
```

---

## ✅ Test Etme

Kullanıcıyı oluşturduktan sonra:

1. Uygulamaya gidin: http://localhost:3000/login
2. Oluşturduğunuz email ve password ile giriş yapın
3. Rolünüze göre ilgili panele yönlendirilmelisiniz:
   - Superadmin → `/superadmin`
   - Agent → `/agent`
   - Player → Ana sayfa

---

## ⚠️ Önemli Notlar

1. **UID Eşleşmesi:** Firestore'daki document ID ile Authentication'daki UID'nin **tam olarak eşleşmesi** gerekir
2. **Role Zorunlu:** `role` field'ı mutlaka olmalı (`superadmin`, `agent`, veya `player`)
3. **Parent ID:** Agent ve Player için `parentId` field'ı zorunlu (Agent için superadmin UID, Player için agent UID)
4. **Timestamps:** `createdAt` ve `updatedAt` field'ları timestamp type olmalı
5. **Balance ve Credit:** İlk oluşturulduğunda 0 olmalı

---

## 🔍 Sorun Giderme

### Sorun: "Kullanıcı bulunamadı" hatası
- **Çözüm:** Firestore'da `users/{uid}` document'ının olduğundan emin olun

### Sorun: "Bu sayfaya erişim yetkiniz yok" hatası
- **Çözüm:** Firestore'daki `role` field'ını kontrol edin

### Sorun: Login yapamıyorum
- **Çözüm:** 
  1. Authentication'da kullanıcının olduğundan emin olun
  2. Firestore'da `users/{uid}` document'ının olduğundan emin olun
  3. `isBanned` field'ının `false` olduğundan emin olun

---

## 📸 Görsel Rehber İçin

Firebase Console'da:
1. Authentication > Users > Add user
2. Email ve Password gir
3. UID'yi kopyala
4. Firestore Database > users collection > [UID] document oluştur
5. Field'ları ekle (role, email, username, vs.)

Başarılar! 🚀

