# NotiStock

NotiStock is a stock tracking web app with accounts, watchlists, green line graphs, price alerts, and PWA phone notifications.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The app uses Finnhub's official market data API for stock search, quotes, and charts. If Finnhub is not configured or a request fails, the UI falls back to deterministic demo data.

## Environment

Copy `env.example` into `.env.local` and fill in the services you want enabled:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
SUPABASE_SERVICE_ROLE_KEY=
FINNHUB_API_KEY=
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

The cron route needs `SUPABASE_SERVICE_ROLE_KEY` or a Supabase `sb_secret_...` key so it can check all users' active alerts. It also needs `FINNHUB_API_KEY` for live market data. Keep both keys server-only.

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
FINNHUB_API_KEY=
```

Then run a production smoke test:

```bash
npm run build
```

After deployment, create a real account, enable notifications from `/settings`, create a crossed alert, and verify that `/api/cron/check-alerts?force=1` records a notification. If `CRON_SECRET` is set, include `Authorization: Bearer your-secret` for manual calls. Alerts are skipped when only demo fallback data is available, so configure `FINNHUB_API_KEY` before testing real alert delivery.

## Stock Data

Stock quotes, ticker search, and chart history come from Finnhub's official API:

```bash
https://finnhub.io/docs/api
```

The app calls Finnhub's search, quote, profile, and stock candle endpoints from the server. It falls back to Nasdaq public quote chart endpoints for chart history when Finnhub candles are unavailable. The Finnhub API key is never exposed to the browser.

Quote fetches use a short cache window, while chart history uses a 15-minute revalidation window. If both live chart sources are unavailable, the app shows an unavailable chart state instead of fake history. The visible app may show demo data if Finnhub is unavailable, but cron alert notifications only fire from live Finnhub quotes.
