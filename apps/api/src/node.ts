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
		ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
		ELEVENLABS_AGENT_ID: process.env.ELEVENLABS_AGENT_ID,
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
		const hasElevenLabs = Boolean(bindings.ELEVENLABS_API_KEY?.trim() && bindings.ELEVENLABS_AGENT_ID?.trim());
		console.log(`Server is running on http://localhost:${info.port}`);
		console.log(`[env] MISTRAL_API_KEY: ${hasMistral ? "set" : "NOT SET"}`);
		console.log(`[env] ELEVENLABS_API_KEY: ${hasElevenLabs ? "set" : "NOT SET"}`);
		if (!hasMistral) {
			console.warn("[env] Mistral features will fail. Set MISTRAL_API_KEY in .mise.local.toml");
		}
		if (!hasElevenLabs) {
			console.warn("[env] ElevenLabs voice features will fail. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .mise.local.toml");
		}
	},
);
