import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowRight,
	CheckCircle2,
	ChevronRight,
	Heart,
	Send,
	Sparkles,
	User,
	Users,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const generateId = () => {
	if (
		typeof window !== "undefined" &&
		window.crypto &&
		window.crypto.randomUUID
	) {
		return window.crypto.randomUUID();
	}
	return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

interface Message {
	id: string;
	role: "user" | "ai";
	content: string;
}

interface Guest {
	id: string;
	name: string;
	image: string;
	messages: Message[];
	vibe: number;
	status: "active" | "waiting" | "finished";
}

interface PersonaDraft {
	name: string;
	gender: string;
	ageRange: string;
	interests: string[];
}

export function PersonasCreate() {
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

	const [guests, setGuests] = useState<Guest[]>([
		{
			id: "g1",
			name: "Casper",
			image: "https://picsum.photos/200/300?random=1",
			messages: [
				{
					id: "m1",
					role: "ai",
					content:
						"やあ、今日は来てくれてありがとう。まずはリラックスして、最近の調子はどうだい？",
				},
			],
			vibe: 20,
			status: "active",
		},
		{
			id: "g2",
			name: "Elena",
			image: "https://picsum.photos/200/300?random=2",
			messages: [
				{
					id: "m2",
					role: "ai",
					content:
						"初めまして！このカフェの雰囲気、素敵よね。あなたのお気に入りについても教えてくれる？",
				},
			],
			vibe: 10,
			status: "waiting",
		},
		{
			id: "g3",
			name: "Hiro",
			image: "https://picsum.photos/200/300?random=3",
			messages: [
				{
					id: "m3",
					role: "ai",
					content:
						"こんにちは。落ち着いた会話ができるのを楽しみにしていました。",
				},
			],
			vibe: 15,
			status: "waiting",
		},
	]);

	const [activeGuestId, setActiveGuestId] = useState("g1");
	const [inputValue, setInputValue] = useState("");
	const [isTyping, setIsTyping] = useState(false);
	const activeGuest = guests.find((g) => g.id === activeGuestId) ?? guests[0];

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
			toast.error("基本情報を入力してください");
			return;
		}
		setStep("speed-date");
	};

	const handleSendMessage = async () => {
		if (!inputValue.trim() || isTyping) return;

		const userMessage: Message = {
			id: generateId(),
			role: "user",
			content: inputValue,
		};

		setGuests((prev) =>
			prev.map((g) =>
				g.id === activeGuestId
					? {
							...g,
							messages: [...g.messages, userMessage],
							vibe: Math.min(g.vibe + 15, 100),
						}
					: g,
			),
		);

		setInputValue("");
		setIsTyping(true);

		setTimeout(() => {
			const aiResponses = [
				`興味深いですね、${draft.name}さん。そういう考え方、好きですよ。`,
				"もう少し詳しく聞かせてくれる？例えば、どんな瞬間にそれを感じるの？",
				"なるほど。その価値観、今の会話のリズムからすごく伝わってきます。",
				"いいですね。なんだか波長が合ってきた気がします。",
			];
			const aiMessage: Message = {
				id: generateId(),
				role: "ai",
				content: aiResponses[Math.floor(Math.random() * aiResponses.length)],
			};

			setGuests((prev) =>
				prev.map((g) =>
					g.id === activeGuestId
						? { ...g, messages: [...g.messages, aiMessage] }
						: g,
				),
			);
			setIsTyping(false);
		}, 1500);
	};

	const wrapCurrentTable = () => {
		setGuests((prev) =>
			prev.map((g) =>
				g.id === activeGuestId ? { ...g, status: "finished" } : g,
			),
		);
		const nextGuest = guests.find(
			(g) => g.id !== activeGuestId && g.status !== "finished",
		);
		if (nextGuest) {
			setActiveGuestId(nextGuest.id);
			toast.info(`${nextGuest.name}との会話を始めます`);
		} else {
			setStep("review");
		}
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
									THE LOUNGE
								</h1>
								<p className="text-muted-foreground mt-2">
									交流イベントへの準備。まずはあなたの簡単なプロフィールを設定しましょう。
								</p>
							</div>
						</div>

						<div className="grid grid-cols-12 gap-6">
							<div className="col-span-12 md:col-span-8 bg-card border border-border rounded-2xl p-8">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									<div className="space-y-6">
										<label className="space-y-2 block">
											<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
												Display Name
											</span>
											<input
												type="text"
												placeholder="あなたの名前"
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
													Gender
												</span>
												<select
													value={draft.gender}
													onChange={(e) =>
														handleDraftChange("gender", e.target.value)
													}
													className="w-full bg-input/50 border border-border rounded-lg p-2 text-sm"
												>
													<option value="">選択</option>
													<option value="男性">男性</option>
													<option value="女性">女性</option>
													<option value="その他">その他</option>
												</select>
											</label>
										</div>
									</div>
									<div className="space-y-4">
										<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
											Your Interests
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
										ENTER SPEED DATE <ArrowRight className="w-4 h-4" />
									</button>
								</div>
							</div>
							<div className="col-span-12 md:col-span-4 bg-secondary/5 rounded-2xl p-6 border border-secondary/10 flex flex-col justify-center space-y-4">
								<Users className="w-10 h-10 text-secondary" />
								<h3 className="font-black text-xs uppercase tracking-tighter italic">
									Tonight&apos;s Experience
								</h3>
								<p className="text-xs text-muted-foreground leading-relaxed">
									複数のゲストと短い会話を交わし、あなたの「個性」を抽出します。特定の相手との関係ではなく、交流のリズムそのものが、あなたのペルソナ（分身）の基盤となります。
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
													g.status !== "finished" && setActiveGuestId(g.id)
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

							<div className="flex items-center gap-4">
								<div className="text-right hidden sm:block">
									<p className="text-[10px] font-black italic">
										{activeGuest.name}&apos;s Table
									</p>
									<p className="text-[8px] uppercase tracking-widest text-muted-foreground">
										Active Interaction
									</p>
								</div>
								<button
									type="button"
									onClick={wrapCurrentTable}
									className="px-6 py-2.5 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all"
								>
									Wrap This Table
								</button>
							</div>
						</div>

						<div className="flex-1 relative flex flex-col md:grid md:grid-cols-12 overflow-hidden">
							<div className="md:col-span-8 flex flex-col p-6">
								<div className="flex-1 flex flex-col items-center justify-center space-y-12">
									<div className="flex justify-center items-end gap-12 sm:gap-24 w-full">
										<div className="flex flex-col items-center gap-3">
											<motion.div
												key={activeGuest.id}
												initial={{
													scale: 0.8,
													opacity: 0,
												}}
												animate={{
													scale: 1,
													opacity: 1,
												}}
												className="relative w-28 h-28 sm:w-36 sm:h-36"
											>
												<div className="absolute -inset-2 border-2 border-secondary/20 rounded-full animate-pulse" />
												<img
													src={activeGuest.image}
													className="w-full h-full object-cover rounded-full border-4 border-white shadow-2xl"
													alt={activeGuest.name}
												/>
											</motion.div>
											<span className="px-4 py-1 bg-secondary text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
												{activeGuest.name}
											</span>
										</div>

										<div className="flex flex-col items-center gap-3">
											<div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-100 rounded-full border-2 border-white shadow-xl flex items-center justify-center">
												<User className="w-8 h-8 text-zinc-400" />
											</div>
											<span className="px-4 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
												YOU
											</span>
										</div>
									</div>

									<div className="w-full max-w-xl min-h-[140px] flex flex-col items-center">
										<AnimatePresence mode="wait">
											{isTyping ? (
												<motion.div
													key="typing"
													initial={{
														opacity: 0,
														y: 10,
													}}
													animate={{
														opacity: 1,
														y: 0,
													}}
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
														activeGuest.messages[
															activeGuest.messages.length - 1
														].id
													}
													initial={{
														opacity: 0,
														y: 15,
													}}
													animate={{
														opacity: 1,
														y: 0,
													}}
													className={`p-6 rounded-3xl shadow-xl border-2 text-center text-sm sm:text-base font-medium transition-all ${
														activeGuest.messages[
															activeGuest.messages.length - 1
														].role === "ai"
															? "bg-white border-secondary/20 text-foreground"
															: "bg-zinc-900 border-zinc-800 text-white"
													}`}
												>
													{
														activeGuest.messages[
															activeGuest.messages.length - 1
														].content
													}
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								</div>

								<div className="w-full max-w-2xl mx-auto py-8">
									<div className="relative">
										<input
											type="text"
											value={inputValue}
											onChange={(e) => setInputValue(e.target.value)}
											onKeyDown={(e) =>
												e.key === "Enter" && handleSendMessage()
											}
											placeholder="あなたの言葉を聴かせてください..."
											className="w-full bg-white border border-border/80 rounded-full px-8 py-5 text-sm focus:outline-none focus:ring-4 focus:ring-secondary/5 transition-all shadow-inner"
										/>
										<button
											type="button"
											onClick={handleSendMessage}
											disabled={!inputValue.trim() || isTyping}
											className="absolute right-2 top-2 p-4 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-all"
										>
											<Send className="w-4 h-4" />
										</button>
									</div>
								</div>
							</div>

							<div className="md:col-span-4 bg-white/40 backdrop-blur-sm border-l border-border p-8 flex flex-col space-y-8">
								<div className="space-y-4">
									<h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
										<Heart className="w-3 h-3 text-secondary" /> Session Vibe
									</h4>
									<div className="flex items-center justify-between">
										<span className="text-xs font-black">
											{activeGuest.vibe}% Affinity
										</span>
									</div>
									<div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
										<motion.div
											className="h-full bg-secondary"
											animate={{
												width: `${activeGuest.vibe}%`,
											}}
										/>
									</div>
								</div>

								<div className="p-6 bg-secondary/5 border border-secondary/10 rounded-3xl space-y-4">
									<div className="flex items-center gap-2">
										<Zap className="w-4 h-4 text-secondary" />
										<span className="text-[10px] font-black uppercase tracking-widest">
											Table Topic
										</span>
									</div>
									<p className="text-xs font-bold leading-relaxed italic">
										&ldquo;相手との共通点や、自分らしさを表現する言葉選びがペルソナに反映されます。&rdquo;
									</p>
								</div>

								<div className="flex-1 flex flex-col">
									<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
										Event Status
									</span>
									<div className="space-y-3">
										{guests.map((g) => (
											<div key={g.id} className="flex items-center gap-3">
												<div
													className={`w-2 h-2 rounded-full ${g.status === "finished" ? "bg-green-500" : g.id === activeGuestId ? "bg-secondary" : "bg-slate-200"}`}
												/>
												<span
													className={`text-[10px] font-bold ${g.id === activeGuestId ? "text-foreground" : "text-muted-foreground"}`}
												>
													{g.name}:{" "}
													{g.status === "finished"
														? "Wrap"
														: g.id === activeGuestId
															? "In Conversation"
															: "Waiting"}
												</span>
											</div>
										))}
									</div>
								</div>
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
								Tonight&apos;s Snapshots
							</h2>
							<p className="text-muted-foreground">
								複数のゲストとの交流から、あなたの多面的な個性が浮かび上がりました。
							</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							{guests.map((g) => (
								<div
									key={g.id}
									className="bg-card border border-border rounded-3xl overflow-hidden flex flex-col"
								>
									<div className="h-24 bg-slate-50 relative">
										<img
											src={g.image}
											className="w-full h-full object-cover opacity-60"
											alt=""
										/>
										<div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
										<div className="absolute bottom-3 left-4 flex items-center gap-2">
											<span className="text-[10px] font-black uppercase bg-white px-3 py-1 rounded-full border border-border">
												{g.name}
											</span>
										</div>
									</div>
									<div className="p-5 space-y-4">
										<div className="flex items-center justify-between">
											<span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
												Affinity
											</span>
											<span className="text-xs font-black">{g.vibe}%</span>
										</div>
										<p className="text-[10px] text-muted-foreground leading-relaxed italic">
											&ldquo;
											{g.messages[g.messages.length - 1].content.substring(
												0,
												50,
											)}
											...&rdquo;
										</p>
									</div>
								</div>
							))}
						</div>

						<div className="bg-zinc-900 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
							<div className="space-y-4 text-center md:text-left">
								<div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary/20 text-secondary rounded-full">
									<Sparkles className="w-4 h-4" />
									<span className="text-[10px] font-black uppercase tracking-widest">
										Ready to materialize
									</span>
								</div>
								<h3 className="text-3xl font-black italic tracking-tighter">
									SYNC COMPLETE.
								</h3>
								<p className="text-zinc-400 text-sm max-w-md">
									交流のリズムが解析されました。このデータから、あなたを最もよく表現する「ペルソナ」を生成します。
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
								Finalize Persona <ChevronRight className="w-4 h-4" />
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
								EMBEDDING PERSONALITY...
							</h3>
							<p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
								Encoding patterns from multiple dialogues
							</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
