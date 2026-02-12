import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
  throw new Error("Supabase env vars missing");
}

export const supabase = createClient(
  ENV.supabaseUrl,
  ENV.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
