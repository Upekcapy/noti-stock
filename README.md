# NotiStock

NotiStock is a stock tracking web app with accounts, watchlists, green line graphs, price alerts, and PWA phone notifications.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The app runs with deterministic demo data if Supabase, Polygon, or Web Push keys are missing.

## Environment

Copy `env.example` into `.env.local` and fill in the services you want enabled:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
POLYGON_API_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:alerts@notistock.local
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=
```

## Supabase

Run `supabase/migrations/0001_initial_schema.sql` in your Supabase project. It creates:

- `profiles`
- `watchlist_items`
- `price_alerts`
- `notification_history`
- `push_subscriptions`
- `stock_price_cache`

It also enables RLS policies and creates a trigger that inserts profile rows when users register.

## Notifications

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

Add the public/private keys to `.env.local`. The service worker lives at `public/sw.js`.

## Alert Checks

The app exposes `GET /api/cron/check-alerts`, configured in `vercel.json` to run every minute. Add `CRON_SECRET` and call the route with:

```bash
Authorization: Bearer your-secret
```

For local testing outside market hours:

```bash
http://localhost:3000/api/cron/check-alerts?force=1
```
