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
					avatar_url?: string | null;
					onboarding_status?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
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
			};
			personas: {
				Row: {
					id: string;
					user_id: string;
					persona_type: string;
					name: string;
					compiled_document: string;
					version: number;
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
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["personas"]["Insert"]>;
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
			};
			profiles: {
				Row: {
					id: string;
					user_id: string;
					basic_info: Json;
					personality_tags: Json;
					personality_analysis: Json;
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
					status?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
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
