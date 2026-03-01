/**
 * Database types for WingFox.
 * Generate from live Supabase with: supabase gen types typescript --project-id <ref> > src/db/types.ts
 */
export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
			user_profiles: {
				Row: {
					id: string;
					auth_user_id: string;
					nickname: string;
					gender: string | null;
					birth_year: number | null;
					language: string;
					avatar_url: string | null;
					onboarding_status: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					auth_user_id: string;
					nickname: string;
					gender?: string | null;
					birth_year?: number | null;
					language?: string;
					avatar_url?: string | null;
					onboarding_status?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
				Relationships: [];
			};
			quiz_questions: {
				Row: {
					id: string;
					category: string;
					question_text: string;
					options: Json;
					allow_multiple: boolean;
					sort_order: number;
					created_at: string;
				};
				Insert: {
					id: string;
					category: string;
					question_text: string;
					options: Json;
					allow_multiple?: boolean;
					sort_order: number;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["quiz_questions"]["Insert"]>;
				Relationships: [];
			};
			quiz_answers: {
				Row: {
					id: string;
					user_id: string;
					question_id: string;
					selected: Json;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					question_id: string;
					selected: Json;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["quiz_answers"]["Insert"]>;
				Relationships: [];
			};
			persona_section_definitions: {
				Row: {
					id: string;
					title: string;
					description: string;
					generation_prompt: string;
					sort_order: number;
					editable: boolean;
					applicable_persona_types: string[];
					created_at: string;
				};
				Insert: {
					id: string;
					title: string;
					description: string;
					generation_prompt: string;
					sort_order: number;
					editable?: boolean;
					applicable_persona_types?: string[];
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["persona_section_definitions"]["Insert"]>;
				Relationships: [];
			};
			personas: {
				Row: {
					id: string;
					user_id: string;
					persona_type: string;
					name: string;
					compiled_document: string;
					version: number;
					icon_url: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					persona_type: string;
					name: string;
					compiled_document: string;
					version?: number;
					icon_url?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["personas"]["Insert"]>;
				Relationships: [];
			};
			persona_sections: {
				Row: {
					id: string;
					persona_id: string;
					section_id: string;
					content: string;
					source: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					persona_id: string;
					section_id: string;
					content: string;
					source?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["persona_sections"]["Insert"]>;
				Relationships: [];
			};
			speed_dating_sessions: {
				Row: {
					id: string;
					user_id: string;
					persona_id: string;
					status: string;
					message_count: number;
					started_at: string;
					completed_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					persona_id: string;
					status?: string;
					message_count?: number;
					started_at?: string;
					completed_at?: string | null;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["speed_dating_sessions"]["Insert"]>;
				Relationships: [];
			};
			speed_dating_messages: {
				Row: {
					id: string;
					session_id: string;
					role: string;
					content: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					session_id: string;
					role: string;
					content: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["speed_dating_messages"]["Insert"]>;
				Relationships: [];
			};
			profiles: {
				Row: {
					id: string;
					user_id: string;
					basic_info: Json;
					personality_tags: Json;
					personality_analysis: Json;
					interaction_style: Json;
					interests: Json;
					values: Json;
					romance_style: Json;
					communication_style: Json;
					lifestyle: Json;
					status: string;
					version: number;
					confirmed_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					basic_info?: Json;
					personality_tags?: Json;
					personality_analysis?: Json;
					interaction_style?: Json;
					interests?: Json;
					values?: Json;
					romance_style?: Json;
					communication_style?: Json;
					lifestyle?: Json;
					status?: string;
					version?: number;
					confirmed_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
				Relationships: [];
			};
			daily_match_pairs: {
				Row: {
					match_id: string;
					match_date: string;
					created_at: string;
				};
				Insert: {
					match_id: string;
					match_date: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["daily_match_pairs"]["Insert"]>;
				Relationships: [];
			};
			matches: {
				Row: {
					id: string;
					user_a_id: string;
					user_b_id: string;
					profile_score: number | null;
					conversation_score: number | null;
					final_score: number | null;
					score_details: Json;
					layer_scores: Json;
					status: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_a_id: string;
					user_b_id: string;
					profile_score?: number | null;
					conversation_score?: number | null;
					final_score?: number | null;
					score_details?: Json;
					layer_scores?: Json;
					status?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
				Relationships: [];
			};
			interaction_dna_scores: {
				Row: {
					id: string;
					match_id: string;
					feature_id: number;
					feature_name: string;
					raw_score: number;
					normalized_score: number;
					confidence: number;
					evidence: Json;
					source_phase: string;
					computed_at: string;
				};
				Insert: {
					id?: string;
					match_id: string;
					feature_id: number;
					feature_name: string;
					raw_score: number;
					normalized_score: number;
					confidence?: number;
					evidence?: Json;
					source_phase: string;
					computed_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["interaction_dna_scores"]["Insert"]>;
				Relationships: [];
			};
			fox_conversations: {
				Row: {
					id: string;
					match_id: string;
					status: string;
					total_rounds: number;
					current_round: number;
					conversation_analysis: Json;
					started_at: string | null;
					completed_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					match_id: string;
					status?: string;
					total_rounds?: number;
					current_round?: number;
					conversation_analysis?: Json;
					started_at?: string | null;
					completed_at?: string | null;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["fox_conversations"]["Insert"]>;
				Relationships: [];
			};
			fox_conversation_messages: {
				Row: {
					id: string;
					conversation_id: string;
					speaker_user_id: string;
					content: string;
					round_number: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					conversation_id: string;
					speaker_user_id: string;
					content: string;
					round_number: number;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["fox_conversation_messages"]["Insert"]>;
				Relationships: [];
			};
			partner_fox_chats: {
				Row: {
					id: string;
					match_id: string;
					user_id: string;
					partner_user_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					match_id: string;
					user_id: string;
					partner_user_id: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["partner_fox_chats"]["Insert"]>;
				Relationships: [];
			};
			partner_fox_messages: {
				Row: {
					id: string;
					chat_id: string;
					role: string;
					content: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					chat_id: string;
					role: string;
					content: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["partner_fox_messages"]["Insert"]>;
				Relationships: [];
			};
			chat_requests: {
				Row: {
					id: string;
					match_id: string;
					requester_id: string;
					responder_id: string;
					status: string;
					responded_at: string | null;
					expires_at: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					match_id: string;
					requester_id: string;
					responder_id: string;
					status?: string;
					responded_at?: string | null;
					expires_at: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["chat_requests"]["Insert"]>;
				Relationships: [];
			};
			direct_chat_rooms: {
				Row: {
					id: string;
					match_id: string;
					status: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					match_id: string;
					status?: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["direct_chat_rooms"]["Insert"]>;
				Relationships: [];
			};
			direct_chat_messages: {
				Row: {
					id: string;
					room_id: string;
					sender_id: string;
					content: string;
					is_read: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					room_id: string;
					sender_id: string;
					content: string;
					is_read?: boolean;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["direct_chat_messages"]["Insert"]>;
				Relationships: [];
			};
			blocks: {
				Row: {
					id: string;
					blocker_id: string;
					blocked_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					blocker_id: string;
					blocked_id: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["blocks"]["Insert"]>;
				Relationships: [];
			};
			reports: {
				Row: {
					id: string;
					reporter_id: string;
					reported_id: string;
					reason: string;
					description: string | null;
					message_id: string | null;
					status: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					reporter_id: string;
					reported_id: string;
					reason: string;
					description?: string | null;
					message_id?: string | null;
					status?: string;
					created_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: {
			get_user_profile_id: {
				Args: Record<string, never>;
				Returns: string;
			};
		};
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};
