import { Button } from "@/components/ui/button";
import { OnboardingStepLabel } from "@/components/onboarding/OnboardingContainer";
import {
	useQuizQuestions,
	useQuizAnswers,
	useSubmitQuizAnswers,
	type QuizQuestion,
} from "@/lib/hooks/useQuiz";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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

export function OnboardingQuiz() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
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
					returnObjects: true,
				}) as string[] | Record<string, unknown>,
			)
		: [];
	const currentSelected = current ? answers[current.id] ?? [] : [];
	const hasCurrentSelection = currentSelected.length > 0;
	const progress = sortedQuestions.length > 0 ? (step + 1) / sortedQuestions.length : 0;

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
			navigate({ to: "/onboarding/speed-dating" });
		} catch (e) {
			console.error(e);
			toast.error(t("quiz.submit_error"));
		}
	}, [sortedQuestions, answers, submit, t, navigate]);

	if (isLoading || !questions?.length) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

		return (
		<div className="space-y-6">
			<div className="w-full h-2 rounded-full bg-muted overflow-hidden">
				<div
					className="h-full bg-secondary transition-all duration-300"
					style={{ width: `${progress * 100}%` }}
					role="progressbar"
					aria-valuenow={Math.round(progress * 100)}
					aria-valuemin={0}
					aria-valuemax={100}
				/>
			</div>

			<div className="rounded-2xl border border-border bg-card p-8 md:p-10 shadow-sm">
				<div className="space-y-6">
					<div className="space-y-1">
						<OnboardingStepLabel step={2} total={4} />
						<p className="text-muted-foreground text-sm">
							{step + 1} / {sortedQuestions.length}
						</p>
						<h2 className="text-2xl font-bold tracking-tight">
							{t("quiz.title")}
						</h2>
						<p className="text-sm text-muted-foreground">
							{t("quiz.description")}
						</p>
					</div>

					{current && (
						<>
							<div>
								<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									{t(`quiz.categories.${current.category}`)}
								</span>
								<h3 className="text-lg font-semibold mt-1">
									{t(`quiz.questions.${current.id}.text`)}
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
												"rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all flex items-center gap-3",
												isSelected
													? "border-secondary bg-secondary/10 text-secondary"
													: "border-border bg-background hover:bg-muted/50",
											)}
										>
											{current.allow_multiple && (
												<span
													className={cn(
														"flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
														isSelected
															? "border-secondary bg-secondary text-secondary-foreground"
															: "border-muted-foreground/30",
													)}
												>
													{isSelected ? (
														<Check className="h-3 w-3" />
													) : null}
												</span>
											)}
											{opt.label}
										</button>
									);
								})}
							</div>
						</>
					)}

					<div className="flex items-center justify-between pt-4 border-t border-border">
						<Button
							variant="outline"
							size="sm"
							onClick={handlePrev}
							disabled={step === 0}
							className="rounded-full gap-1"
						>
							<ChevronLeft className="size-4" />
							{t("quiz.prev")}
						</Button>
						{step < sortedQuestions.length - 1 ? (
							<Button
								size="sm"
								onClick={handleNext}
								disabled={!hasCurrentSelection}
								variant="secondary"
								className="rounded-full gap-1"
							>
								{t("quiz.next")}
								<ChevronRight className="size-4" />
							</Button>
						) : (
							<Button
								size="sm"
								onClick={handleSubmit}
								disabled={submit.isPending || !hasCurrentSelection}
								variant="secondary"
								className="rounded-full gap-2"
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
				</div>
			</div>
		</div>
	);
}
