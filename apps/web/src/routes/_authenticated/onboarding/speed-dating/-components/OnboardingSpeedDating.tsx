import {
	useCachedPersonas,
	useCompleteSpeedDatingSession,
	useSpeedDatingPersonas,
	useSpeedDatingSignedUrl,
	useSpeedDatingSessions,
} from "@/lib/hooks/useSpeedDating";
import { useSpeedDate, type TranscriptEntry } from "@/hooks/use-speed-date";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronRight, CheckCircle2, Loader2, MicOff, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface PersonaDraft {
	interests: string[];
}

type Step = "initial" | "generating" | "connecting" | "speed-date" | "review";
type SignedUrlData = Awaited<ReturnType<ReturnType<typeof useSpeedDatingSignedUrl>["mutateAsync"]>>;

// Atmospheric backgrounds for each date (Unsplash)
const DATE_BACKGROUNDS = [
	"https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1920&q=80&auto=format", // aquarium tunnel
	"https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=1920&q=80&auto=format", // misty forest
	"https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920&q=80&auto=format", // grand library
];

function formatTime(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function OnboardingSpeedDating() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const { data: cachedPersonas } = useCachedPersonas();
	const generatePersonas = useSpeedDatingPersonas();
	const createSession = useSpeedDatingSessions();
	const getSignedUrl = useSpeedDatingSignedUrl();
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
	const [draft, setDraft] = useState<PersonaDraft>({ interests: [] });
	const [step, setStep] = useState<Step>("initial");
	const [loadingMessage, setLoadingMessage] = useState("");
	const [isStarting, setIsStarting] = useState(false);
	const [showSlowHint, setShowSlowHint] = useState(false);
	const [virtualPersonas, setVirtualPersonas] = useState<
		Array<{ id: string; name: string; persona_type: string }>
	>([]);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [currentPersonaIndex, setCurrentPersonaIndex] = useState(0);
	const [currentPersonaName, setCurrentPersonaName] = useState("");
	const completeSession = useCompleteSpeedDatingSession(currentSessionId);
	const transcriptRef = useRef<TranscriptEntry[]>([]);
	const scrollRef = useRef<HTMLDivElement>(null);
	const prefetchedNextRef = useRef<{
		personaIndex: number;
		sessionId: string;
		signedUrlData: SignedUrlData;
	} | null>(null);
	const prefetchingIndexRef = useRef<number | null>(null);

	useEffect(() => {
		transcriptRef.current = transcript;
	}, [transcript]);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [transcript]);

	const prefetchNext = useCallback(async (fromIndex: number) => {
		const nextIndex = fromIndex + 1;
		if (nextIndex >= virtualPersonas.length) return;
		if (prefetchedNextRef.current?.personaIndex === nextIndex) return;
		if (prefetchingIndexRef.current === nextIndex) return;

		const nextPersona = virtualPersonas[nextIndex];
		if (!nextPersona) return;

		prefetchingIndexRef.current = nextIndex;
		try {
			const nextSession = (await createSession.mutateAsync(nextPersona.id)) as { session_id: string };
			const signedUrlData = await getSignedUrl.mutateAsync(nextSession.session_id);
			prefetchedNextRef.current = {
				personaIndex: nextIndex,
				sessionId: nextSession.session_id,
				signedUrlData,
			};
		} catch (err) {
			console.error("[SpeedDate] next prefetch failed:", err);
		} finally {
			if (prefetchingIndexRef.current === nextIndex) {
				prefetchingIndexRef.current = null;
			}
		}
	}, [virtualPersonas, createSession, getSignedUrl]);

	useEffect(() => {
		if (step !== "speed-date") return;
		void prefetchNext(currentPersonaIndex);
	}, [step, currentPersonaIndex, prefetchNext]);

	useEffect(() => {
		if (step !== "connecting" && step !== "generating") {
			setShowSlowHint(false);
			return;
		}
		const timer = setTimeout(() => {
			setShowSlowHint(true);
		}, 8_000);
		return () => clearTimeout(timer);
	}, [step]);

	// When voice session ends ("done"), complete the session with transcript
	useEffect(() => {
		if (voiceStatus !== "done") return;
		const completeCurrentSession = async () => {
			const transcriptData = transcriptRef.current.map((entry) => ({
				source: entry.source,
				message: entry.message,
			}));
			const persistPromise = completeSession.mutateAsync(transcriptData);
			try {
				if (currentPersonaIndex < virtualPersonas.length - 1) {
					const nextIndex = currentPersonaIndex + 1;
					const nextPersona = virtualPersonas[nextIndex];
					setCurrentPersonaName(nextPersona.name);
					setLoadingMessage(`${nextPersona.name}との会話を準備しています...`);
					setStep("connecting");
					let nextSessionId: string;
					let signedUrlData: SignedUrlData;
					const prefetched = prefetchedNextRef.current;
					if (prefetched?.personaIndex === nextIndex) {
						nextSessionId = prefetched.sessionId;
						signedUrlData = prefetched.signedUrlData;
						prefetchedNextRef.current = null;
					} else {
						const nextSession = (await createSession.mutateAsync(nextPersona.id)) as {
							session_id: string;
						};
						nextSessionId = nextSession.session_id;
						signedUrlData = await getSignedUrl.mutateAsync(nextSessionId);
					}
					setCurrentPersonaIndex(nextIndex);
					setCurrentSessionId(nextSessionId);
					resetVoice();
					setStep("speed-date");
					void persistPromise.catch((persistErr) => {
						console.error("[SpeedDate] Failed to persist transcript:", persistErr);
						toast.error("セッション保存に失敗しました");
					});
					await startDate({
						signedUrl: signedUrlData.signed_url,
						overrides: signedUrlData.overrides,
					});
					void prefetchNext(nextIndex);
				} else {
					await persistPromise;
					setStep("review");
				}
			} catch (e) {
				console.error(e);
				toast.error("セッションの完了に失敗しました");
				setStep("speed-date");
			}
		};
		completeCurrentSession();
	}, [voiceStatus, prefetchNext]); // eslint-disable-line react-hooks/exhaustive-deps

	const toggleInterest = (interest: string) => {
		setDraft((prev) => {
			const exists = prev.interests.includes(interest);
			if (exists)
				return { ...prev, interests: prev.interests.filter((i) => i !== interest) };
			if (prev.interests.length >= 5) return prev;
			return { ...prev, interests: [...prev.interests, interest] };
		});
	};

	const startSpeedDate = async () => {
		if (isStarting) return;
		console.log("[SpeedDate] startSpeedDate called, cachedPersonas:", cachedPersonas?.length);
		setIsStarting(true);
		setStep("generating");
		setLoadingMessage("今夜のゲストを探しています...");
		try {
			// Use cached personas from DB if already generated (3 = all types)
			let personas: Array<{ id: string; name: string; persona_type: string }>;
			if (cachedPersonas && cachedPersonas.length >= 3) {
				console.log("[SpeedDate] Using cached personas:", cachedPersonas.map(p => p.name));
				personas = cachedPersonas;
			} else {
				console.log("[SpeedDate] Generating new personas...");
				const personasResult = await generatePersonas.mutateAsync();
				personas = Array.isArray(personasResult) ? personasResult : [];
				console.log("[SpeedDate] Generated personas:", personas.length);
			}
			if (personas.length === 0) {
				toast.error("ゲストの準備に失敗しました");
				setStep("initial");
				return;
			}
			prefetchedNextRef.current = null;
			prefetchingIndexRef.current = null;
				setVirtualPersonas(
					personas.map((p: { id: string; name: string; persona_type: string }) => ({
						id: p.id,
					name: p.name,
					persona_type: p.persona_type,
				})),
			);

				setCurrentPersonaName(personas[0].name);
				setLoadingMessage(`${personas[0].name}との会話を準備しています...`);
				setCurrentPersonaIndex(0);
				const firstSession = (await createSession.mutateAsync(personas[0].id)) as {
					session_id: string;
				};
				setCurrentSessionId(firstSession.session_id);
				let signedUrlData: Awaited<ReturnType<typeof getSignedUrl.mutateAsync>>;
				try {
					signedUrlData = await getSignedUrl.mutateAsync(firstSession.session_id);
				} catch (urlErr) {
					console.error("Failed to get signed URL:", urlErr);
					const message = urlErr instanceof Error ? urlErr.message : "音声セッションの準備に失敗しました。もう一度お試しください。";
					toast.error(message);
					setStep("initial");
					return;
				}
				setStep("speed-date");
				await startDate({
					signedUrl: signedUrlData.signed_url,
					overrides: signedUrlData.overrides,
				});
			} catch (e) {
			console.error("[SpeedDate] Error in startSpeedDate:", e);
			toast.error(`Speed Dateの開始に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}`, { duration: 5000 });
			setStep("initial");
		} finally {
			setIsStarting(false);
		}
	};

	const handleEndConversation = useCallback(async () => {
		await endDate();
	}, [endDate]);

	const goToReview = () => {
		navigate({ to: "/onboarding/review" });
	};

	const isLowTime = remainingMs < 30_000;
	const isVoiceActive = voiceStatus === "talking" || voiceStatus === "connecting";

	return (
		<div className="p-4 md:p-6 min-h-full w-full max-w-7xl mx-auto">
			<AnimatePresence mode="wait">
				{step === "initial" && (
					<motion.div
						key="initial"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className="space-y-8"
					>
						<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
							<div>
								<h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 italic">
									<Users className="w-8 h-8 text-secondary" />
									{t("speed_dating.lounge_title")}
								</h1>
								<p className="text-muted-foreground mt-2">
									{t("speed_dating.lounge_subtitle")}
								</p>
							</div>
						</div>

						<div className="grid grid-cols-12 gap-6">
							<div className="col-span-12 bg-card border border-border rounded-2xl p-8">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									<div className="space-y-6">
										<div className="space-y-4">
											<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
												{t("speed_dating.interests")}
											</span>
											<div className="flex flex-wrap gap-2">
												{[
													"音楽", "映画", "テック", "旅", "アート", "スポーツ", "料理", "読書",
												].map((tag) => (
													<button
														type="button"
														key={tag}
														onClick={() => toggleInterest(tag)}
														className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${draft.interests.includes(tag) ? "bg-secondary border-secondary text-white" : "bg-transparent border-border"}`}
													>
														{tag}
													</button>
												))}
											</div>
										</div>
										<div className="mt-12 flex justify-end">
											<button
												type="button"
												onClick={startSpeedDate}
												disabled={isStarting || generatePersonas.isPending}
												className="px-10 py-4 bg-foreground text-background rounded-full font-black text-xs tracking-widest hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-30 shadow-xl shadow-black/10"
											>
												{isStarting ? (
													<>
														<Loader2 className="w-4 h-4 animate-spin" />
														準備中...
													</>
												) : (
													<>
														{t("speed_dating.enter_speed_date")}{" "}
														<ArrowRight className="w-4 h-4" />
													</>
												)}
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				)}

				{(step === "generating" || step === "connecting") && (
					<motion.div
						key="loading"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6"
					>
						<Loader2 className="w-10 h-10 animate-spin text-secondary" />
						<p className="text-lg font-bold">{loadingMessage}</p>
						{step === "generating" && (
							<p className="text-sm text-muted-foreground">
								3人のデート相手を見つけています。少々お待ちください...
							</p>
						)}
						{showSlowHint && (
							<div className="text-sm text-muted-foreground text-center">
								<p>少し時間がかかっています。ネットワーク状態を確認してください。</p>
								<button
									type="button"
									onClick={() => {
										setStep("initial");
										setIsStarting(false);
									}}
									className="mt-3 underline underline-offset-4 hover:text-foreground"
								>
									開始画面に戻る
								</button>
							</div>
						)}
						{step === "connecting" && virtualPersonas.length > 0 && (
							<div className="flex gap-3 mt-4">
								{virtualPersonas.map((p, i) => (
									<div
										key={p.id}
										className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
											i === currentPersonaIndex
												? "bg-secondary text-white"
												: i < currentPersonaIndex
													? "bg-green-100 text-green-700"
													: "bg-muted text-muted-foreground"
										}`}
									>
										{i < currentPersonaIndex && <CheckCircle2 className="w-3 h-3" />}
										{p.name}
									</div>
								))}
							</div>
						)}
					</motion.div>
				)}

				{step === "speed-date" && (
					<motion.div
						key="speed-date"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 flex flex-col"
						style={{
							backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${DATE_BACKGROUNDS[currentPersonaIndex % DATE_BACKGROUNDS.length]})`,
							backgroundSize: "cover",
							backgroundPosition: "center",
						}}
					>
						{/* Header with guest indicators */}
						<div className="relative h-24 border-b border-white/10 bg-black/30 backdrop-blur-md px-6 flex items-center justify-between">
							<div className="flex items-center gap-6">
								<div className="flex flex-col">
									<span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
										Tonight&apos;s Dates
									</span>
									<div className="flex gap-3 mt-2">
										{virtualPersonas.map((p, i) => (
											<div
												key={p.id}
												className={`relative transition-all ${i === currentPersonaIndex ? "scale-110" : "opacity-40"}`}
											>
												<div
													className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold text-white ${
														i === currentPersonaIndex
															? "border-secondary bg-secondary/20"
															: i < currentPersonaIndex
																? "border-green-400 bg-green-500/20"
																: "border-white/30 bg-white/10"
													}`}
												>
													{i < currentPersonaIndex ? (
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
							</div>
							{/* Timer */}
							{isVoiceActive && (
								<div
									className={`font-mono text-2xl font-bold ${isLowTime ? "text-red-400 animate-pulse" : "text-white/70"}`}
								>
									{formatTime(remainingMs)}
								</div>
							)}
						</div>

						{/* Voice conversation area */}
						<div className="flex-1 flex flex-col items-center justify-center min-h-0 px-4">
							{/* Avatar + speaking indicator */}
							<div className="flex flex-col items-center gap-4 mb-8">
								<div
									className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-bold text-white transition-all ${
										isSpeaking
											? "border-secondary bg-secondary/20 shadow-lg shadow-secondary/30 scale-110"
											: "border-white/30 bg-white/10"
									}`}
								>
									{currentPersonaName?.[0] ?? "?"}
								</div>
								<div className="text-center">
									<p className="font-bold text-lg text-white">{currentPersonaName}</p>
									{voiceStatus === "connecting" && (
										<div className="flex items-center gap-2 mt-1">
											<Loader2 className="w-3 h-3 animate-spin text-white/60" />
											<p className="text-sm text-white/60">接続中...</p>
										</div>
									)}
									{voiceStatus === "talking" && (
										<div className="flex items-center justify-center gap-2 mt-1">
											{isSpeaking ? (
												<>
													<div className="flex items-center gap-0.5">
														<span className="block h-3 w-1 animate-pulse rounded-full bg-secondary [animation-delay:0ms]" />
														<span className="block h-4 w-1 animate-pulse rounded-full bg-secondary [animation-delay:150ms]" />
														<span className="block h-3 w-1 animate-pulse rounded-full bg-secondary [animation-delay:300ms]" />
														<span className="block h-5 w-1 animate-pulse rounded-full bg-secondary [animation-delay:100ms]" />
														<span className="block h-3 w-1 animate-pulse rounded-full bg-secondary [animation-delay:250ms]" />
													</div>
													<span className="text-xs text-secondary">話しています...</span>
												</>
											) : (
												<span className="text-xs text-white/60">聞いています...</span>
											)}
										</div>
									)}
									{voiceStatus === "idle" && step === "speed-date" && (
										<div className="flex items-center gap-2 mt-1">
											<Loader2 className="w-3 h-3 animate-spin text-white/60" />
											<p className="text-sm text-white/60">音声セッションを開始しています...</p>
										</div>
									)}
								</div>
							</div>

							{/* Error display */}
							{voiceError && (
								<div className="mb-4 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm backdrop-blur">
									{voiceError}
								</div>
							)}

							{/* Live transcript */}
							<div className="w-full max-w-lg mb-8">
								<div
									ref={scrollRef}
									className="max-h-[30vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4 space-y-2"
								>
									{transcript.length === 0 && (
										<p className="text-center text-sm text-white/40 py-4">
											{voiceStatus === "idle" || voiceStatus === "connecting"
												? "接続を待っています..."
												: "会話が始まるのを待っています..."}
										</p>
									)}
									{transcript.map((entry, i) => (
										<motion.div
											key={`${entry.timestamp}-${i}`}
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
										</motion.div>
									))}
								</div>
							</div>

							{/* End conversation button */}
							{isVoiceActive && (
								<button
									type="button"
									onClick={handleEndConversation}
									className="px-8 py-4 rounded-full bg-white/15 text-white font-bold text-sm hover:bg-white/25 backdrop-blur transition-all flex items-center gap-2 border border-white/20"
								>
									<MicOff className="w-4 h-4" />
									会話を終了する
								</button>
							)}

							{/* Processing indicator after voice ends */}
							{voiceStatus === "done" && completeSession.isPending && (
								<div className="flex items-center gap-2 text-sm text-white/60">
									<Loader2 className="w-4 h-4 animate-spin" />
									<span>次のデート相手を準備しています...</span>
								</div>
							)}
						</div>
					</motion.div>
				)}

				{step === "review" && (
					<motion.div
						key="review"
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="max-w-4xl mx-auto space-y-12 py-12"
					>
						<div className="text-center space-y-4">
							<h2 className="text-4xl font-black italic tracking-tighter uppercase">
								Session Complete
							</h2>
							<p className="text-muted-foreground">
								会話が完了しました。次のページでプロフィールを確認して確定してください。
							</p>
						</div>

						<div className="bg-zinc-900 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
							<div className="space-y-4 text-center md:text-left">
								<div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary/20 text-secondary rounded-full">
									<Sparkles className="w-4 h-4" />
									<span className="text-[10px] font-black uppercase tracking-widest">
										{t("speed_dating.sync_complete")}
									</span>
								</div>
								<h3 className="text-3xl font-black italic tracking-tighter">
									{t("speed_dating.sync_complete")}
								</h3>
								<p className="text-zinc-400 text-sm max-w-md">
									{t("speed_dating.sync_description")}
								</p>
							</div>
							<button
								type="button"
								onClick={goToReview}
								className="px-12 py-5 bg-white text-zinc-900 rounded-full font-black text-xs tracking-widest uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
							>
								{t("speed_dating.finalize_persona")}{" "}
								<ChevronRight className="w-4 h-4" />
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
