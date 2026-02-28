export type Env = {
	Bindings: {
		SUPABASE_URL: string;
		SUPABASE_SERVICE_ROLE_KEY: string;
		SUPABASE_ANON_KEY?: string;
		MISTRAL_API_KEY?: string;
	};
	Variables: {
		user_id: string; // user_profiles.id
		auth_user_id: string; // auth.users.id
	};
};
