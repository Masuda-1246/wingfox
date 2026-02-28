import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	useQuizQuestions,
	useQuizAnswers,
	useSubmitQuizAnswers,
	type QuizQuestion,
} from "@/lib/hooks/useQuiz";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";

type OptionItem = { value: string; label: string };

function normalizeOptions(
	options: string[] | Record<string, unknown>,
): OptionItem[] {
	if (Array.isArray(options)) {
		return options.map((o) =>
			typeof o === "string"
				? { value: o, label: o }
				: {
						value: (o as OptionItem).value,
						label: (o as OptionItem).label,
					},
		);
	}
	const arr = options as unknown as OptionItem[] | undefined;
	return Array.isArray(arr) ? arr : [];
}

export function Quiz() {
	const { t } = useTranslation(["personas", "onboarding"]);
	const { data: questions, isLoading } = useQuizQuestions();
	const { data: quizAnswersData } = useQuizAnswers();
	const submit = useSubmitQuizAnswers();
	const [step, setStep] = useState(0);
	const [answers, setAnswers] = useState<Record<string, string[]>>({});
	const hasInitializedAnswers = useRef(false);

	const sortedQuestions = useMemo(
		() =>
			[...(questions ?? [])].sort(
				(a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
			),
		[questions],
	);

	// DBに既存の回答がある場合やセクションに戻ったときに表示
	useEffect(() => {
		if (hasInitializedAnswers.current || !sortedQuestions.length) return;
		if (quizAnswersData === undefined) return; // まだ取得中
		const data = Array.isArray(quizAnswersData) ? quizAnswersData : [];
		const initial: Record<string, string[]> = {};
		for (const row of data) {
			initial[row.question_id] = Array.isArray(row.selected) ? row.selected : [];
		}
		setAnswers((prev) => (Object.keys(prev).length > 0 ? prev : initial));
		hasInitializedAnswers.current = true;
	}, [quizAnswersData, sortedQuestions.length]);

	const current = sortedQuestions[step];
	const options = current
		? normalizeOptions(
				t(`quiz.questions.${current.id}.options`, {
					ns: "onboarding",
					returnObjects: true,
				}) as string[] | Record<string, unknown>,
			)
		: [];
	const currentSelected = current ? answers[current.id] ?? [] : [];
	const hasCurrentSelection = currentSelected.length > 0;

	const handleSelect = useCallback(
		(q: QuizQuestion, value: string) => {
			const next = { ...answers };
			const arr = next[q.id] ?? [];
			if (q.allow_multiple) {
				if (arr.includes(value)) {
					next[q.id] = arr.filter((v) => v !== value);
				} else {
					next[q.id] = [...arr, value];
				}
			} else {
				next[q.id] = [value];
			}
			setAnswers(next);
		},
		[answers],
	);

	const handlePrev = useCallback(() => {
		setStep((s) => Math.max(0, s - 1));
	}, []);

	const handleNext = useCallback(() => {
		if (step < sortedQuestions.length - 1) {
			setStep((s) => s + 1);
		}
	}, [step, sortedQuestions.length]);

	const handleSubmit = useCallback(async () => {
		const payload = sortedQuestions.map((q) => ({
			question_id: q.id,
			selected: answers[q.id] ?? [],
		}));
		try {
			await submit.mutateAsync(payload);
			toast.success(t("quiz.submit_success"));
		} catch (e) {
			console.error(e);
			toast.error(t("quiz.submit_error"));
		}
	}, [sortedQuestions, answers, submit, t]);

	if (isLoading || !questions?.length) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("quiz.title")}</CardTitle>
				<CardDescription>{t("quiz.description")}</CardDescription>
				<p className="text-muted-foreground text-sm pt-2">
					{step + 1} / {sortedQuestions.length}
				</p>
			</CardHeader>
			<CardContent className="space-y-6">
				{current && (
					<>
						<div>
							<span className="text-xs font-medium text-muted-foreground">
								{t(`quiz.categories.${current.category}`, {
									ns: "onboarding",
								})}
							</span>
							<h3 className="text-lg font-semibold mt-1">
								{t(`quiz.questions.${current.id}.text`, {
									ns: "onboarding",
								})}
							</h3>
						</div>
						<div
							className={cn(
								"grid gap-2",
								current.allow_multiple
									? "grid-cols-1"
									: "grid-cols-1 sm:grid-cols-2",
							)}
						>
							{options.map((opt) => {
								const isSelected = currentSelected.includes(opt.value);
								return (
									<button
										key={opt.value}
										type="button"
										onClick={() => handleSelect(current, opt.value)}
										className={cn(
											"rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors",
											isSelected
												? "border-primary bg-primary/10 text-primary"
												: "border-border bg-card hover:bg-accent/50",
										)}
									>
										{current.allow_multiple && (
											<span className="mr-2">
												{isSelected ? "☑" : "☐"}
											</span>
										)}
										{opt.label}
									</button>
								);
							})}
						</div>
					</>
				)}

				<div className="flex items-center justify-between pt-4">
					<Button
						variant="outline"
						size="sm"
						onClick={handlePrev}
						disabled={step === 0}
					>
						<ChevronLeft className="size-4" />
						{t("quiz.prev")}
					</Button>
					{step < sortedQuestions.length - 1 ? (
						<Button size="sm" onClick={handleNext} disabled={!hasCurrentSelection}>
							{t("quiz.next")}
							<ChevronRight className="size-4" />
						</Button>
					) : (
						<Button
							size="sm"
							onClick={handleSubmit}
							disabled={submit.isPending || !hasCurrentSelection}
						>
							{submit.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<>
									<Send className="size-4" />
									{t("quiz.submit")}
								</>
							)}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
