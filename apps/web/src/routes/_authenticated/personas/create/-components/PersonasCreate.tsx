import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowRight,
	ChevronRight,
	Mic,
	Sparkles,
	User,
	Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	useSpeedDate,
	type TranscriptEntry,
} from "@/hooks/use-speed-date";

interface PersonaDraft {
	name: string;
	gender: string;
	ageRange: string;
	interests: string[];
}

function formatTime(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function SpeakingIndicator({ isSpeaking }: { isSpeaking: boolean }) {
	if (isSpeaking) {
		return (
			<div className="flex items-center gap-2">
				<div className="flex items-center gap-0.5">
					<span className="block h-3 w-1 animate-pulse rounded-full bg-secondary [animation-delay:0ms]" />
					<span className="block h-4 w-1 animate-pulse rounded-full bg-secondary [animation-delay:150ms]" />
					<span className="block h-3 w-1 animate-pulse rounded-full bg-secondary [animation-delay:300ms]" />
				</div>
				<span className="text-[10px] font-black uppercase tracking-widest text-secondary">
					Speaking
				</span>
			</div>
		);
	}
	return (
		<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
			Listening
		</span>
	);
}

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
	const isAI = entry.source === "ai";
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className={`flex ${isAI ? "justify-start" : "justify-end"}`}
		>
			<div
				className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
					isAI
						? "bg-white border border-border text-foreground"
						: "bg-zinc-900 text-white"
				}`}
			>
				{entry.message}
			</div>
		</motion.div>
	);
}

export function PersonasCreate() {
	const { t } = useTranslation("personas");
	const navigate = useNavigate();
	const [step, setStep] = useState<
		"initial" | "speed-date" | "review" | "creating"
	>("initial");
	const [draft, setDraft] = useState<PersonaDraft>({
		name: "",
		gender: "",
		ageRange: "",
		interests: [],
	});

	const {
		status: dateStatus,
		isSpeaking,
		connectionStatus,
		transcript,
		remainingMs,
		error: dateError,
		startDate,
		endDate,
	} = useSpeedDate();

	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [transcript]);

	useEffect(() => {
		if (dateStatus === "done" && step === "speed-date") {
			setStep("review");
		}
	}, [dateStatus, step]);

	const handleDraftChange = (
		field: keyof PersonaDraft,
		value: string | string[],
	) => {
		setDraft((prev) => ({ ...prev, [field]: value }));
	};

	const toggleInterest = (interest: string) => {
		setDraft((prev) => {
			const exists = prev.interests.includes(interest);
			if (exists)
				return {
					...prev,
					interests: prev.interests.filter((i) => i !== interest),
				};
			if (prev.interests.length >= 5) return prev;
			return { ...prev, interests: [...prev.interests, interest] };
		});
	};

	const startSpeedDate = () => {
		if (!draft.name || !draft.gender) {
			toast.error(t("create.error_basic_info"));
			return;
		}
		setStep("speed-date");
	};

	const isLowTime = remainingMs < 30_000;

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
									{t("create.lounge_title")}
								</h1>
								<p className="text-muted-foreground mt-2">
									{t("create.lounge_subtitle")}
								</p>
							</div>
						</div>

						<div className="grid grid-cols-12 gap-6">
							<div className="col-span-12 md:col-span-8 bg-card border border-border rounded-2xl p-8">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									<div className="space-y-6">
										<label className="space-y-2 block">
											<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
												{t("create.display_name")}
											</span>
											<input
												type="text"
												placeholder={t("create.name_placeholder")}
												value={draft.name}
												onChange={(e) =>
													handleDraftChange("name", e.target.value)
												}
												className="w-full bg-transparent border-b border-border pb-2 text-xl font-bold focus:border-secondary outline-none transition-all"
											/>
										</label>
										<div className="grid grid-cols-2 gap-4">
											<label className="space-y-2 block">
												<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
													{t("create.gender")}
												</span>
												<select
													value={draft.gender}
													onChange={(e) =>
														handleDraftChange("gender", e.target.value)
													}
													className="w-full bg-input/50 border border-border rounded-lg p-2 text-sm"
												>
													<option value="">{t("create.gender_select")}</option>
													<option value="男性">
														{t("create.gender_male")}
													</option>
													<option value="女性">
														{t("create.gender_female")}
													</option>
													<option value="その他">
														{t("create.gender_other")}
													</option>
												</select>
											</label>
										</div>
									</div>
									<div className="space-y-4">
										<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
											{t("create.interests")}
										</span>
										<div className="flex flex-wrap gap-2">
											{[
												"音楽",
												"映画",
												"テック",
												"旅",
												"アート",
												"スポーツ",
												"料理",
												"読書",
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
								</div>
								<div className="mt-12 flex justify-end">
									<button
										type="button"
										onClick={startSpeedDate}
										disabled={!draft.name || !draft.gender}
										className="px-10 py-4 bg-foreground text-background rounded-full font-black text-xs tracking-widest hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-30 shadow-xl shadow-black/10"
									>
										{t("create.enter_speed_date")}{" "}
										<ArrowRight className="w-4 h-4" />
									</button>
								</div>
							</div>
							<div className="col-span-12 md:col-span-4 bg-secondary/5 rounded-2xl p-6 border border-secondary/10 flex flex-col justify-center space-y-4">
								<Users className="w-10 h-10 text-secondary" />
								<h3 className="font-black text-xs uppercase tracking-tighter italic">
									{t("create.tonights_experience")}
								</h3>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{t("create.tonights_experience_desc")}
								</p>
							</div>
						</div>
					</motion.div>
				)}

				{step === "speed-date" && (
					<motion.div
						key="speed-date"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 bg-background flex flex-col"
					>
						{dateStatus === "idle" && (
							<div className="flex-1 flex flex-col items-center justify-center space-y-8 p-6">
								<motion.div
									initial={{ scale: 0.9, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									className="relative"
								>
									<div className="w-32 h-32 sm:w-40 sm:h-40 bg-secondary/10 rounded-full flex items-center justify-center border-2 border-secondary/20">
										<User className="w-14 h-14 text-secondary/60" />
									</div>
									{connectionStatus === "connecting" && (
										<div className="absolute -inset-3 border-2 border-secondary/40 rounded-full animate-pulse" />
									)}
								</motion.div>

								<div className="text-center space-y-3">
									<h2 className="text-2xl font-black tracking-tighter italic uppercase">
										Ready to Connect
									</h2>
									<p className="text-sm text-muted-foreground max-w-sm">
										マイクを使って2分間の音声会話を行います。あなたの会話スタイルからペルソナを生成します。
									</p>
								</div>

								{dateError && (
									<p className="text-sm text-destructive text-center max-w-sm">
										{dateError}
									</p>
								)}

								<button
									type="button"
									onClick={startDate}
									disabled={connectionStatus === "connecting"}
									className="px-10 py-4 bg-foreground text-background rounded-full font-black text-xs tracking-widest hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50 shadow-xl shadow-black/10"
								>
									{connectionStatus === "connecting" ? (
										<>
											<div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
											CONNECTING...
										</>
									) : (
										<>
											<Mic className="w-4 h-4" />
											START CONVERSATION
										</>
									)}
								</button>
							</div>
						)}

						{dateStatus === "talking" && (
							<>
								<div className="relative h-20 border-b border-border bg-background/50 backdrop-blur-md px-6 flex items-center justify-between">
									<div className="flex items-center gap-4">
										<div className="relative">
											<div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center border border-secondary/20">
												<User className="w-5 h-5 text-secondary/60" />
											</div>
											{isSpeaking && (
												<div className="absolute -inset-1 border-2 border-secondary/40 rounded-full animate-pulse" />
											)}
										</div>
										<div className="flex flex-col gap-1">
											<span className="text-[10px] font-black uppercase tracking-widest">
												Voice Session
											</span>
											<SpeakingIndicator isSpeaking={isSpeaking} />
										</div>
									</div>

									<div className="flex items-center gap-4">
										<span
											className={`font-mono text-lg font-black ${isLowTime ? "text-destructive" : "text-muted-foreground"}`}
										>
											{formatTime(remainingMs)}
										</span>
										<button
											type="button"
											onClick={endDate}
											className="px-6 py-2.5 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all"
										>
											End Date
										</button>
									</div>
								</div>

								<div className="flex-1 flex flex-col items-center overflow-hidden">
									<div className="flex-shrink-0 flex flex-col items-center justify-center py-8 sm:py-12">
										<motion.div
											animate={
												isSpeaking
													? { scale: [1, 1.05, 1] }
													: { scale: 1 }
											}
											transition={
												isSpeaking
													? {
															repeat: Number.POSITIVE_INFINITY,
															duration: 1.5,
														}
													: {}
											}
											className="relative w-24 h-24 sm:w-32 sm:h-32"
										>
											<div
												className={`absolute -inset-2 border-2 rounded-full transition-colors ${isSpeaking ? "border-secondary/40 animate-pulse" : "border-secondary/10"}`}
											/>
											<div className="w-full h-full bg-secondary/10 rounded-full flex items-center justify-center border-2 border-secondary/20">
												<User className="w-10 h-10 sm:w-12 sm:h-12 text-secondary/60" />
											</div>
										</motion.div>
									</div>

									<div
										ref={scrollRef}
										className="flex-1 w-full max-w-2xl overflow-y-auto px-6 pb-6 space-y-3"
									>
										{transcript.length === 0 && (
											<p className="text-center text-sm text-muted-foreground pt-8">
												会話が始まるのを待っています...
											</p>
										)}
										{transcript.map((entry, i) => (
											<TranscriptBubble
												key={`${entry.timestamp}-${i}`}
												entry={entry}
											/>
										))}
									</div>
								</div>
							</>
						)}
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
								音声会話の内容を確認してください。このデータからペルソナを生成します。
							</p>
						</div>

						<div className="bg-card border border-border rounded-2xl p-6 space-y-4">
							<div className="flex items-center justify-between">
								<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Transcript
								</span>
								<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									{transcript.length} turns
								</span>
							</div>
							<div className="max-h-[50vh] overflow-y-auto space-y-3 pr-2">
								{transcript.length === 0 && (
									<p className="text-center text-sm text-muted-foreground py-8">
										トランスクリプトはありません
									</p>
								)}
								{transcript.map((entry, i) => (
									<TranscriptBubble
										key={`${entry.timestamp}-${i}`}
										entry={entry}
									/>
								))}
							</div>
						</div>

						<div className="bg-zinc-900 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
							<div className="space-y-4 text-center md:text-left">
								<div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary/20 text-secondary rounded-full">
									<Sparkles className="w-4 h-4" />
									<span className="text-[10px] font-black uppercase tracking-widest">
										{t("create.ready_to_materialize")}
									</span>
								</div>
								<h3 className="text-3xl font-black italic tracking-tighter">
									{t("create.sync_complete")}
								</h3>
								<p className="text-zinc-400 text-sm max-w-md">
									{t("create.sync_description")}
								</p>
							</div>
							<button
								type="button"
								onClick={() => {
									setStep("creating");
									setTimeout(
										() =>
											navigate({
												to: "/personas/me",
											}),
										2500,
									);
								}}
								className="px-12 py-5 bg-white text-zinc-900 rounded-full font-black text-xs tracking-widest uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
							>
								{t("create.finalize_persona")}{" "}
								<ChevronRight className="w-4 h-4" />
							</button>
						</div>
					</motion.div>
				)}

				{step === "creating" && (
					<motion.div
						key="creating"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center space-y-10"
					>
						<div className="relative w-24 h-24">
							<div className="absolute inset-0 border-[6px] border-secondary/10 border-t-secondary rounded-full animate-spin" />
							<div className="absolute inset-0 flex items-center justify-center">
								<Sparkles className="w-10 h-10 text-secondary" />
							</div>
						</div>
						<div className="text-center space-y-4">
							<h3 className="text-2xl font-black tracking-tighter italic">
								{t("create.embedding_personality")}
							</h3>
							<p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
								{t("create.encoding_patterns")}
							</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
