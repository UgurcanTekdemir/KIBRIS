# Agent ve Player Ekleme Rehberi

## 🎯 Hızlı Adımlar

### 1. Firebase Console'da Authentication Kullanıcıları Oluşturun

Her biri için:
1. **Authentication** > **Users** > **Add user**
2. Email ve Password girin
3. **UID'yi kopyalayın**

### 2. Scripti Çalıştırın

#### Agent Ekleme

```bash
cd "/Users/uggrcn/kıbrıs 2.2/KIBRIS"
export GOOGLE_APPLICATION_CREDENTIALS="./firebase-service-account-key.json"
node add-agent.js <AGENT_UID> <email> <username>
```

**Örnek:**
```bash
node add-agent.js abc123def456 agent@test.com agent1
```

**Önemli:** Agent'in parentId'si otomatik olarak süperadmin UID'si (456UK2q0sjOfRUTcROIXWhmvHAM2) olarak ayarlanacak.

#### Player Ekleme

Önce Agent'i ekleyin ve Agent'in UID'sini alın, sonra:

```bash
node add-player.js <PLAYER_UID> <email> <username> <AGENT_UID>
```

**Örnek:**
```bash
node add-player.js xyz789ghi012 player@test.com player1 abc123def456
```

---

## 📋 Tam Örnek Senaryo

### Adım 1: Agent Oluşturma

1. Firebase Console > Authentication > Add user
   - Email: `agent@test.com`
   - Password: `Agent123!`
   - **UID kopyala:** örneğin `agentUID123`

2. Script çalıştır:
```bash
node add-agent.js agentUID123 agent@test.com agent1
```

### Adım 2: Player Oluşturma

1. Firebase Console > Authentication > Add user
   - Email: `player@test.com`
   - Password: `Player123!`
   - **UID kopyala:** örneğin `playerUID456`

2. Script çalıştır (Agent UID'sini kullan):
```bash
node add-player.js playerUID456 player@test.com player1 agentUID123
```

---

## ✅ Kontrol Listesi

- [ ] Agent Authentication'da oluşturuldu
- [ ] Agent UID'si kopyalandı
- [ ] Agent scripti çalıştırıldı
- [ ] Player Authentication'da oluşturuldu
- [ ] Player UID'si kopyalandı
- [ ] Agent UID'si hazır
- [ ] Player scripti çalıştırıldı
- [ ] Login test edildi

---

## 🎯 Test Etme

- **Agent:** http://localhost:3000/login → `/agent` sayfasına yönlendirilmeli
- **Player:** http://localhost:3000/login → Ana sayfaya yönlendirilmeli

