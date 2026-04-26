export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  businessInsiderBaseUrl:
    process.env.BUSINESS_INSIDER_MARKETS_BASE_URL ??
    "https://markets.businessinsider.com",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:alerts@notistock.local",
  cronSecret: process.env.CRON_SECRET ?? "",
};

const hasRealValue = (value: string) =>
  Boolean(value && !value.includes("your_") && !value.includes("example"));

export const isSupabaseConfigured =
  hasRealValue(env.supabaseUrl) && hasRealValue(env.supabaseAnonKey);

export const isSupabaseAdminConfigured =
  isSupabaseConfigured && hasRealValue(env.supabaseServiceRoleKey);

export const isWebPushConfigured =
  hasRealValue(env.vapidPublicKey) && hasRealValue(env.vapidPrivateKey);
