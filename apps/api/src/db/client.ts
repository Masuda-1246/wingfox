import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import type { Env } from "../env";

export function getSupabaseClient(env: Env["Bindings"]) {
	return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
