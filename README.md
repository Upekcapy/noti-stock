# NotiStock

NotiStock is a stock tracking web app with accounts, watchlists, green line graphs, price alerts, and PWA phone notifications.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The app scrapes public Business Insider Markets stock pages every 15 minutes and falls back to deterministic demo data if a page cannot be read.

## Environment

Copy `env.example` into `.env.local` and fill in the services you want enabled:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
SUPABASE_SERVICE_ROLE_KEY=
BUSINESS_INSIDER_MARKETS_BASE_URL=https://markets.businessinsider.com
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

If users were created before the migration was installed, rerun the migration. It is idempotent and backfills existing Auth users into `profiles`.

In Supabase Auth settings, add redirect URLs for every environment you use:

```bash
https://localhost:3000/auth/callback
https://your-production-domain.com/auth/callback
```

For production, set the Auth site URL to your deployed HTTPS domain.

## Notifications

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

Add the public/private keys to `.env.local`. The service worker lives at `public/sw.js`.

### Android PWA flow

1. Deploy NotiStock over HTTPS, such as Vercel.
2. Open the site in Android Chrome.
3. Go to `/settings`.
4. Install NotiStock as a PWA.
5. Enable notifications.
6. Send a random test alert.

The Settings page shows whether the current device is installed, unsupported, blocked, unsubscribed, missing VAPID keys, or subscribed. Test notifications use fake stock-style messages, while real alerts are still delivered by `/api/cron/check-alerts`.

Use the same VAPID key pair in production for as long as possible. Changing VAPID keys can require users to resubscribe devices.

## Alert Checks

The app exposes `GET /api/cron/check-alerts`, configured in `vercel.json` to run every 15 minutes. Add `CRON_SECRET` and call the route with:

```bash
Authorization: Bearer your-secret
```

For local testing outside market hours:

```bash
https://localhost:3000/api/cron/check-alerts?force=1
```

The cron route needs `SUPABASE_SERVICE_ROLE_KEY` or a Supabase `sb_secret_...` key so it can check all users' active alerts. Keep that key server-only.

When `CRON_SECRET` is configured in Vercel, Vercel Cron calls include an `Authorization: Bearer <CRON_SECRET>` header automatically.

## Production Deployment

Deploy over HTTPS before asking real users to install the PWA. Vercel is the expected target because `vercel.json` schedules `/api/cron/check-alerts` every 15 minutes.

Set these environment variables in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:alerts@your-domain.com
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
CRON_SECRET=
BUSINESS_INSIDER_MARKETS_BASE_URL=https://markets.businessinsider.com
```

Then run a production smoke test:

```bash
npm run build
```

After deployment, create a real account, enable notifications from `/settings`, create a crossed alert, and verify that `/api/cron/check-alerts?force=1` records a notification. If `CRON_SECRET` is set, include `Authorization: Bearer your-secret` for manual calls.

## Stock Data

Stock quotes and chart identifiers are scraped from public Business Insider Markets quote pages such as:

```bash
https://markets.businessinsider.com/stocks/aapl-stock
```

The scraper reads the page HTML, parses the quote config, snapshot table, `TKData`, and `InstrumentType`, then calls Business Insider's chart endpoint for graph history:

```bash
https://markets.businessinsider.com/Ajax/Chart_GetChartData?instrumentType=Share&tkData=67,908440,67,333&from=20221225&to=20260425
```

All Business Insider fetches use Next.js caching with a 15-minute revalidation window.
