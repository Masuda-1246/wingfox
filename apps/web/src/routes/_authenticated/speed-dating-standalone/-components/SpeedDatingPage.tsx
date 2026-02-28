import { type TranscriptEntry, useSpeedDate } from "@/hooks/use-speed-date";
import {
	useCompleteSpeedDatingSession,
	useSpeedDatingPersonas,
	useSpeedDatingSessions,
	useSpeedDatingSignedUrl,
} from "@/lib/hooks/useSpeedDating";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, m } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Strip markdown formatting (bold, italic, headers) from AI transcript text */
function stripMarkdown(text: string): string {
	return text
		.replace(/\*{1,3}(.+?)\*{1,3}/g, "$1") // **bold**, *italic*, ***both***
		.replace(/_{1,3}(.+?)_{1,3}/g, "$1") // __bold__, _italic_
		.replace(/^#{1,6}\s+/gm, "") // ## headers
		.replace(/`([^`]+)`/g, "$1"); // `code`
}

function formatTime(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SpeedDatingPage() {
	const navigate = useNavigate();
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

	const [step, setStep] = useState<"start" | "generating" | "dating" | "done">(
		"start",
	);
	const [virtualPersonas, setVirtualPersonas] = useState<
		Array<{ id: string; name: string; persona_type: string }>
	>([]);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [currentPersonaIndex, setCurrentPersonaIndex] = useState(0);
	const [currentPersonaName, setCurrentPersonaName] = useState("");
	const completeSession = useCompleteSpeedDatingSession(currentSessionId);
	const transcriptRef = useRef<TranscriptEntry[]>([]);
	const handledDoneRef = useRef(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const prefetchedNextRef = useRef<{
		personaIndex: number;
		sessionId: string;
		signedUrlData: Awaited<ReturnType<typeof getSignedUrl.mutateAsync>>;
	} | null>(null);
	const prefetchingIndexRef = useRef<number | null>(null);

	useEffect(() => {
		transcriptRef.current = transcript;
	}, [transcript]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: transcript is the intentional trigger to scroll on new messages
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [transcript]);

	const prefetchNext = useCallback(
		async (fromIndex: number) => {
			const nextIndex = fromIndex + 1;
			if (nextIndex >= virtualPersonas.length) return;
			if (prefetchedNextRef.current?.personaIndex === nextIndex) return;
			if (prefetchingIndexRef.current === nextIndex) return;

			const nextPersona = virtualPersonas[nextIndex];
			if (!nextPersona) return;

			prefetchingIndexRef.current = nextIndex;
			try {
				const nextSession = (await createSession.mutateAsync(
					nextPersona.id,
				)) as { session_id: string };
				const signedUrlData = await getSignedUrl.mutateAsync(
					nextSession.session_id,
				);
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
		},
		[virtualPersonas, createSession, getSignedUrl],
	);

	useEffect(() => {
		if (step !== "dating") return;
		void prefetchNext(currentPersonaIndex);
	}, [step, currentPersonaIndex, prefetchNext]);

	// When voice session ends, complete and move to next
	useEffect(() => {
		if (voiceStatus !== "done") {
			handledDoneRef.current = false;
			return;
		}
		if (handledDoneRef.current) return;
		handledDoneRef.current = true;
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
					let nextSessionId: string;
					let signedUrlData: Awaited<
						ReturnType<typeof getSignedUrl.mutateAsync>
					>;
					const prefetched = prefetchedNextRef.current;
					if (prefetched?.personaIndex === nextIndex) {
						nextSessionId = prefetched.sessionId;
						signedUrlData = prefetched.signedUrlData;
						prefetchedNextRef.current = null;
					} else {
						const nextSession = (await createSession.mutateAsync(
							nextPersona.id,
						)) as {
							session_id: string;
						};
						nextSessionId = nextSession.session_id;
						signedUrlData = await getSignedUrl.mutateAsync(nextSessionId);
					}
					setCurrentPersonaIndex(nextIndex);
					setCurrentSessionId(nextSessionId);
					resetVoice();
					setCurrentPersonaName(signedUrlData.persona.name);
					void persistPromise.catch((persistErr) => {
						console.error(
							"[SpeedDate] Failed to persist transcript:",
							persistErr,
						);
						toast.error("セッション保存に失敗しました");
					});
					await startDate({
						signedUrl: signedUrlData.signed_url,
						overrides: signedUrlData.overrides,
					});
					void prefetchNext(nextIndex);
				} else {
					await persistPromise;
					setStep("done");
				}
			} catch (e) {
				console.error(e);
				toast.error("セッションの完了に失敗しました");
			}
		};
		completeCurrentSession();
	}, [
		voiceStatus,
		prefetchNext,
		createSession.mutateAsync,
		getSignedUrl.mutateAsync,
		completeSession.mutateAsync,
		resetVoice,
		currentPersonaIndex,
		virtualPersonas,
		startDate,
	]);

	const handleStart = async () => {
		setStep("generating");
		try {
			const personasResult = await generatePersonas.mutateAsync();
			const personas = Array.isArray(personasResult) ? personasResult : [];
			if (personas.length === 0) {
				toast.error("ゲストの準備に失敗しました");
				setStep("start");
				return;
			}
			prefetchedNextRef.current = null;
			prefetchingIndexRef.current = null;
			setVirtualPersonas(
				personas.map(
					(p: { id: string; name: string; persona_type: string }) => ({
						id: p.id,
						name: p.name,
						persona_type: p.persona_type,
					}),
				),
			);
			const firstSession = (await createSession.mutateAsync(
				personas[0].id,
			)) as {
				session_id: string;
			};
			setCurrentPersonaIndex(0);
			setCurrentSessionId(firstSession.session_id);
			setStep("dating");
			const signedUrlData = await getSignedUrl.mutateAsync(
				firstSession.session_id,
			);
			setCurrentPersonaName(signedUrlData.persona.name);
			await startDate({
				signedUrl: signedUrlData.signed_url,
				overrides: signedUrlData.overrides,
			});
		} catch (e) {
			console.error(e);
			toast.error("開始に失敗しました");
			setStep("start");
		}
	};

	const handleEndConversation = useCallback(async () => {
		await endDate();
	}, [endDate]);

	const isLowTime = remainingMs < 30_000;
	const isVoiceActive =
		voiceStatus === "talking" || voiceStatus === "connecting";

	return (
		<div className="min-h-[calc(100vh-4rem)] w-full max-w-2xl mx-auto p-6">
			<AnimatePresence mode="wait">
				{step === "start" && (
					<m.div
						key="start"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className="flex flex-col items-center justify-center min-h-[60vh] gap-6"
					>
						<h1 className="text-3xl font-black tracking-tighter italic">
							Speed Dating
						</h1>
						<p className="text-muted-foreground text-center max-w-md">
							3人のデート相手と2分間ずつ音声で会話します。会話の記録をもとにあなたのペルソナが作られます。
						</p>
						<button
							type="button"
							onClick={handleStart}
							className="px-10 py-4 bg-foreground text-background rounded-full font-black text-sm tracking-widest hover:scale-105 transition-all shadow-xl"
						>
							Start Speed Dating
						</button>
						<button
							type="button"
							onClick={() => navigate({ to: "/personas/me" })}
							className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
						>
							<ArrowLeft className="w-3 h-3" /> 戻る
						</button>
					</m.div>
				)}

				{step === "generating" && (
					<m.div
						key="generating"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
					>
						<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
						<p className="text-sm text-muted-foreground">
							今夜のゲストを探しています...
						</p>
					</m.div>
				)}

				{step === "dating" && (
					<m.div
						key="dating"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="flex flex-col items-center min-h-[60vh]"
					>
						{/* Guest tabs */}
						<div className="flex items-center gap-4 mb-8">
							{virtualPersonas.map((p, i) => (
								<div
									key={p.id}
									className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
										i === currentPersonaIndex
											? "bg-foreground text-background"
											: i < currentPersonaIndex
												? "bg-green-100 text-green-700"
												: "bg-muted text-muted-foreground"
									}`}
								>
									{i < currentPersonaIndex && (
										<CheckCircle2 className="w-3 h-3" />
									)}
									{p.name}
								</div>
							))}
						</div>

						{/* Timer */}
						{isVoiceActive && (
							<div
								className={`font-mono text-4xl font-bold mb-6 ${isLowTime ? "text-destructive animate-pulse" : "text-muted-foreground"}`}
							>
								{formatTime(remainingMs)}
							</div>
						)}

						{/* Avatar + speaking indicator */}
						<div className="flex flex-col items-center gap-3 mb-6">
							<div
								className={`w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold transition-all ${
									isSpeaking
										? "border-secondary bg-secondary/10 shadow-lg shadow-secondary/20 scale-110"
										: "border-border bg-muted"
								}`}
							>
								{currentPersonaName?.[0] ?? "?"}
							</div>
							<p className="font-bold">{currentPersonaName}</p>
							{voiceStatus === "connecting" && (
								<p className="text-sm text-muted-foreground animate-pulse">
									接続中...
								</p>
							)}
							{voiceStatus === "talking" && (
								<p className="text-xs text-muted-foreground">
									{isSpeaking ? "話しています..." : "聞いています..."}
								</p>
							)}
						</div>

						{voiceError && (
							<div className="mb-4 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
								{voiceError}
							</div>
						)}

						{/* Transcript */}
						<div className="w-full mb-6">
							<div
								ref={scrollRef}
								className="max-h-[30vh] overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-2"
							>
								{transcript.length === 0 && (
									<p className="text-center text-sm text-muted-foreground py-4">
										{voiceStatus === "connecting"
											? "接続を待っています..."
											: "会話が始まるのを待っています..."}
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
													? "bg-secondary/10 text-foreground"
													: "bg-primary text-primary-foreground"
											}`}
										>
											{entry.source === "ai"
												? stripMarkdown(entry.message)
												: entry.message}
										</div>
									</m.div>
								))}
							</div>
						</div>

						{/* End button */}
						{isVoiceActive && (
							<button
								type="button"
								onClick={handleEndConversation}
								className="px-6 py-3 rounded-full bg-destructive text-destructive-foreground font-bold text-sm hover:bg-destructive/90 transition-all flex items-center gap-2"
							>
								<MicOff className="w-4 h-4" />
								会話を終了する
							</button>
						)}

						{voiceStatus === "done" && completeSession.isPending && (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="w-4 h-4 animate-spin" />
								次のゲストを準備しています...
							</div>
						)}
					</m.div>
				)}

				{step === "done" && (
					<m.div
						key="done"
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="flex flex-col items-center justify-center min-h-[60vh] gap-6"
					>
						<CheckCircle2 className="w-12 h-12 text-green-500" />
						<h2 className="text-2xl font-black tracking-tighter italic">
							Speed Dating Complete
						</h2>
						<p className="text-muted-foreground text-center max-w-md">
							3人のデート相手との会話が完了しました。この記録をもとにあなたのペルソナが作られます。
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => {
									setStep("start");
									setVirtualPersonas([]);
									setCurrentPersonaIndex(0);
									setCurrentSessionId(null);
									resetVoice();
								}}
								className="px-6 py-3 rounded-full border-2 border-foreground/20 font-bold text-sm hover:bg-muted transition-all"
							>
								もう一度
							</button>
							<button
								type="button"
								onClick={() => navigate({ to: "/personas/me" })}
								className="px-6 py-3 rounded-full bg-foreground text-background font-bold text-sm hover:scale-105 transition-all"
							>
								マイページへ
							</button>
						</div>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}
