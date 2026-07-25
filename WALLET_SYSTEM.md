# Wallet & Loyalty System

## Routes
```txt
/wallet
/api/wallet
```

## Tables
```txt
wallets
wallet_transactions
reward_points
reward_transactions
cashback_transactions
```

## Balances
Each user has:
- Total balance
- Available balance
- Frozen balance
- Refunded balance
- Reward balance
- Reward points

## Operations
Implemented foundation:
- Ensure wallet per user.
- Credit wallet service.
- Redeem points to wallet.
- Award loyalty points on order creation.
- Cashback transaction hook.

## Settings
Stored in `system_settings` under:
```txt
homepage/wallet or wallet/loyalty_settings
```
Default:
```txt
100 amount = 10 points
1 point = 1 wallet currency unit
cashback = 0%
```

## Security
- User wallet dashboard requires authentication.
- Financial mutations are service-layer controlled and audit-ready.
- Mutating APIs are CSRF protected.
