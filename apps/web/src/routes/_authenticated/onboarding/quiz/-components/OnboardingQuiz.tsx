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
	useSubmitQuizAnswers,
	type QuizQuestion,
} from "@/lib/hooks/useQuiz";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
	const arr = options as OptionItem[] | undefined;
	return Array.isArray(arr) ? arr : [];
}

export function OnboardingQuiz() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const { data: questions, isLoading } = useQuizQuestions();
	const submit = useSubmitQuizAnswers();
	const [step, setStep] = useState(0);
	const [answers, setAnswers] = useState<Record<string, string[]>>({});

	const sortedQuestions = useMemo(
		() =>
			[...(questions ?? [])].sort(
				(a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
			),
		[questions],
	);

	const current = sortedQuestions[step];
	const options = current ? normalizeOptions(current.options) : [];
	const currentSelected = current ? answers[current.id] ?? [] : [];
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
		<div className="p-4 md:p-6 w-full max-w-2xl mx-auto space-y-6 pb-20">
			<div className="w-full h-2 rounded-full bg-muted overflow-hidden">
				<div
					className="h-full bg-primary transition-all duration-300"
					style={{ width: `${progress * 100}%` }}
				/>
			</div>
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
									{current.category}
								</span>
								<h3 className="text-lg font-semibold mt-1">
									{current.question_text}
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
							<Button size="sm" onClick={handleNext}>
								{t("quiz.next")}
								<ChevronRight className="size-4" />
							</Button>
						) : (
							<Button
								size="sm"
								onClick={handleSubmit}
								disabled={submit.isPending}
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
		</div>
	);
}
