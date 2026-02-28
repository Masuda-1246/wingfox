export interface Users {
	id: string;
	display_name: string;
	age?: number;
	location?: string;
	bio?: string;
	created_at: Date;
}

export interface Personas {
	id: string;
	user_id: string;
	name: string;
	traits?: string[];
	profile_text?: string;
	created_at: Date;
	updated_at: Date;
}

export interface PersonaDialogs {
	id: string;
	persona_a_id: string;
	persona_b_id: string;
	messages: string[];
	compatibility_score?: number;
	started_at: Date;
}

export interface Matches {
	id: string;
	persona_a_id: string;
	persona_b_id: string;
	compatibility_score: number;
	user_confirmed?: boolean;
	created_at: Date;
}

export interface PersonaSessions {
	id: string;
	user_id: string;
	turns: string[];
	resulting_persona_id?: string;
	created_at: Date;
}

export interface Reports {
	id: string;
	reporter_user_id: string;
	target_persona_id?: string;
	reason: string;
	created_at: Date;
}
