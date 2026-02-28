import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuthMe } from "@/lib/hooks/useAuthMe";
import {
	useConfirmProfile,
	useGenerateProfile,
	useProfileMe,
	useResetProfile,
} from "@/lib/hooks/useProfile";
import { useGenerateWingfoxPersona, usePersonasList } from "@/lib/hooks/usePersonasApi";
import { ApiError } from "@/lib/api";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { InteractionDnaRadar } from "@/components/InteractionDnaRadar";
import { InteractionDnaDetails } from "@/components/InteractionDnaDetails";
import type { InteractionStyleWithDna } from "@/lib/types";
import { ChevronRight, Loader2, Pause, Play, RotateCcw, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

function ScoreBar({ value, label }: { value: number; label: string }) {
	const pct = Math.round(value * 100);
	return (
		<div className="space-y-1">
			<div className="flex justify-between text-xs">
				<span>{label}</span>
				<span className="text-muted-foreground">{pct}%</span>
			</div>
			<div className="h-1.5 rounded-full bg-muted overflow-hidden">
				<div
					className="h-full rounded-full bg-secondary transition-all"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

function TagBadge({ label }: { label: string }) {
	return (
		<span className="inline-block rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
			{label}
		</span>
	);
}

export function OnboardingReview() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: authMe } = useAuthMe();
	const profileMe = useProfileMe();
	const { data: personasList } = usePersonasList("wingfox");
	const generateProfile = useGenerateProfile();
	const generateWingfox = useGenerateWingfoxPersona();
	const confirmProfile = useConfirmProfile();
	const resetProfile = useResetProfile();

	const [generating, setGenerating] = useState(false);
	const [generationDone, setGenerationDone] = useState(false);
	const [generationFailed, setGenerationFailed] = useState(false);
	const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(true); // User control for auto-generation

	const status = authMe?.onboarding_status ?? "not_started";
	const needsGeneration =
		status === "speed_dating_completed" && !generationDone && !generateProfile.isSuccess;

	useEffect(() => {
		if (status !== "speed_dating_completed" || generationDone || generating || generationFailed) return;
		if (!autoGenerateEnabled) return; // Respect user's choice to disable auto-generation
		
		let cancelled = false;
		(async () => {
			setGenerating(true);
			try {
				await generateProfile.mutateAsync();
				if (cancelled) return;
				await generateWingfox.mutateAsync();
				if (cancelled) return;
				setGenerationDone(true);
			} catch (e) {
				if (!cancelled) setGenerationFailed(true);
				const err = e as ApiError;
				const message =
					err?.code === "CONFLICT" && err?.message?.includes("Profile not generated")
						? t("review.profile_not_generated")
						: err?.message
							? `${t("review.confirm_error")}: ${err.message}`
							: t("review.confirm_error");
				console.error(e);
				toast.error(message);
			} finally {
				if (!cancelled) setGenerating(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [status, generationDone, generating, generationFailed, autoGenerateEnabled, generateProfile, generateWingfox, t]);

	const handleConfirm = async () => {
		try {
			await confirmProfile.mutateAsync();
			// Wait for auth cache to reflect "confirmed" before navigating,
			// otherwise the route guard may read stale status and bounce back.
			await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
			toast.success(t("review.confirm_success"));
			navigate({ to: "/personas/me" });
		} catch (e) {
			const err = e as ApiError;
			if (err?.code === "CONFLICT" && err?.message?.includes("Wingfox persona not generated")) {
				toast.error(t("review.wingfox_not_ready"));
				return;
			}
			console.error(e);
			toast.error(err?.message ? `${t("review.confirm_failed")}: ${err.message}` : t("review.confirm_error"));
		}
	};

	const handleManualGenerate = async () => {
		setGenerating(true);
		setGenerationFailed(false);
		try {
			await generateProfile.mutateAsync();
			await generateWingfox.mutateAsync();
			setGenerationDone(true);
			toast.success(t("review.profile_ready"));
		} catch (e) {
			setGenerationFailed(true);
			const err = e as ApiError;
			const message =
				err?.code === "CONFLICT" && err?.message?.includes("Profile not generated")
					? t("review.profile_not_generated")
					: err?.message
						? `${t("review.confirm_error")}: ${err.message}`
						: t("review.confirm_error");
			console.error(e);
			toast.error(message);
		} finally {
			setGenerating(false);
		}
	};

	const handleRetryWingfox = async () => {
		try {
			await generateWingfox.mutateAsync();
			toast.success(t("review.wingfox_generated"));
			await queryClient.invalidateQueries({ queryKey: ["personas"] });
		} catch (e) {
			const err = e as ApiError;
			const msg =
				err?.code === "CONFLICT" && err?.message?.includes("Profile not generated")
					? t("review.profile_needs_generation")
					: err?.message ?? t("review.wingfox_gen_failed");
			console.error(e);
			toast.error(msg);
		}
	};

	const handleReset = async () => {
		try {
			await resetProfile.mutateAsync();
			toast.success(t("review.reset_success"));
			navigate({ to: "/onboarding/quiz" });
		} catch (e) {
			console.error(e);
			toast.error(t("review.confirm_error"));
		}
	};

	const profile = profileMe.data;
	const wingfox = personasList && personasList.length > 0 ? personasList[0] : null;
	const isLoading =
		profileMe.isLoading ||
		(needsGeneration && generating) ||
		(needsGeneration && generateProfile.isPending);
	const reviewVisible =
		!isLoading && !(needsGeneration && !generationDone);
	const isReady =
		reviewVisible && (wingfox != null || generateWingfox.isSuccess);

	const interactionStyle = profile?.interaction_style as InteractionStyleWithDna | undefined;
	const hasDnaScores = interactionStyle?.dna_scores != null && Object.keys(interactionStyle.dna_scores).length > 0;
	const basicInfoLabelMap: Record<string, string> = {
		location: t("review.location"),
		age_range: t("review.age_range"),
		occupation: t("review.occupation"),
		display_name: t("review.display_name"),
	};

	if (isLoading || (needsGeneration && !generationDone)) {
		return (
			<div className="p-4 md:p-6 w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-6">
				{generating ? (
					<>
						<div className="relative w-24 h-24">
							<div className="absolute inset-0 border-[6px] border-secondary/10 border-t-secondary rounded-full animate-spin" />
							<div className="absolute inset-0 flex items-center justify-center">
								<Sparkles className="w-10 h-10 text-secondary" />
							</div>
						</div>
						<h3 className="text-xl font-bold">{t("speed_dating.creating")}</h3>
						<p className="text-sm text-muted-foreground">
							{t("speed_dating.sync_description")}
						</p>
					</>
				) : (
					<>
						<h3 className="text-xl font-bold">{t("review.profile_needs_generation")}</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md">
							{t("review.profile_not_generated")}
						</p>
						<div className="flex gap-3">
							<button
								onClick={handleManualGenerate}
								disabled={generating}
								className="px-6 py-2 bg-secondary text-secondary-foreground rounded-full font-medium hover:bg-secondary/90 transition-colors flex items-center gap-2"
							>
								<Send className="w-4 h-4" />
								{t("review.confirm")}
							</button>
							<button
								onClick={() => setAutoGenerateEnabled(!autoGenerateEnabled)}
								className="px-4 py-2 border border-border rounded-full text-sm hover:bg-muted transition-colors flex items-center gap-2"
							>
								{autoGenerateEnabled ? (
									<>
										<Pause className="w-3 h-3" />
										{t("review.disable_auto")}
									</>
								) : (
									<>
										<Play className="w-3 h-3" />
										{t("review.enable_auto")}
									</>
								)}
							</button>
						</div>
						{generationFailed && (
							<div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive max-w-md text-center">
								{t("review.generation_failed_title")}
							</div>
						)}
					</>
				)}
				</div>
		);
	}

	return (
		<div className="p-4 md:p-6 w-full max-w-2xl mx-auto space-y-6 pb-20">
			<Card>
				<CardHeader>
					<CardTitle>{t("review.title")}</CardTitle>
					<CardDescription>{t("review.description")}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{profile && (
						<div className="space-y-4">
							<h4 className="text-sm font-semibold">{t("review.profile_summary")}</h4>
							<div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-4">
								{/* Personality traits */}
								{profile.personality_tags && profile.personality_tags.length > 0 && (
									<div className="space-y-2">
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											{t("review.personality_traits")}
										</span>
										<div className="flex flex-wrap gap-1.5">
											{profile.personality_tags.map((tag: string) => (
												<TagBadge key={tag} label={tag} />
											))}
										</div>
									</div>
								)}

								{/* Basic info */}
								{profile.basic_info &&
									typeof profile.basic_info === "object" &&
									Object.keys(profile.basic_info).length > 0 && (
										<div className="space-y-2">
											<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
												{t("review.basic_info")}
											</span>
											<ul className="space-y-0.5 text-sm">
												{Object.entries(profile.basic_info).map(([key, value]) => {
													if (value == null || value === "") return null;
													const label = basicInfoLabelMap[key] ?? key;
													return (
														<li key={key} className="flex gap-2">
															<span className="text-muted-foreground">{label}:</span>
															<span>{String(value)}</span>
														</li>
													);
												})}
											</ul>
										</div>
									)}

								{/* Interaction style — DNA radar or fallback ScoreBar */}
								{interactionStyle && hasDnaScores && interactionStyle.dna_scores ? (
									<div className="space-y-3">
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											{t("review.interaction_dna")}
										</span>
										{interactionStyle.overall_signature && (
											<p className="text-sm italic text-muted-foreground">
												"{interactionStyle.overall_signature}"
											</p>
										)}
										<div className="flex justify-center">
											<InteractionDnaRadar scores={interactionStyle.dna_scores} size={280} />
										</div>
										<InteractionDnaDetails scores={interactionStyle.dna_scores} />
									</div>
								) : interactionStyle && Object.keys(interactionStyle).length > 0 ? (
									<div className="space-y-3">
										<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
											{t("review.interaction_style")}
										</span>
										<div className="grid gap-2">
											{typeof interactionStyle.warmup_speed === "number" && (
												<ScoreBar value={interactionStyle.warmup_speed} label={t("review.warmup_speed")} />
											)}
											{typeof interactionStyle.humor_responsiveness === "number" && (
												<ScoreBar value={interactionStyle.humor_responsiveness} label={t("review.humor_responsiveness")} />
											)}
											{typeof interactionStyle.self_disclosure_depth === "number" && (
												<ScoreBar value={interactionStyle.self_disclosure_depth} label={t("review.self_disclosure_depth")} />
											)}
											{typeof interactionStyle.emotional_responsiveness === "number" && (
												<ScoreBar value={interactionStyle.emotional_responsiveness} label={t("review.emotional_responsiveness")} />
											)}
											{typeof interactionStyle.mirroring_tendency === "number" && (
												<ScoreBar value={interactionStyle.mirroring_tendency} label={t("review.mirroring_tendency")} />
											)}
											{typeof interactionStyle.conflict_style === "string" && (
												<div className="flex gap-2 text-xs">
													<span className="text-muted-foreground">{t("review.conflict_style")}:</span>
													<TagBadge label={interactionStyle.conflict_style} />
												</div>
											)}
											{typeof interactionStyle.attachment_tendency === "string" && (
												<div className="flex gap-2 text-xs">
													<span className="text-muted-foreground">{t("review.attachment_tendency")}:</span>
													<TagBadge label={interactionStyle.attachment_tendency} />
												</div>
											)}
											{typeof interactionStyle.rhythm_preference === "string" && (
												<div className="flex gap-2 text-xs">
													<span className="text-muted-foreground">{t("review.rhythm_preference")}:</span>
													<TagBadge label={interactionStyle.rhythm_preference} />
												</div>
											)}
										</div>
									</div>
								) : null}

								{(!profile.personality_tags || profile.personality_tags.length === 0) &&
									(!profile.basic_info ||
										typeof profile.basic_info !== "object" ||
										Object.keys(profile.basic_info).length === 0) && (
										<p className="text-muted-foreground">
											{t("review.profile_ready")}
										</p>
									)}
							</div>
						</div>
					)}

					{wingfox && (
						<div className="space-y-2">
							<h4 className="text-sm font-semibold">{t("review.wingfox")}</h4>
							<p className="text-sm text-muted-foreground">
								{wingfox.name} (v{wingfox.version ?? 1})
							</p>
						</div>
					)}

					{reviewVisible && profile && !wingfox && (
						<div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm space-y-2">
							<h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
								{t("review.wingfox_not_generated")}
							</h4>
							<p className="text-muted-foreground">
								{t("review.wingfox_not_generated_desc")}
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={handleRetryWingfox}
								disabled={generateWingfox.isPending}
								className="mt-2"
							>
								{generateWingfox.isPending ? (
									<Loader2 className="size-4 animate-spin mr-2" />
								) : (
									<Sparkles className="size-4 mr-2" />
								)}
								{t("review.wingfox_regenerate")}
							</Button>
						</div>
					)}

					<div className="flex flex-col sm:flex-row gap-4 pt-4">
						<Button
							onClick={handleConfirm}
							disabled={confirmProfile.isPending || !isReady}
							className="flex-1"
						>
							{confirmProfile.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<>
									{t("review.confirm")}
									<ChevronRight className="size-4" />
								</>
							)}
						</Button>
						<Button
							variant="outline"
							onClick={handleReset}
							disabled={resetProfile.isPending}
						>
							<RotateCcw className="size-4 mr-2" />
							{t("review.reset")}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
