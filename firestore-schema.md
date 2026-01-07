# Firestore Database Schema

## Collections Structure

### users/
```
{
  email: string,
  username: string,
  role: 'superadmin' | 'agent' | 'player',
  balance: number, // mevcut bakiye
  credit: number, // toplam kredi limiti
  parentId: string | null, // bayi için superadmin, oyuncu için bayi
  isBanned: boolean,
  banReason?: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### coupons/
```
{
  userId: string,
  agentId: string, // hangi bayiden
  selections: Array<{
    matchId: string,
    matchName: string,
    league: string,
    marketName: string,
    option: string,
    odds: number
  }>,
  stake: number,
  totalOdds: number,
  potentialWin: number,
  status: 'pending' | 'won' | 'lost' | 'cancelled',
  result: 'win' | 'loss' | null,
  createdAt: timestamp,
  settledAt: timestamp | null,
  uniqueId: string // KPN-{timestamp}-{random}
}
```

### transactions/
```
{
  userId: string,
  agentId: string | null,
  type: 'credit_add' | 'credit_remove' | 'bet' | 'win' | 'commission',
  amount: number,
  description: string,
  createdAt: timestamp,
  relatedCouponId: string | null
}
```

### credit_history/
```
{
  fromUserId: string, // süperadmin veya bayi
  toUserId: string, // bayi veya oyuncu
  amount: number,
  type: 'add' | 'remove',
  createdAt: timestamp,
  description?: string
}
```












