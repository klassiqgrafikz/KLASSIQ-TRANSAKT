# KLASSIQ TRANSAKT

> The fastest way to convert Bitcoin to Nigerian Naira. Built for Nigeria.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (Supabase, Neon, or PlanetScale)
- Yellow Card API account (recommended) or Quidax API
- Resend account for emails

### Installation

```bash
# Clone and install
git clone <your-repo>
cd klassiq-transakt
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Set up database
npm run db:generate
npm run db:push

# Start development
npm run dev
```

Visit `http://localhost:3000`

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Open Prisma Studio (optional)
npm run db:studio
```

## 🏗️ Architecture

```
├── apps/
│   ├── web/          # Next.js 14 frontend (Vercel)
│   └── api/          # Backend API (optional - for webhooks)
├── packages/
│   ├── db/           # Prisma schema & client
│   ├── ui/           # Shared React components
│   ├── exchange/     # Yellow Card & Quidax adapters
│   └── config/       # Environment validation
```

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `NEXTAUTH_SECRET` | 32+ char secret (openssl rand -base64 32) | ✅ |
| `NEXTAUTH_URL` | Your domain (e.g., https://klassiqtransakt.com) | ✅ |
| `YELLOWCARD_API_KEY` | Yellow Card API key | ✅* |
| `YELLOWCARD_WEBHOOK_SECRET` | Webhook signing secret | ✅* |
| `RESEND_API_KEY` | Resend API key for emails | ✅ |
| `EMAIL_FROM` | Sender email address | ✅ |

*Use Quidax as fallback if Yellow Card unavailable

### Yellow Card Setup
1. Create account at [dashboard.yellowcard.io](https://dashboard.yellowcard.io)
2. Go to Developers → API Keys
3. Create API key with: Deposit, Sell, Withdraw, Webhooks permissions
4. Configure webhook URL: `https://yourdomain.com/api/webhooks/yellowcard`
5. Enable events: `deposit.confirmed`, `sell.completed`, `withdraw.completed`

### Quidax Setup (Fallback)
1. Create account at [quidax.com](https://quidax.com)
2. Go to API Management
3. Create API key with trading & withdrawal permissions
4. Configure webhook: `https://yourdomain.com/api/webhooks/quidax`

## 🚀 Deployment

### Vercel (Frontend)
1. Push to GitHub
2. Import in Vercel
3. Add all environment variables
4. Deploy

### Render (Webhooks - Optional)
For webhook handling, deploy the API separately:

```bash
# In apps/api
npm install
npm run build
# Deploy to Render as Web Service
# Build: npm install
# Start: node dist/index.js
```

### Database (Supabase/Neon/PlanetScale)
1. Create PostgreSQL database
2. Run `npm run db:push` to create tables
3. Add connection string to `DATABASE_URL`

## 🔐 Invite-Only Access

The platform uses invite-only registration:

1. Admin creates invite: `POST /api/admin/invites`
2. User receives magic link email
3. User clicks link → sets password → account activated
4. User can now login and trade

## 💰 Trading Flow

```
1. User adds bank account (NIBSS verified)
2. User enters BTC amount on /dashboard/trade
3. System gets real-time rate from Yellow Card
4. User confirms → Lightning/On-chain deposit address created
5. User sends BTC → Yellow Card webhook confirms
6. Auto market sell BTC → NGN
7. NGN withdrawn to user's bank account
8. Email receipt sent via Resend
```

## 🏦 Bank Accounts

Users can add multiple Nigerian bank accounts:
- 20+ banks supported (GTB, Access, UBA, Zenith, etc.)
- NIBSS name verification
- Set default for withdrawals
- Secure storage (encrypted)

## 🔗 Payment Links

Create shareable payment pages:
```
https://klassiqtransakt.com/pay/invoice-123
```
- Fixed or open amounts
- Lightning + On-chain
- Auto-convert to NGN
- Webhook notifications

## 🛡️ Security Features

- HMAC webhook verification (Yellow Card & Quidax)
- Idempotency keys for all transactions
- Rate limiting on API
- bcrypt password hashing
- 2FA support (TOTP)
- Audit logging for all actions
- Invite-only access control

## 📊 Admin Panel

Access at `/admin` (ADMIN role required):
- Platform statistics
- User management
- Transaction monitoring
- Invite management
- Compliance/KYC
- Exchange health

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test with real small amounts on Yellow Card sandbox
```

## 📁 Key Files

```
├── .env.example              # Environment template
├── turbo.json                # Turborepo config
├── package.json              # Root workspace
├── apps/web/
│   ├── src/app/              # Next.js App Router pages
│   ├── src/lib/auth.ts       # NextAuth config
│   ├── src/middleware.ts     # Route protection
│   └── tailwind.config.ts    # Tailwind config
├── packages/
│   ├── db/prisma/schema.prisma  # Database schema
│   ├── exchange/             # Exchange adapters
│   ├── ui/                   # Shared components
│   └── config/               # Env validation
```

## 🔗 API Endpoints

### Public
- `GET /api/rates/btc-ngn` - Current BTC/NGN rate
- `GET /api/banks` - All Nigerian banks
- `POST /api/banks/verify` - Verify account number

### Authenticated
- `GET /api/banks/my-accounts` - User's bank accounts
- `POST /api/banks/my-accounts` - Add bank account
- `POST /api/trade/quote` - Get trade quote
- `POST /api/trade/create-deposit` - Create deposit address
- `GET /api/trade/deposit-status/[id]` - Check deposit
- `GET/POST /api/payment-links` - Payment links CRUD
- `GET /pay/[slug]` - Public payment page

### Admin
- `GET /api/admin/stats` - Platform stats
- `GET/POST /api/admin/invites` - Invite management
- `GET /api/admin/users` - User management
- `GET /api/admin/transactions` - All transactions

### Webhooks
- `POST /api/webhooks/yellowcard` - Yellow Card events
- `POST /api/webhooks/quidax` - Quidax events

## 📝 License

Private - KLASSIQ TRANSAKT