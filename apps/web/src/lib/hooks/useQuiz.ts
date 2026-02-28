import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface QuizQuestion {
	id: string;
	category: string;
	question_text: string;
	options: string[] | Record<string, unknown>;
	allow_multiple?: boolean;
	sort_order?: number;
}

export function useQuizQuestions() {
	return useQuery({
		queryKey: ["quiz", "questions"],
		queryFn: async (): Promise<QuizQuestion[]> => {
			const res = await client.api.quiz.questions.$get();
			return unwrapApiResponse<QuizQuestion[]>(res);
		},
	});
}

export function useQuizAnswers() {
	return useQuery({
		queryKey: ["quiz", "answers"],
		queryFn: async () => {
			const res = await client.api.quiz.answers.$get();
			return unwrapApiResponse(res);
		},
	});
}

export function useSubmitQuizAnswers() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (answers: { question_id: string; selected: string[] }[]) => {
			const res = await client.api.quiz.answers.$post({ json: { answers } });
			return unwrapApiResponse<{ message: string; count: number }>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["quiz", "answers"] });
		},
	});
}
