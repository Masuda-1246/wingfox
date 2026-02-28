import { FoxAvatar } from "@/components/icons/FoxAvatar";
import { formatTime } from "@/lib/date";
import { useMatchingResults } from "@/lib/hooks/useMatchingResults";
import { useMatchingResult } from "@/lib/hooks/useMatchingResults";
import { usePartnerFoxChatMessages, useSendPartnerFoxMessage } from "@/lib/hooks/usePartnerFoxChats";
import { useDirectChatMessages, useSendDirectChatMessage } from "@/lib/hooks/useDirectChats";
import { useFoxConversationMessages } from "@/lib/hooks/useFoxConversations";
import { useCreatePartnerFoxChat } from "@/lib/hooks/usePartnerFoxChats";
import { useReportUser } from "@/lib/hooks/useModeration";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertTriangle,
	Bot,
	Menu,
	PieChart,
	Send,
	ShieldAlert,
	Sparkles,
	Target,
	User,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Message {
	id: string;
	senderId: string;
	senderName: string;
	text: string;
	type: "text" | "system" | "suggestion";
	timestamp: Date;
	isAi?: boolean;
}

interface ChatSession {
	id: string;
	partnerName: string;
	partnerFoxVariant: number;
	partnerImage?: string;
	lastMessage: string;
	compatibilityScore: number;
	status: "active" | "archived";
	messages: Message[];
	suggestion?: Message;
}

const labelData = [
	{ label: "Humor", x: 50, y: 5 },
	{ label: "Logic", x: 92, y: 30 },
	{ label: "Empathy", x: 92, y: 70 },
	{ label: "Vibe", x: 50, y: 95 },
	{ label: "Wit", x: 8, y: 70 },
	{ label: "Calm", x: 8, y: 30 },
];

