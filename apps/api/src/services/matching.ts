import type { Database } from "../db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const WEIGHTS = {
	personality: 0.25,
	interests: 0.2,
	values: 0.25,
	communication: 0.15,
	lifestyle: 0.15,
} as const;

function getPersonalityScore(a: ProfileRow, b: ProfileRow): number {
	const pa = (a.personality_analysis as Record<string, number>) ?? {};
	const pb = (b.personality_analysis as Record<string, number>) ?? {};
	let sum = 0;
	let n = 0;
	for (const key of ["introvert_extrovert", "planned_spontaneous", "logical_emotional"]) {
		const va = pa[key];
		const vb = pb[key];
		if (typeof va === "number" && typeof vb === "number") {
			sum += 1 - Math.abs(va - vb);
			n++;
		}
	}
	const tagsA = (a.personality_tags as string[]) ?? [];
	const tagsB = (b.personality_tags as string[]) ?? [];
	const tagOverlap = tagsA.length && tagsB.length ? tagsA.filter((t) => tagsB.includes(t)).length / Math.max(tagsA.length, tagsB.length) : 0.5;
	return n ? (sum / n) * 0.7 + tagOverlap * 0.3 : 0.5;
}

function getInterestsScore(a: ProfileRow, b: ProfileRow): number {
	const ia = (a.interests as { category: string; items: string[] }[]) ?? [];
	const ib = (b.interests as { category: string; items: string[] }[]) ?? [];
	const allItemsA = new Set(ia.flatMap((x) => x.items ?? []));
	const allItemsB = new Set(ib.flatMap((x) => x.items ?? []));
	if (allItemsA.size === 0 && allItemsB.size === 0) return 0.5;
	const overlap = [...allItemsA].filter((x) => allItemsB.has(x)).length;
	const union = new Set([...allItemsA, ...allItemsB]).size;
	return union ? overlap / union : 0.5;
}

function getValuesScore(a: ProfileRow, b: ProfileRow): number {
	const va = (a.values as Record<string, number>) ?? {};
	const vb = (b.values as Record<string, number>) ?? {};
	const keys = new Set([...Object.keys(va), ...Object.keys(vb)]);
	if (keys.size === 0) return 0.5;
	let sum = 0;
	for (const k of keys) {
		const aVal = va[k];
		const bVal = vb[k];
		if (typeof aVal === "number" && typeof bVal === "number") {
			sum += 1 - Math.abs(aVal - bVal);
		}
	}
	return keys.size ? sum / keys.size : 0.5;
}

function getCommunicationScore(a: ProfileRow, b: ProfileRow): number {
	const ca = (a.communication_style as Record<string, unknown>) ?? {};
	const cb = (b.communication_style as Record<string, unknown>) ?? {};
	const lenA = ca.message_length;
	const lenB = cb.message_length;
	if (lenA === lenB) return 1;
	return 0.7;
}

function getLifestyleScore(_a: ProfileRow, _b: ProfileRow): number {
	return 0.6 + Math.random() * 0.2;
}

function getDealbreakers(p: ProfileRow): string[] {
	const rs = (p.romance_style as Record<string, unknown>) ?? {};
	const d = rs.dealbreakers;
	return Array.isArray(d) ? d.map(String) : [];
}

export async function executeMatching(supabase: SupabaseClient<Database>, topN: number = 10): Promise<number> {
	const { data: profiles } = await supabase.from("profiles").select("*").eq("status", "confirmed");
	if (!profiles?.length) return 0;
	const { data: blocks } = await supabase.from("blocks").select("blocker_id, blocked_id");
	const blockSet = new Set((blocks ?? []).map((b) => `${b.blocker_id}:${b.blocked_id}`));
	const isBlocked = (a: string, b: string) => blockSet.has(`${a}:${b}`) || blockSet.has(`${b}:${a}`);
	const { data: existing } = await supabase.from("matches").select("user_a_id, user_b_id");
	const existingSet = new Set(
		(existing ?? []).map((m) => (m.user_a_id < m.user_b_id ? `${m.user_a_id}:${m.user_b_id}` : `${m.user_b_id}:${m.user_a_id}`)),
	);
	const scored: { userA: string; userB: string; score: number; details: Record<string, number> }[] = [];
	for (let i = 0; i < profiles.length; i++) {
		for (let j = i + 1; j < profiles.length; j++) {
			const idA = profiles[i].user_id;
			const idB = profiles[j].user_id;
			if (idA === idB || isBlocked(idA, idB)) continue;
			const key = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
			if (existingSet.has(key)) continue;
			const { score, details } = computeMatchScore(profiles[i], profiles[j]);
			scored.push({ userA: idA, userB: idB, score, details });
		}
	}
	scored.sort((a, b) => b.score - a.score);
	const perUser = new Map<string, number>();
	const toInsert: { user_a_id: string; user_b_id: string; profile_score: number; score_details: Record<string, number> }[] = [];
	for (const s of scored) {
		const countA = perUser.get(s.userA) ?? 0;
		const countB = perUser.get(s.userB) ?? 0;
		if (countA >= topN || countB >= topN) continue;
		toInsert.push({
			user_a_id: s.userA < s.userB ? s.userA : s.userB,
			user_b_id: s.userA < s.userB ? s.userB : s.userA,
			profile_score: s.score,
			score_details: s.details,
		});
		perUser.set(s.userA, countA + 1);
		perUser.set(s.userB, countB + 1);
	}
	if (toInsert.length === 0) return 0;
	const { data: inserted } = await supabase.from("matches").insert(toInsert).select("id");
	if (!inserted?.length) return 0;
	for (const m of inserted) {
		await supabase.from("fox_conversations").insert({ match_id: m.id, status: "pending" });
	}
	return inserted.length;
}

export function computeMatchScore(
	profileA: ProfileRow,
	profileB: ProfileRow,
): { score: number; details: Record<string, number> } {
	const dealbreakersA = getDealbreakers(profileA);
	const dealbreakersB = getDealbreakers(profileB);
	if (dealbreakersA.length || dealbreakersB.length) {
		// Simplified: no dealbreaker matching for now; could check against profile tags
	}
	const personality = getPersonalityScore(profileA, profileB);
	const interests = getInterestsScore(profileA, profileB);
	const values = getValuesScore(profileA, profileB);
	const communication = getCommunicationScore(profileA, profileB);
	const lifestyle = getLifestyleScore(profileA, profileB);
	const score =
		personality * WEIGHTS.personality +
		interests * WEIGHTS.interests +
		values * WEIGHTS.values +
		communication * WEIGHTS.communication +
		lifestyle * WEIGHTS.lifestyle;
	const scaled = Math.round(score * 100);
	return {
		score: Math.min(100, scaled),
		details: {
			personality: Math.round(personality * 100),
			interests: Math.round(interests * 100),
			values: Math.round(values * 100),
			communication: Math.round(communication * 100),
			lifestyle: Math.round(lifestyle * 100),
		},
	};
}
