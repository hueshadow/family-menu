import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

let browserClient: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient {
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase browser env missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }
  browserClient ??= createClient(url, publishableKey);
  return browserClient;
}

export function supabaseServer(): SupabaseClient {
  if (!url || !secretKey) {
    throw new Error(
      "Supabase server env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)",
    );
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false },
  });
}
