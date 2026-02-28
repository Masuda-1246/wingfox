import { type TranscriptEntry, useSpeedDate } from "@/hooks/use-speed-date";
import type { ApiError } from "@/lib/api";
import { useGenerateWingfoxPersona } from "@/lib/hooks/usePersonasApi";
import { useGenerateProfile } from "@/lib/hooks/useProfile";
import {
	useCompleteSpeedDatingSession,
	useSpeedDatingSessions,
	useSpeedDatingSignedUrl,
} from "@/lib/hooks/useSpeedDating";
import {
	type PersistedPersona,
	clearSpeedDatingSession,
	loadSpeedDatingSession,
	saveSpeedDatingSession,
} from "@/lib/speed-dating-session-storage";
import { useNavigate } from "@tanstack/react-router";
import { m } from "framer-motion";
import {
	CheckCircle2,
	Loader2,
	MicOff,
	RefreshCw,
	Sparkles,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type GenerationPhase = "profile" | "wingfox" | "complete" | "error";

const DATE_BACKGROUNDS = [
	"https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1920&q=80&auto=format",
	"https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=1920&q=80&auto=format",
	"https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920&q=80&auto=format",
];

function formatTime(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SpeedDatingSessionPage() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const createSession = useSpeedDatingSessions();
	const getSignedUrl = useSpeedDatingSignedUrl();
	const generateProfile = useGenerateProfile();
	const generateWingfox = useGenerateWingfoxPersona();
	const {
		status: voiceStatus,
		isSpeaking,
		transcript,
		remainingMs,
		error: voiceError,
		startDate,
		endDate,
		reset: resetVoice,
	} = useSpeedDate();

	const [personas, setPersonas] = useState<PersistedPersona[]>([]);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [personaIndex, setPersonaIndex] = useState(0);
	const [phase, setPhase] = useState<
		"loading" | "connecting" | "chat" | "next" | "finalizing"
	>("loading");
	const [loadingMessage, setLoadingMessage] = useState("");
	const [generationPhase, setGenerationPhase] =
		useState<GenerationPhase>("profile");
	const [generationError, setGenerationError] = useState<string | null>(null);
	const completeSession = useCompleteSpeedDatingSession(sessionId);
	const transcriptRef = useRef<TranscriptEntry[]>([]);
	const handledDoneRef = useRef(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		transcriptRef.current = transcript;
	}, [transcript]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: transcript is the intentional trigger to scroll on new messages
	useEffect(() => {
		if (!scrollRef.current) return;
		scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, [transcript]);

	// Restore from sessionStorage or redirect
	useEffect(() => {
		const stored = loadSpeedDatingSession();
		if (stored) {
			setPersonas(stored.personas);
			setSessionId(stored.sessionId);
			setPersonaIndex(stored.personaIndex);
			setPhase("connecting");
			setLoadingMessage(
				t("speed_dating.preparing_chat", {
					name: stored.personas[stored.personaIndex].name,
				}),
			);
			return;
		}
		// No stored state: go back to start
		navigate({ to: "/onboarding/speed-dating" as const });
	}, [navigate, t]);

	// When we have sessionId and phase is connecting: get signed URL and start voice
	useEffect(() => {
		if (phase !== "connecting" || !sessionId || personas.length === 0) return;
		const currentName = personas[personaIndex]?.name;
		if (!currentName) return;

		let cancelled = false;
		(async () => {
			try {
				const signedUrlData = await getSignedUrl.mutateAsync(sessionId);
				if (cancelled) return;
				setPhase("chat");
				await startDate({
					signedUrl: signedUrlData.signed_url,
					overrides: signedUrlData.overrides,
				});
			} catch (err) {
				if (!cancelled) {
					console.error("[SpeedDatingSession] getSignedUrl failed", err);
					toast.error(t("speed_dating.error_voice_failed"));
					clearSpeedDatingSession();
					navigate({ to: "/onboarding/speed-dating" as const });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [
		phase,
		sessionId,
		personaIndex,
		personas,
		getSignedUrl.mutateAsync,
		navigate,
		startDate,
		t,
	]);

	const runGeneration = useCallback(async () => {
		setGenerationPhase("profile");
		setGenerationError(null);
		try {
			await generateProfile.mutateAsync();
			setGenerationPhase("wingfox");
			await generateWingfox.mutateAsync();
			setGenerationPhase("complete");
			// Brief "All done!" pause before navigating
			await new Promise((resolve) => setTimeout(resolve, 800));
			navigate({ to: "/onboarding/review" });
		} catch (e) {
			console.error("[SpeedDatingSession] Generation failed:", e);
			const err = e as ApiError;
			setGenerationError(
				err?.message ?? t("speed_dating.generation_failed_desc"),
			);
			setGenerationPhase("error");
		}
	}, [generateProfile, generateWingfox, navigate, t]);

	// When voice ends: complete session, then next or start generation
	useEffect(() => {
		if (voiceStatus !== "done") {
			handledDoneRef.current = false;
			return;
		}
		if (handledDoneRef.current) return;
		handledDoneRef.current = true;

		const transcriptData = transcriptRef.current.map((e) => ({
			source: e.source,
			message: e.message,
		}));
		const persistPromise = completeSession.mutateAsync(transcriptData);

		const run = async () => {
			try {
				if (personaIndex < personas.length - 1) {
					const nextIndex = personaIndex + 1;
					const nextPersona = personas[nextIndex];
					if (!nextPersona) return;
					setLoadingMessage(
						t("speed_dating.preparing_chat", { name: nextPersona.name }),
					);
					setPhase("next");

					const nextSession = (await createSession.mutateAsync(
						nextPersona.id,
					)) as { session_id: string };
					const signedUrlData = await getSignedUrl.mutateAsync(
						nextSession.session_id,
					);

					void persistPromise.catch((e) => {
						console.error("[SpeedDatingSession] persist failed", e);
						toast.error(t("speed_dating.error_session_save_failed"));
					});

					saveSpeedDatingSession({
						personas,
						sessionId: nextSession.session_id,
						personaIndex: nextIndex,
					});
					setSessionId(nextSession.session_id);
					setPersonaIndex(nextIndex);
					resetVoice();
					setPhase("chat");
					await startDate({
						signedUrl: signedUrlData.signed_url,
						overrides: signedUrlData.overrides,
					});
				} else {
					// Last date done — persist transcript, then start generation
					await persistPromise;
					clearSpeedDatingSession();
					setPhase("finalizing");
					void runGeneration();
				}
			} catch (e) {
				console.error(e);
				toast.error(t("speed_dating.error_complete_failed"));
				setPhase("chat");
			}
		};
		run();
	}, [
		voiceStatus,
		personaIndex,
		personas,
		completeSession.mutateAsync,
		getSignedUrl.mutateAsync,
		createSession.mutateAsync,
		resetVoice,
		runGeneration,
		t,
		startDate,
	]);

	const handleEndConversation = useCallback(() => endDate(), [endDate]);

	const currentName = personas[personaIndex]?.name ?? "";
	const isLowTime = remainingMs < 30_000;
	const isVoiceActive =
		voiceStatus === "talking" || voiceStatus === "connecting";

	const GENERATION_STEPS = [
		{ key: "profile" as const, label: t("speed_dating.step_profile") },
		{ key: "wingfox" as const, label: t("speed_dating.step_wingfox") },
	];

	if (personas.length === 0) {
		return null; // redirecting
	}

	// Finalizing phase: generation progress
	if (phase === "finalizing") {
		return (
			<div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-8">
				{generationPhase !== "error" ? (
					<>
						<div className="relative w-24 h-24">
							{generationPhase === "complete" ? (
								<div className="absolute inset-0 flex items-center justify-center">
									<CheckCircle2 className="w-16 h-16 text-green-500" />
								</div>
							) : (
								<>
									<div className="absolute inset-0 border-[6px] border-secondary/10 border-t-secondary rounded-full animate-spin" />
									<div className="absolute inset-0 flex items-center justify-center">
										<Sparkles className="w-10 h-10 text-secondary" />
									</div>
								</>
							)}
						</div>

						<div className="text-center space-y-2">
							<h3 className="text-xl font-bold">
								{generationPhase === "profile" &&
									t("speed_dating.generating_profile")}
								{generationPhase === "wingfox" &&
									t("speed_dating.generating_wingfox")}
								{generationPhase === "complete" &&
									t("speed_dating.generation_complete")}
							</h3>
						</div>

						{/* 2-step progress indicator */}
						<div className="flex items-center gap-3">
							{GENERATION_STEPS.map((s, i) => {
								const stepOrder = ["profile", "wingfox", "complete"] as const;
								const currentIdx = stepOrder.indexOf(generationPhase);
								const stepIdx = i;
								const isDone = currentIdx > stepIdx;
								const isActive = currentIdx === stepIdx;

								return (
									<div key={s.key} className="flex items-center gap-3">
										{i > 0 && (
											<div
												className={`w-8 h-0.5 ${isDone ? "bg-green-500" : "bg-muted"}`}
											/>
										)}
										<div className="flex items-center gap-2">
											<div
												className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
													isDone
														? "bg-green-500 text-white"
														: isActive
															? "bg-secondary text-white"
															: "bg-muted text-muted-foreground"
												}`}
											>
												{isDone ? (
													<CheckCircle2 className="w-4 h-4" />
												) : isActive ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : (
													i + 1
												)}
											</div>
											<span
												className={`text-sm font-medium ${isDone ? "text-green-600" : isActive ? "text-foreground" : "text-muted-foreground"}`}
											>
												{s.label}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</>
				) : (
					<>
						<XCircle className="w-16 h-16 text-red-500" />
						<div className="text-center space-y-2">
							<h3 className="text-xl font-bold">
								{t("speed_dating.generation_failed_title")}
							</h3>
							<p className="text-sm text-muted-foreground max-w-md">
								{generationError ?? t("speed_dating.generation_failed_desc")}
							</p>
						</div>
						<div className="flex gap-4">
							<button
								type="button"
								onClick={() => void runGeneration()}
								className="px-6 py-3 bg-foreground text-background rounded-full font-bold text-sm hover:scale-105 transition-all flex items-center gap-2"
							>
								<RefreshCw className="w-4 h-4" />
								{t("speed_dating.retry_generation")}
							</button>
							<button
								type="button"
								onClick={() => navigate({ to: "/onboarding/review" })}
								className="px-6 py-3 border border-border rounded-full font-bold text-sm hover:bg-muted transition-all"
							>
								{t("speed_dating.skip_to_review")}
							</button>
						</div>
					</>
				)}
			</div>
		);
	}

	// Full-screen overlay for connecting or "next" phase
	if (phase === "connecting" || phase === "next") {
		return (
			<div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6">
				<Loader2 className="w-10 h-10 animate-spin text-secondary" />
				<p className="text-lg font-bold">{loadingMessage}</p>
			</div>
		);
	}

	// Chat UI (phase === "chat")
	return (
		<div
			className="fixed inset-0 z-50 flex flex-col"
			style={{
				backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${DATE_BACKGROUNDS[personaIndex % DATE_BACKGROUNDS.length]})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
			}}
		>
			<div className="relative h-24 border-b border-white/10 bg-black/30 backdrop-blur-md px-6 flex items-center justify-between">
				<div className="flex flex-col">
					<span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
						{t("speed_dating.tonights_dates")}
					</span>
					<div className="flex gap-3 mt-2">
						{personas.map((p, i) => (
							<div
								key={p.id}
								className={`relative transition-all ${i === personaIndex ? "scale-110" : "opacity-40"}`}
							>
								<div
									className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold text-white ${
										i === personaIndex
											? "border-secondary bg-secondary/20"
											: i < personaIndex
												? "border-green-400 bg-green-500/20"
												: "border-white/30 bg-white/10"
									}`}
								>
									{i < personaIndex ? (
										<CheckCircle2 className="w-5 h-5 text-green-400" />
									) : (
										p.name[0]
									)}
								</div>
								<span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase whitespace-nowrap text-white/80">
									{p.name}
								</span>
							</div>
						))}
					</div>
				</div>
				{isVoiceActive && (
					<div
						className={`font-mono text-2xl font-bold ${isLowTime ? "text-red-400 animate-pulse" : "text-white/70"}`}
					>
						{formatTime(remainingMs)}
					</div>
				)}
			</div>

			<div className="flex-1 flex flex-col items-center justify-center min-h-0 px-4">
				<div className="flex flex-col items-center gap-4 mb-8">
					<div
						className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-bold text-white transition-all ${
							isSpeaking
								? "border-secondary bg-secondary/20 shadow-lg shadow-secondary/30 scale-110"
								: "border-white/30 bg-white/10"
						}`}
					>
						{currentName[0] ?? "?"}
					</div>
					<div className="text-center">
						<p className="font-bold text-lg text-white">{currentName}</p>
						{voiceStatus === "connecting" && (
							<div className="flex items-center gap-2 mt-1">
								<Loader2 className="w-3 h-3 animate-spin text-white/60" />
								<p className="text-sm text-white/60">
									{t("speed_dating.connecting")}
								</p>
							</div>
						)}
						{voiceStatus === "talking" && (
							<div className="flex items-center justify-center gap-2 mt-1">
								{isSpeaking ? (
									<>
										<div className="flex gap-0.5">
											<span className="block h-3 w-1 animate-pulse rounded-full bg-secondary [animation-delay:0ms]" />
											<span className="block h-4 w-1 animate-pulse rounded-full bg-secondary [animation-delay:150ms]" />
											<span className="block h-3 w-1 animate-pulse rounded-full bg-secondary [animation-delay:300ms]" />
											<span className="block h-5 w-1 animate-pulse rounded-full bg-secondary [animation-delay:100ms]" />
											<span className="block h-3 w-1 animate-pulse rounded-full bg-secondary [animation-delay:250ms]" />
										</div>
										<span className="text-xs text-secondary">
											{t("speed_dating.speaking")}
										</span>
									</>
								) : (
									<span className="text-xs text-white/60">
										{t("speed_dating.listening")}
									</span>
								)}
							</div>
						)}
						{voiceStatus === "idle" && (
							<div className="flex items-center gap-2 mt-1">
								<Loader2 className="w-3 h-3 animate-spin text-white/60" />
								<p className="text-sm text-white/60">
									{t("speed_dating.starting_voice")}
								</p>
							</div>
						)}
					</div>
				</div>

				{voiceError && (
					<div className="mb-4 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm backdrop-blur">
						{voiceError}
					</div>
				)}

				<div className="w-full max-w-lg mb-8">
					<div
						ref={scrollRef}
						className="max-h-[30vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4 space-y-2"
					>
						{transcript.length === 0 && (
							<p className="text-center text-sm text-white/40 py-4">
								{voiceStatus === "idle" || voiceStatus === "connecting"
									? t("speed_dating.waiting_connection")
									: t("speed_dating.waiting_conversation")}
							</p>
						)}
						{transcript.map((entry) => (
							<m.div
								key={entry.id ?? `${entry.timestamp}-${entry.source}`}
								initial={{ opacity: 0, y: 5 }}
								animate={{ opacity: 1, y: 0 }}
								className={`flex ${entry.source === "ai" ? "justify-start" : "justify-end"}`}
							>
								<div
									className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
										entry.source === "ai"
											? "bg-white/15 text-white"
											: "bg-secondary text-white"
									}`}
								>
									{entry.message}
								</div>
							</m.div>
						))}
					</div>
				</div>

				{isVoiceActive && (
					<button
						type="button"
						onClick={handleEndConversation}
						className="px-8 py-4 rounded-full bg-white/15 text-white font-bold text-sm hover:bg-white/25 backdrop-blur transition-all flex items-center gap-2 border border-white/20"
					>
						<MicOff className="w-4 h-4" />
						{t("speed_dating.end_conversation")}
					</button>
				)}

				{voiceStatus === "done" && completeSession.isPending && (
					<div className="flex items-center gap-2 text-sm text-white/60">
						<Loader2 className="w-4 h-4 animate-spin" />
						<span>{t("speed_dating.preparing_next")}</span>
					</div>
				)}
			</div>
		</div>
	);
}
