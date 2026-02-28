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

// --- API response types (aligned with apps/api) ---

export interface MatchResultItem {
	id: string;
	partner_id: string;
	partner: { nickname: string; avatar_url: string | null; persona_icon_url?: string | null } | null;
	final_score: number | null;
	profile_score: number | null;
	conversation_score: number | null;
	common_tags: string[];
	status: string;
	fox_conversation_status: string | null;
	fox_conversation_id: string | null;
	created_at: string;
}

export interface MatchResultDetail {
	id: string;
	partner_id: string;
	partner: { nickname: string; avatar_url: string | null; persona_icon_url?: string | null } | null;
	profile_score: number | null;
	conversation_score: number | null;
	final_score: number | null;
	score_details: unknown;
	layer_scores: unknown;
	fox_summary: string;
	status: string;
	fox_conversation_id: string | null;
	partner_fox_chat_id: string | null;
	chat_request_status: string | null;
	direct_chat_room_id: string | null;
}

export interface DnaScoreEntry {
	score: number;
	confidence: number;
	evidence_turns: number[];
	reasoning: string;
}

export interface InteractionStyleWithDna {
	// Backward-compatible old fields
	warmup_speed?: number;
	humor_responsiveness?: number;
	self_disclosure_depth?: number;
	emotional_responsiveness?: number;
	conflict_style?: string;
	attachment_tendency?: string;
	rhythm_preference?: string;
	mirroring_tendency?: number;
	// New DNA fields
	dna_scores?: Record<string, DnaScoreEntry>;
	overall_signature?: string;
	preferred_persona_type?: string;
}

export interface ProfileMe {
	id: string;
	user_id: string;
	basic_info?: Record<string, unknown>;
	personality_tags?: string[];
	personality_analysis?: Record<string, unknown>;
	interaction_style?: InteractionStyleWithDna;
	interests?: Array<{ category: string; items: string[] }>;
	values?: Record<string, unknown>;
	romance_style?: Record<string, unknown>;
	communication_style?: Record<string, unknown>;
	lifestyle?: Record<string, unknown>;
	status: string;
	version?: number;
	updated_at?: string;
}

export interface PersonaListItem {
	id: string;
	persona_type: string;
	name: string;
	version?: number;
	icon_url?: string | null;
	created_at: string;
	updated_at: string;
}

export interface PersonaSection {
	id: string;
	section_id: string;
	content: string;
	source?: string;
	updated_at?: string;
	title?: string;
	editable?: boolean;
}
