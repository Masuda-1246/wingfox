import {
	useCompleteSpeedDatingSession,
	useSendSpeedDatingMessage,
	useSpeedDatingPersonas,
	useSpeedDatingSessions,
} from "@/lib/hooks/useSpeedDating";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronRight, CheckCircle2, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Message {
	id: string;
	role: string;
	content: string;
}

interface Guest {
	id: string;
	name: string;
	image: string;
	messages: Message[];
	vibe: number;
	status: "waiting" | "active" | "finished";
}

function generateId(): string {
	return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface PersonaDraft {
	interests: string[];
}

export function OnboardingSpeedDating() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const generatePersonas = useSpeedDatingPersonas();
	const createSession = useSpeedDatingSessions();
	const [draft, setDraft] = useState<PersonaDraft>({
		interests: [],
	});

	const [step, setStep] = useState<"initial" | "speed-date" | "review">("initial");
	const [virtualPersonas, setVirtualPersonas] = useState<
		Array<{ id: string; name: string; persona_type: string }>
	>([]);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [currentPersonaIndex, setCurrentPersonaIndex] = useState(0);
	const [guestMessages, setGuestMessages] = useState<Record<string, Message[]>>({});

	const guests: Guest[] = virtualPersonas.map((p, i) => ({
		id: p.id,
		name: p.name,
		image: `https://picsum.photos/200/300?random=${i + 1}`,
		messages: guestMessages[p.id] ?? [
			{
				id: `welcome-${p.id}`,
				role: "ai",
				content:
					i === 0
						? "やあ、今日は来てくれてありがとう。まずはリラックスして、最近の調子はどうだい？"
						: "初めまして！リラックスして、あなたのことを教えてください。",
			},
		],
		vibe: 20 + (i < currentPersonaIndex ? 50 : i === currentPersonaIndex ? 30 : 0),
		status:
			i < currentPersonaIndex
				? "finished"
				: i === currentPersonaIndex
					? "active"
					: "waiting",
	}));

	const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
	const [inputValue, setInputValue] = useState("");
	const [isTyping, setIsTyping] = useState(false);

	const activeGuest = guests.find((g) => g.id === activeGuestId) ?? guests[0];
	const currentPersonaId = virtualPersonas[currentPersonaIndex]?.id ?? null;
	const sendMessage = useSendSpeedDatingMessage(currentSessionId);
	const completeSession = useCompleteSpeedDatingSession(currentSessionId);

	useEffect(() => {
		if (virtualPersonas.length > 0 && currentPersonaIndex < virtualPersonas.length) {
			setActiveGuestId(virtualPersonas[currentPersonaIndex].id);
		}
	}, [virtualPersonas, currentPersonaIndex]);

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

	const startSpeedDate = async () => {
		try {
			const personasResult = await generatePersonas.mutateAsync();
			const personas = Array.isArray(personasResult) ? personasResult : [];
			if (personas.length === 0) {
				toast.error("仮想ペルソナの生成に失敗しました");
				return;
			}
			setVirtualPersonas(
				personas.map((p: { id: string; name: string; persona_type: string }) => ({
					id: p.id,
					name: p.name,
					persona_type: p.persona_type,
				})),
			);
			const firstSession = await createSession.mutateAsync(personas[0].id);
			const sessionData = firstSession as {
				session_id: string;
				first_message?: { id: string; role: string; content: string; created_at: string };
			};
			setCurrentSessionId(sessionData.session_id);
			setCurrentPersonaIndex(0);
			if (sessionData.first_message) {
				setGuestMessages((prev) => ({
					...prev,
					[personas[0].id]: [
						{
							id: sessionData.first_message!.id,
							role: "ai",
							content: sessionData.first_message!.content,
						},
					],
				}));
			}
			setStep("speed-date");
		} catch (e) {
			console.error(e);
			toast.error("Speed Dateの開始に失敗しました");
		}
	};

	const handleSendMessage = async () => {
		if (!inputValue.trim() || isTyping || !currentSessionId || !currentPersonaId) return;

		const userMessage: Message = {
			id: generateId(),
			role: "user",
			content: inputValue,
		};
		setGuestMessages((prev) => ({
			...prev,
			[currentPersonaId]: [
				...(prev[currentPersonaId] ?? []),
				userMessage,
			],
		}));
		setInputValue("");
		setIsTyping(true);

		try {
			const res = (await sendMessage.mutateAsync(inputValue)) as {
				persona_message?: { id: string; role: string; content: string; created_at: string };
			};
			const personaMsg = res?.persona_message;
			if (personaMsg) {
				setGuestMessages((prev) => ({
					...prev,
					[currentPersonaId]: [
						...(prev[currentPersonaId] ?? []),
						{
							id: personaMsg.id,
							role: "ai",
							content: personaMsg.content,
						},
					],
				}));
			}
		} catch (e) {
			console.error(e);
			toast.error("メッセージの送信に失敗しました");
		} finally {
			setIsTyping(false);
		}
	};

	const wrapCurrentTable = async () => {
		if (!currentSessionId || currentPersonaIndex >= virtualPersonas.length) return;
		try {
			await completeSession.mutateAsync();
			if (currentPersonaIndex < virtualPersonas.length - 1) {
				const nextIndex = currentPersonaIndex + 1;
				const nextPersona = virtualPersonas[nextIndex];
				const nextSession = (await createSession.mutateAsync(nextPersona.id)) as {
					session_id: string;
					first_message?: { id: string; role: string; content: string; created_at: string };
				};
				setCurrentSessionId(nextSession.session_id);
				setCurrentPersonaIndex(nextIndex);
				if (nextSession.first_message) {
					setGuestMessages((prev) => ({
						...prev,
						[nextPersona.id]: [
							{
								id: nextSession.first_message!.id,
								role: "ai",
								content: nextSession.first_message!.content,
							},
						],
					}));
				}
				setActiveGuestId(nextPersona.id);
				toast.info(`${nextPersona.name}との会話を始めます`);
			} else {
				setStep("review");
			}
		} catch (e) {
			console.error(e);
			toast.error("セッションの完了に失敗しました");
		}
	};

	const goToReview = () => {
		navigate({ to: "/onboarding/review" });
	};

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
										<div className="mt-12 flex justify-end">
											<button
												type="button"
												onClick={startSpeedDate}
												disabled={generatePersonas.isPending}
												className="px-10 py-4 bg-foreground text-background rounded-full font-black text-xs tracking-widest hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-30 shadow-xl shadow-black/10"
											>
												{t("speed_dating.enter_speed_date")}{" "}
												<ArrowRight className="w-4 h-4" />
											</button>
										</div>
									</div>
								</div>
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
						<div className="relative h-24 border-b border-border bg-background/50 backdrop-blur-md px-6 flex items-center justify-between">
							<div className="flex items-center gap-6">
								<div className="flex flex-col">
									<span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
										Tonight&apos;s Guests
									</span>
									<div className="flex gap-3 mt-2">
										{guests.map((g) => (
											<button
												type="button"
												key={g.id}
												onClick={() =>
													(g.status === "active" || g.status === "finished") &&
													setActiveGuestId(g.id)
												}
												className={`relative group transition-all ${activeGuestId === g.id ? "scale-110" : "opacity-40 hover:opacity-100"}`}
											>
												<div
													className={`w-10 h-10 rounded-full border-2 overflow-hidden ${activeGuestId === g.id ? "border-secondary" : "border-transparent"}`}
												>
													<img
														src={g.image}
														className="w-full h-full object-cover"
														alt={g.name}
													/>
												</div>
												{g.status === "finished" && (
													<div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-full">
														<CheckCircle2 className="w-4 h-4 text-green-500" />
													</div>
												)}
												<span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase whitespace-nowrap">
													{g.name}
												</span>
											</button>
										))}
									</div>
								</div>
							</div>
						</div>

						<div className="flex-1 flex flex-col min-h-0">
							<div className="w-full max-w-xl min-h-[140px] flex flex-col items-center justify-center py-8">
								<AnimatePresence mode="wait">
									{isTyping ? (
										<motion.div
											key="typing"
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0 }}
											className="bg-white px-6 py-4 rounded-full border border-border shadow-md flex gap-1.5"
										>
											<span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
											<span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.2s]" />
											<span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.4s]" />
										</motion.div>
									) : (
										<motion.div
											key={
												activeGuest.messages[activeGuest.messages.length - 1]?.id ?? "last"
											}
											initial={{ opacity: 0, y: 15 }}
											animate={{ opacity: 1, y: 0 }}
											className={`p-6 rounded-3xl shadow-xl border-2 text-center text-sm sm:text-base font-medium transition-all ${
												activeGuest.messages[activeGuest.messages.length - 1]?.role === "ai"
													? "bg-white border-secondary/20 text-foreground"
													: "bg-zinc-900 border-zinc-800 text-white"
											}`}
										>
											{activeGuest.messages[activeGuest.messages.length - 1]?.content ?? ""}
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							<div className="w-full max-w-2xl mx-auto py-8 px-4">
								<div className="relative">
									<input
										type="text"
										value={inputValue}
										onChange={(e) => setInputValue(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
										placeholder="あなたの言葉を聴かせてください..."
										className="w-full bg-white border border-border/80 rounded-full px-8 py-5 text-sm focus:outline-none focus:ring-4 focus:ring-secondary/5 transition-all shadow-inner"
									/>
									<button
										type="button"
										onClick={handleSendMessage}
										disabled={
											!inputValue.trim() ||
											isTyping ||
											activeGuestId !== currentPersonaId
										}
										className="absolute right-2 top-2 p-4 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-all"
									>
										<ChevronRight className="w-4 h-4" />
									</button>
								</div>
								{currentPersonaIndex < virtualPersonas.length - 1 ? (
									<button
										type="button"
										onClick={wrapCurrentTable}
										disabled={completeSession.isPending}
										className="mt-4 w-full py-3 rounded-full border-2 border-secondary/50 bg-secondary/5 text-sm font-bold hover:bg-secondary/10 transition-colors disabled:opacity-50"
									>
										{completeSession.isPending
											? t("speed_dating.complete_session")
											: t("speed_dating.next_guest")}
									</button>
								) : (
									<button
										type="button"
										onClick={wrapCurrentTable}
										disabled={completeSession.isPending}
										className="mt-4 w-full py-3 rounded-full bg-secondary text-white text-sm font-bold hover:bg-secondary/90 transition-colors disabled:opacity-50"
									>
										{completeSession.isPending
											? t("speed_dating.complete_session")
											: t("speed_dating.to_review")}
									</button>
								)}
							</div>
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
