import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { z } from "zod";

const quiz = new Hono<Env>();

const postAnswersSchema = z.object({
	answers: z.array(
		z.object({
			question_id: z.string(),
			selected: z.array(z.string()),
		}),
	),
});

/** GET /api/quiz/questions - list all quiz questions */
quiz.get("/questions", requireAuth, async (c) => {
	const supabase = getSupabaseClient(c.env);
	const { data, error } = await supabase
		.from("quiz_questions")
		.select("id, category, allow_multiple, sort_order")
		.order("sort_order", { ascending: true });
	if (error) {
		console.error("quiz questions error:", error);
		return jsonError(c, "INTERNAL_ERROR", "Failed to fetch questions");
	}
	return jsonData(c, data ?? []);
});

/** POST /api/quiz/answers - submit answers (UPSERT), set onboarding_status to quiz_completed */
quiz.post("/answers", requireAuth, async (c) => {
	const parsed = postAnswersSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return jsonError(c, "BAD_REQUEST", parsed.error.message);
	}
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);

	// Get valid question ids
	const { data: questions } = await supabase.from("quiz_questions").select("id");
	const validIds = new Set((questions ?? []).map((q) => q.id));

	for (const { question_id, selected } of parsed.data.answers) {
		if (!validIds.has(question_id)) continue;
		await supabase.from("quiz_answers").upsert(
			{
				user_id: userId,
				question_id,
				selected,
			},
			{ onConflict: "user_id,question_id" },
		);
	}

	await supabase
		.from("user_profiles")
		.update({ onboarding_status: "quiz_completed", updated_at: new Date().toISOString() })
		.eq("id", userId);

	return jsonData(c, { message: "Answers saved", count: parsed.data.answers.length });
});

/** GET /api/quiz/answers - get my answers */
quiz.get("/answers", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const { data, error } = await supabase
		.from("quiz_answers")
		.select("question_id, selected")
		.eq("user_id", userId);
	if (error) {
		console.error("quiz answers error:", error);
		return jsonError(c, "INTERNAL_ERROR", "Failed to fetch answers");
	}
	return jsonData(c, data ?? []);
});

export default quiz;
