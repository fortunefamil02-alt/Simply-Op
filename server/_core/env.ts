export const ENV = {
  cookieSecret: process.env.COOKIE_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Supabase (THIS is what we use now)
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",

  isProduction: process.env.NODE_ENV === "production",
};
