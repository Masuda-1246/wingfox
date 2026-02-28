import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app";
import type { Env } from "./env";

/** Bindings from process.env (load .env in apps/api for local dev) */
function getBindings(): Env["Bindings"] {
	return {
		SUPABASE_URL: process.env.SUPABASE_URL ?? "",
		SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
		SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
		MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
	};
}

serve(
	{
		fetch: (req, nodeEnv, ctx) =>
			app.fetch(req, { ...nodeEnv, ...getBindings() }, ctx),
		port: 3001,
	},
	(info) => {
		const bindings = getBindings();
		const hasMistral = Boolean(bindings.MISTRAL_API_KEY?.trim());
		console.log(`Server is running on http://localhost:${info.port}`);
		if (!hasMistral) {
			console.warn(
				"[env] MISTRAL_API_KEY is not set. Mistral features will fail. Set it in .mise.local.toml or apps/api/.env",
			);
		} else {
			console.log("[env] MISTRAL_API_KEY is set");
		}
	},
);
