import type {
	Matches,
	PersonaDialogs,
	PersonaSessions,
	Personas,
	Reports,
	Users,
} from "./types";

export const MOCK_USERS: Users[] = [
	{
		id: "user-1",
		display_name: "Alex Fox",
		age: 28,
		location: "Tokyo, Japan",
		bio: "映画とテクノロジーが好きなミニマリスト。週末はカフェで過ごすのが趣味です。",
		created_at: new Date("2024-01-15"),
	},
];

export const MOCK_PERSONAS: Personas[] = [
	{
		id: "persona-1",
		user_id: "user-1",
		name: "Alex (AI)",
		traits: ["好奇心旺盛", "論理的", "映画好き", "ミニマリスト"],
		profile_text:
			"こんにちは、私はAlexです。効率と美しさを重視するミニマリストですが、週末は映画の世界に没頭するのが好きです。新しいテクノロジーについて議論するのが得意です。",
		created_at: new Date("2024-01-20"),
		updated_at: new Date("2024-02-10"),
	},
];

export const MOCK_PERSONA_DIALOGS: PersonaDialogs[] = [
	{
		id: "dialog-1",
		persona_a_id: "persona-1",
		persona_b_id: "persona-2",
		messages: [
			"映画が好きって聞いたよ",
			"最近はSF映画にハマってる",
			"インターステラーが最高だった",
		],
		compatibility_score: 88,
		started_at: new Date("2024-02-01"),
	},
];

export const MOCK_MATCHES: Matches[] = [
	{
		id: "match-1",
		persona_a_id: "persona-1",
		persona_b_id: "persona-2",
		compatibility_score: 88,
		user_confirmed: true,
		created_at: new Date("2024-02-01"),
	},
];

export const MOCK_PERSONA_SESSIONS: PersonaSessions[] = [
	{
		id: "session-1",
		user_id: "user-1",
		turns: ["自己紹介", "趣味について", "価値観について"],
		resulting_persona_id: "persona-1",
		created_at: new Date("2024-01-20"),
	},
];

export const MOCK_REPORTS: Reports[] = [
	{
		id: "rep-1",
		reporter_user_id: "user-1",
		target_persona_id: "persona-alpha",
		reason: "不適切な発言が含まれている",
		created_at: new Date("2023-11-01T10:00:00"),
	},
	{
		id: "rep-2",
		reporter_user_id: "user-1",
		target_persona_id: "persona-beta",
		reason: "スパム行為",
		created_at: new Date("2023-10-25T14:30:00"),
	},
];
