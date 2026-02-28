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
import { ChevronRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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

	const status = authMe?.onboarding_status ?? "not_started";
	const needsGeneration =
		status === "speed_dating_completed" && !generationDone && !generateProfile.isSuccess;

	useEffect(() => {
		if (status !== "speed_dating_completed" || generationDone || generating) return;
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
				const err = e as ApiError;
				const message =
					err?.code === "CONFLICT" && err?.message?.includes("Profile not generated")
						? "プロフィールがまだ生成されていません。"
						: err?.message
							? `生成エラー: ${err.message}`
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
	}, [status, generationDone, generating]);

	const handleConfirm = async () => {
		try {
			await confirmProfile.mutateAsync();
			toast.success(t("review.confirm_success"));
			navigate({ to: "/personas/me" });
		} catch (e) {
			const err = e as ApiError;
			if (err?.code === "CONFLICT" && err?.message?.includes("Wingfox persona not generated")) {
				toast.error("ウィングフォックスがまだ生成されていません。Start over でオンボーディングをやり直すか、しばらく待ってから再度お試しください。");
				return;
			}
			console.error(e);
			toast.error(err?.message ? `確認に失敗しました: ${err.message}` : t("review.confirm_error"));
		}
	};

	const handleRetryWingfox = async () => {
		try {
			await generateWingfox.mutateAsync();
			toast.success("ウィングフォックスを生成しました");
			await queryClient.invalidateQueries({ queryKey: ["personas"] });
		} catch (e) {
			const err = e as ApiError;
			const msg =
				err?.code === "CONFLICT" && err?.message?.includes("Profile not generated")
					? "先にプロフィールが生成されている必要があります。"
					: err?.message ?? "ウィングフォックスの生成に失敗しました";
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
	// ウィングフォックスが存在する場合のみ Confirm 可能（未生成だと API が CONFLICT を返す）
	const isReady =
		reviewVisible && (wingfox != null || generateWingfox.isSuccess);

	if (isLoading || (needsGeneration && !generationDone)) {
		return (
			<div className="p-4 md:p-6 w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-6">
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
						<div className="space-y-2">
							<h4 className="text-sm font-semibold">プロフィール概要</h4>
							<div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
								{profile.personality_tags && profile.personality_tags.length > 0 && (
									<p>
										<span className="text-muted-foreground">性格タグ: </span>
										{profile.personality_tags.join(", ")}
									</p>
								)}
								{profile.basic_info &&
									typeof profile.basic_info === "object" &&
									Object.keys(profile.basic_info).length > 0 && (
										<div>
											<span className="text-muted-foreground">基本情報: </span>
											<ul className="mt-1 list-disc list-inside space-y-0.5">
												{Object.entries(profile.basic_info).map(([key, value]) => {
													if (value == null || value === "") return null;
													const label =
														key === "location"
															? "居住地"
															: key === "age_range"
																? "年齢層"
																: key === "occupation"
																	? "職業"
																	: key === "display_name"
																		? "表示名"
																		: key;
													return (
														<li key={key}>
															{label}: {String(value)}
														</li>
													);
												})}
											</ul>
										</div>
									)}
								{(!profile.personality_tags || profile.personality_tags.length === 0) &&
									(!profile.basic_info ||
										typeof profile.basic_info !== "object" ||
										Object.keys(profile.basic_info).length === 0) && (
										<p className="text-muted-foreground">
											プロフィールが生成されました。確定してマッチングを開始しましょう。
										</p>
									)}
							</div>
						</div>
					)}

					{wingfox && (
						<div className="space-y-2">
							<h4 className="text-sm font-semibold">ウィングフォックス</h4>
							<p className="text-sm text-muted-foreground">
								{wingfox.name} (v{wingfox.version ?? 1})
							</p>
						</div>
					)}

					{reviewVisible && profile && !wingfox && (
						<div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm space-y-2">
							<h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
								ウィングフォックスがまだ生成されていません
							</h4>
							<p className="text-muted-foreground">
								プロフィールはありますが、AIペルソナの生成に失敗したか、まだ完了していない可能性があります。下のボタンで再生成を試すか、Start over でオンボーディングを最初からやり直してください。
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
								ウィングフォックスを再生成
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
