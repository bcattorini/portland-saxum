// Service-role Supabase client — SERVER ONLY. Bypasses RLS.
// Used by the iBuild importer and other trusted server routes.
// Never import this into a Client Component.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
