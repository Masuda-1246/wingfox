/** Minimal DO namespace interface so env.ts compiles without @cloudflare/workers-types */
export interface DONamespace {
	idFromName(name: string): unknown;
	get(id: unknown): { fetch(req: Request): Promise<Response> };
}

export type Env = {
		Bindings: {
		SUPABASE_URL: string;
		SUPABASE_SERVICE_ROLE_KEY: string;
		SUPABASE_ANON_KEY?: string;
		MISTRAL_API_KEY?: string;
		ELEVENLABS_API_KEY?: string;
		ELEVENLABS_AGENT_ID?: string;
		FOX_CONVERSATION?: DONamespace;
	};
	Variables: {
		user_id: string; // user_profiles.id
		auth_user_id: string; // auth.users.id
	};
};