export function Chat() {
	const { t } = useTranslation("chat");
	const { user } = useAuth();
	const { data: matchingData, isLoading } = useMatchingResults(undefined, { enabled: !!user });
	const matches = matchingData?.data ?? [];
	const sessions: ChatSession[] = matches.map((m) => ({
		id: m.id,
		partnerName: m.partner?.nickname ?? "マッチ",
		partnerFoxVariant: 0,
		partnerImage: m.partner?.avatar_url ?? "https://picsum.photos/200/300?random=0",
		lastMessage: "",
		compatibilityScore: m.final_score ?? 0,
		status: "active" as const,
		messages: [],
	}));

	const [activeSessionId, setActiveSessionId] = useState<string>(
		sessions[0]?.id ?? "",
	);
	const [inputValue, setInputValue] = useState("");
	const [showReportModal, setShowReportModal] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	const matchDetail = useMatchingResult(activeSessionId, { enabled: !!user });
	const detail = matchDetail.data;
	const partnerFoxChatId = detail?.partner_fox_chat_id ?? null;
	const directChatRoomId = detail?.direct_chat_room_id ?? null;
	const foxConversationId = detail?.fox_conversation_id ?? null;
	const partnerName = detail?.partner?.nickname ?? sessions.find((s) => s.id === activeSessionId)?.partnerName ?? "";

	const partnerFoxMessages = usePartnerFoxChatMessages(partnerFoxChatId);
	const sendPartnerFox = useSendPartnerFoxMessage(partnerFoxChatId);
	const directMessages = useDirectChatMessages(directChatRoomId);
	const sendDirect = useSendDirectChatMessage(directChatRoomId);
	const foxMessages = useFoxConversationMessages(foxConversationId);
	const createPartnerFox = useCreatePartnerFoxChat();

	// Resolve messages for active session from the right source
	const activeMessages: Message[] = (() => {
		if (partnerFoxChatId && partnerFoxMessages.data?.data) {
			return partnerFoxMessages.data.data.map((m) => ({
				id: m.id,
				senderId: m.role === "user" ? "me" : "fox",
				senderName: m.role === "user" ? "You" : partnerName,
				text: m.content,
				type: "text" as const,
				timestamp: new Date(m.created_at),
				isAi: m.role !== "user",
			}));
		}
		if (directChatRoomId && directMessages.data?.data) {
			return directMessages.data.data.map((m) => ({
				id: m.id,
				senderId: m.sender_id,
				senderName: m.sender_id ? "You" : partnerName,
				text: m.content,
				type: "text" as const,
				timestamp: new Date(m.created_at),
				isAi: false,
			}));
		}
		if (foxConversationId && foxMessages.data?.data) {
			return foxMessages.data.data.map((m) => ({
				id: m.id,
				senderId: m.speaker === "my_fox" ? "my_fox" : "partner_fox",
				senderName: m.speaker === "my_fox" ? "My Fox" : `${partnerName} Fox`,
				text: m.content,
				type: "text" as const,
				timestamp: new Date(m.created_at),
				isAi: true,
			}));
		}
		return [];
	})();

	const activeSession: ChatSession | undefined = sessions.find(
		(s) => s.id === activeSessionId,
	);
	const displaySession: ChatSession = activeSession
		? { ...activeSession, messages: activeMessages }
		: {
				id: activeSessionId,
				partnerName: partnerName || "マッチ",
				partnerImage: "https://picsum.photos/200/300?random=0",
				lastMessage: "",
				compatibilityScore: detail?.final_score ?? 0,
				status: "active",
				messages: activeMessages,
			};
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [activeMessages, scrollToBottom]);

	const canSendMessage = Boolean(
		(partnerFoxChatId && sendPartnerFox) ||
			(directChatRoomId && sendDirect),
	);

	const handleSendMessage = async (text: string) => {
		if (!text.trim()) return;
		try {
			if (partnerFoxChatId) {
				await sendPartnerFox.mutateAsync(text);
			} else if (directChatRoomId) {
				await sendDirect.mutateAsync(text);
			} else {
				toast.info("まずパートナーフォックスチャットを開始してください");
				return;
			}
			setInputValue("");
		} catch (e) {
			console.error(e);
			toast.error("送信に失敗しました");
		}
	};

	const handleStartPartnerFoxChat = async () => {
		if (!activeSessionId) return;
		try {
			await createPartnerFox.mutateAsync(activeSessionId);
			toast.success("パートナーフォックスチャットを開始しました");
			matchDetail.refetch();
		} catch (e) {
			console.error(e);
			toast.error("チャットの開始に失敗しました");
		}
	};

	const handleApproveSuggestion = () => {
		toast.info("APIでは提案承認は未実装です");
	};

	const handleRejectSuggestion = () => {
		toast.info("提案を破棄しました");
	};

	// Set first match as active when matches load
	useEffect(() => {
		if (sessions.length > 0 && !activeSessionId) {
			setActiveSessionId(sessions[0].id);
		}
	}, [sessions, activeSessionId]);

	const handleReport = () => {
		setShowReportModal(false);
		toast.error(t("reported_toast"));
	};

	return (
		<div className="flex h-[calc(100vh-4rem)] w-full bg-background text-foreground overflow-hidden p-4 md:p-6">
			<div className="w-full h-full max-h-full grid grid-cols-12 gap-4 md:gap-6 max-w-[1600px] mx-auto min-h-0 overflow-hidden">
				{/* Left Sidebar */}
				<div
					className={cn(
						"col-span-12 md:col-span-4 lg:col-span-3 flex flex-col min-h-0 h-full",
						isSidebarOpen
							? "fixed inset-0 z-50 bg-background p-4"
							: "hidden md:flex",
					)}
				>
					{isSidebarOpen && (
						<button
							type="button"
							onClick={() => setIsSidebarOpen(false)}
							className="absolute top-4 right-4 md:hidden p-2 rounded-full border border-border"
						>
							<X className="w-5 h-5" />
						</button>
					)}
					<div className="flex items-center justify-between mb-2 shrink-0">
						<h2 className="text-2xl font-black tracking-tight">{t("title")}</h2>
						<div className="text-[10px] font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20 uppercase">
							{t("active")}
						</div>
					</div>
					<div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
						{isLoading ? (
							<div className="flex items-center justify-center py-8">
								<div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary border-t-transparent" />
							</div>
						) : sessions.length === 0 ? (
							<p className="text-sm text-muted-foreground p-4">
								マッチング結果がありません
							</p>
						) : (
						sessions.map((session) => (
							<div
								key={session.id}
								onClick={() => {
									setActiveSessionId(session.id);
									setIsSidebarOpen(false);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										setActiveSessionId(session.id);
										setIsSidebarOpen(false);
									}
								}}
								className={cn(
									"group relative p-4 rounded-2xl border transition-all cursor-pointer",
									activeSessionId === session.id
										? "bg-card border-secondary/50 ring-1 ring-secondary/20 shadow-sm"
										: "bg-card border-border hover:bg-accent/50",
								)}
							>
								<div className="flex items-start gap-3">
									<FoxAvatar
										variant={session.partnerFoxVariant}
										className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-border"
									/>
									<div className="flex-1 min-w-0">
										<div className="flex justify-between items-center mb-1">
											<h3 className="font-bold text-sm truncate uppercase">
												{session.partnerName}
											</h3>
										</div>
										<p className="text-xs text-muted-foreground truncate line-clamp-1">
											{session.lastMessage}
										</p>
									</div>
								</div>
							</div>
						)))}
					</div>
				</div>

				{/* Center Main Chat Area */}
				<div className="col-span-12 md:col-span-8 lg:col-span-6 flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden relative min-h-0">
					<div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/50 backdrop-blur-sm shrink-0 z-10">
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => setIsSidebarOpen(true)}
								className="md:hidden p-2 -ml-2 rounded-full hover:bg-accent"
							>
								<Menu className="w-5 h-5" />
							</button>
							<div className="flex flex-col">
								<h3 className="font-black text-base uppercase tracking-tight">
									{displaySession.partnerName}
								</h3>
								<span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">
									{t("persona_sync_active")}
								</span>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => setShowReportModal(true)}
								className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
							>
								<ShieldAlert className="w-5 h-5" />
							</button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 min-h-0">
						{displaySession.messages.map((msg) => {
							const isMe =
								msg.senderId === "me" ||
								msg.senderId === "user" ||
								msg.senderId === "my_fox";
							return (
								<motion.div
									key={msg.id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									className={cn(
										"flex gap-3 max-w-[85%]",
										isMe ? "ml-auto flex-row-reverse" : "",
									)}
								>
									<div
										className={cn(
											"w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-border",
											isMe ? "bg-foreground text-background" : "bg-muted",
										)}
									>
										{isMe ? (
											<User className="w-4 h-4" />
										) : (
											<Bot className="w-4 h-4" />
										)}
									</div>
									<div
										className={cn(
											"flex flex-col",
											isMe ? "items-end" : "items-start",
										)}
									>
										<div
											className={cn(
												"px-4 py-2.5 rounded-2xl text-sm border",
												isMe
													? "bg-secondary text-white border-secondary"
													: "bg-background border-border",
											)}
										>
											{msg.text}
										</div>
										<span className="text-[10px] text-muted-foreground mt-1 px-1 uppercase font-bold tracking-tighter">
											{msg.senderName} &bull; {formatTime(msg.timestamp)}
										</span>
									</div>
								</motion.div>
							);
						})}

						<AnimatePresence>
							{displaySession.suggestion && (
								<motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.95 }}
									className="mx-auto w-full max-w-lg mt-8"
								>
									<div className="bg-secondary/5 border-2 border-dashed border-secondary/30 rounded-2xl p-5">
										<div className="flex items-center gap-2 mb-3 text-secondary">
											<Sparkles className="w-4 h-4" />
											<span className="text-[10px] font-black uppercase tracking-widest">
												{t("ai_suggestion")}
											</span>
										</div>
										<div className="bg-background border border-border rounded-xl p-4 mb-4 text-sm font-medium italic">
											&ldquo;{displaySession.suggestion.text}&rdquo;
										</div>
										<div className="flex gap-2 justify-end">
											<button
												type="button"
												onClick={handleRejectSuggestion}
												className="px-4 py-2 text-[10px] font-black uppercase border border-border rounded-full hover:bg-muted"
											>
												{t("discard")}
											</button>
											<button
												type="button"
												onClick={handleApproveSuggestion}
												className="px-6 py-2 text-[10px] font-black uppercase bg-secondary text-white rounded-full hover:bg-secondary/90"
											>
												{t("approve_send")}
											</button>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
						<div ref={messagesEndRef} />
					</div>

					<div className="p-6 bg-background/50 border-t border-border backdrop-blur-sm shrink-0">
						{!canSendMessage && detail && !partnerFoxChatId && detail.fox_conversation_id && (
							<div className="mb-4">
								<button
									type="button"
									onClick={handleStartPartnerFoxChat}
									disabled={createPartnerFox.isPending}
									className="w-full py-3 rounded-2xl border-2 border-dashed border-secondary/50 bg-secondary/5 text-sm font-bold hover:bg-secondary/10 transition-colors disabled:opacity-50"
								>
									{createPartnerFox.isPending ? "開始中..." : "パートナーフォックスチャットを開始"}
								</button>
							</div>
						)}
						<div className="flex items-center gap-2 bg-background border border-border rounded-2xl px-4 py-2 focus-within:border-secondary transition-all">
							<input
								type="text"
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={(e) =>
									e.key === "Enter" && handleSendMessage(inputValue)
								}
								placeholder={t("input_placeholder")}
								className="flex-1 bg-transparent border-none outline-none text-sm h-10"
							/>
							<button
								type="button"
								onClick={() => handleSendMessage(inputValue)}
								disabled={!inputValue.trim() || !canSendMessage}
								className="p-2.5 bg-foreground text-background rounded-xl hover:bg-foreground/90 disabled:opacity-50 transition-all"
							>
								<Send className="w-4 h-4" />
							</button>
						</div>
					</div>
				</div>

				{/* Right Info Panel */}
				<div className="hidden lg:col-span-3 lg:flex flex-col gap-6 min-h-0 overflow-y-auto pr-1">
					<div className="bg-card border border-border rounded-2xl p-6 flex flex-col relative overflow-hidden shrink-0">
						<div className="flex items-center justify-between mb-6">
							<span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
								{t("compatibility")}
							</span>
							<Target className="w-3.5 h-3.5 text-secondary/60" />
						</div>
						<div className="flex items-end gap-1.5 mb-2">
							<span className="text-5xl font-black tracking-tighter">
								{displaySession.compatibilityScore}
							</span>
							<span className="text-xs font-black text-secondary uppercase mb-2">
								{t("sync")}
							</span>
						</div>
						<div className="h-1 w-full bg-muted rounded-full overflow-hidden mb-4">
							<motion.div
								initial={{ width: 0 }}
								animate={{
									width: `${displaySession.compatibilityScore}%`,
								}}
								transition={{ duration: 1, ease: "easeOut" }}
								className="h-full bg-secondary"
							/>
						</div>
						<p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
							{t("compatibility_description")}
						</p>
					</div>

					<div className="bg-card border border-border rounded-2xl p-6 flex flex-col shrink-0">
						<div className="flex items-center justify-between mb-4">
							<span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
								{t("trait_synergy")}
							</span>
							<div className="flex items-center gap-3">
								<div className="flex items-center gap-1.5">
									<div className="w-1.5 h-1.5 rounded-full bg-foreground" />
									<span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">
										{t("my")}
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									<div className="w-1.5 h-1.5 rounded-full bg-secondary" />
									<span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">
										{t("partner")}
									</span>
								</div>
							</div>
						</div>
						<div className="relative w-full aspect-square flex items-center justify-center">
							<svg
								viewBox="0 0 100 100"
								className="w-full h-full overflow-visible"
								aria-hidden="true"
							>
								{[0.2, 0.4, 0.6, 0.8, 1.0].map((level) => (
									<polygon
										key={level}
										points={[0, 60, 120, 180, 240, 300]
											.map((deg) => {
												const rad = (Math.PI / 180) * (deg - 90);
												return `${50 + 40 * level * Math.cos(rad)},${50 + 40 * level * Math.sin(rad)}`;
											})
											.join(" ")}
										className="fill-none stroke-border stroke-[0.5]"
									/>
								))}
								{[0, 60, 120, 180, 240, 300].map((deg) => {
									const rad = (Math.PI / 180) * (deg - 90);
									return (
										<line
											key={deg}
											x1="50"
											y1="50"
											x2={50 + 40 * Math.cos(rad)}
											y2={50 + 40 * Math.sin(rad)}
											className="stroke-border stroke-[0.5]"
										/>
									);
								})}
								<motion.polygon
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									points={[
										{ val: 82 },
										{ val: 40 },
										{ val: 90 },
										{ val: 60 },
										{ val: 85 },
										{ val: 45 },
									]
										.map((item, i) => {
											const rad = (Math.PI / 180) * (i * 60 - 90);
											const dist = (item.val / 100) * 40;
											return `${50 + dist * Math.cos(rad)},${50 + dist * Math.sin(rad)}`;
										})
										.join(" ")}
									className="fill-foreground/10 stroke-foreground/40 stroke-1"
								/>
								<motion.polygon
									initial={{ opacity: 0, scale: 0.8 }}
									animate={{ opacity: 1, scale: 1 }}
									points={[
										{ val: 92 },
										{ val: 65 },
										{ val: 78 },
										{ val: 85 },
										{ val: 70 },
										{ val: 55 },
									]
										.map((item, i) => {
											const rad = (Math.PI / 180) * (i * 60 - 90);
											const dist = (item.val / 100) * 40;
											return `${50 + dist * Math.cos(rad)},${50 + dist * Math.sin(rad)}`;
										})
										.join(" ")}
									className="fill-secondary/20 stroke-secondary stroke-1"
								/>
								{labelData.map((l) => (
									<text
										key={l.label}
										x={l.x}
										y={l.y}
										textAnchor="middle"
										className="fill-muted-foreground font-black text-[5px] uppercase tracking-tighter"
									>
										{l.label}
									</text>
								))}
							</svg>
						</div>
						<div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-1">
							<div className="flex flex-col">
								<span className="text-[8px] font-black text-muted-foreground uppercase">
									{t("peak")}
								</span>
								<span className="text-xs font-black truncate">HUMOR</span>
							</div>
							<div className="flex flex-col items-center">
								<span className="text-[8px] font-black text-secondary uppercase tracking-tighter">
									{t("overlap")}
								</span>
								<span className="text-xs font-black">81.4%</span>
							</div>
							<div className="flex flex-col items-end">
								<span className="text-[8px] font-black text-muted-foreground uppercase">
									{t("avg")}
								</span>
								<span className="text-xs font-black">74.1%</span>
							</div>
						</div>
					</div>

					<div className="bg-card border border-border rounded-2xl p-6 flex flex-col shrink-0">
						<div className="flex items-center justify-between mb-6">
							<span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
								{t("topic_distribution")}
							</span>
							<PieChart className="w-3.5 h-3.5 text-secondary/60" />
						</div>
						<div className="flex flex-col gap-5">
							{[
								{
									label: t("entertainment"),
									pct: 45,
									color: "bg-secondary",
								},
								{
									label: t("lifestyle"),
									pct: 30,
									color: "bg-foreground",
								},
								{
									label: t("ideology"),
									pct: 15,
									color: "bg-muted-foreground",
								},
								{ label: t("other"), pct: 10, color: "bg-muted" },
							].map((topic) => (
								<div key={topic.label} className="flex items-center gap-3">
									<div
										className={cn("w-1.5 h-1.5 rounded-full", topic.color)}
									/>
									<div className="flex-1 flex justify-between items-center">
										<span className="text-[10px] font-black uppercase tracking-tight">
											{topic.label}
										</span>
										<span className="text-[10px] font-black">{topic.pct}%</span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Report Modal */}
			<AnimatePresence>
				{showReportModal && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							className="bg-card w-full max-w-md border border-border rounded-2xl shadow-2xl overflow-hidden"
						>
							<div className="p-8 text-center">
								<div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
									<AlertTriangle className="w-8 h-8" />
								</div>
								<h3 className="text-xl font-black mb-2">
									{t("report_conversation")}
								</h3>
								<p className="text-sm text-muted-foreground">
									{t("report_question")}
								</p>
								<div className="mt-6 space-y-2">
									<button
										type="button"
										onClick={handleReport}
										className="w-full py-3 bg-red-600 text-white text-[10px] font-black uppercase rounded-full hover:bg-red-700"
									>
										{t("confirm_report")}
									</button>
									<button
										type="button"
										onClick={() => setShowReportModal(false)}
										className="w-full py-3 text-[10px] font-black uppercase text-muted-foreground hover:text-foreground"
									>
										{t("cancel")}
									</button>
								</div>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
}
