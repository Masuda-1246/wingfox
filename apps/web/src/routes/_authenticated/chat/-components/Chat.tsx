import { FoxAvatar } from "@/components/icons/FoxAvatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { formatTime } from "@/lib/date";
import {
	usePendingChatRequests,
	useRequestDirectChat,
	useRespondChatRequest,
} from "@/lib/hooks/useChatRequests";
import {
	useDirectChatMessages,
	useSendDirectChatMessage,
} from "@/lib/hooks/useDirectChats";
import { useFoxConversationMessages } from "@/lib/hooks/useFoxConversations";
import {
	useMultipleFoxConversationStatus,
	useRetryFoxConversation,
	useStartFoxSearch,
} from "@/lib/hooks/useFoxSearch";
import { useMatchingResults } from "@/lib/hooks/useMatchingResults";
import { useMatchingResult } from "@/lib/hooks/useMatchingResults";
import { useBlockUser } from "@/lib/hooks/useModeration";
import {
	useCreatePartnerFoxChat,
	usePartnerFoxChatMessages,
	useSendPartnerFoxMessage,
} from "@/lib/hooks/usePartnerFoxChats";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { AnimatePresence, m } from "framer-motion";
import {
	AlertTriangle,
	ArrowLeft,
	Bot,
	Clock,
	Loader2,
	Mail,
	MessageCircle,
	PieChart,
	RefreshCw,
	Search,
	Send,
	ShieldAlert,
	Sparkles,
	Target,
	User,
	UserX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DailyMatchBanner } from "./DailyMatchBanner";

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
	compatibilityScore: number | null;
	status: "active" | "archived";
	matchStatus: string;
	messages: Message[];
	suggestion?: Message;
}

interface FoxFeatureScores {
	reciprocity?: number;
	humor_sharing?: number;
	self_disclosure?: number;
	emotional_responsiveness?: number;
	self_esteem?: number;
	conflict_resolution?: number;
}

interface ScoreDetails {
	fox_feature_scores?: FoxFeatureScores;
	conversation_analysis?: {
		topic_distribution?: { topic: string; percentage: number }[];
	};
}

const TRAIT_AXES = [
	{ key: "reciprocity" as const, label: "好意の返報性" },
	{ key: "humor_sharing" as const, label: "ユーモア共有" },
	{ key: "self_disclosure" as const, label: "自己開示" },
	{ key: "emotional_responsiveness" as const, label: "感情的応答性" },
	{ key: "self_esteem" as const, label: "自己肯定感" },
	{ key: "conflict_resolution" as const, label: "葛藤解決" },
];

const TOPIC_COLORS = [
	"bg-secondary",
	"bg-foreground",
	"bg-muted-foreground",
	"bg-muted",
	"bg-secondary/60",
	"bg-foreground/60",
];

function getTraitScores(details: unknown): number[] | null {
	const d = details as ScoreDetails | null;
	if (!d?.fox_feature_scores) return null;
	const fs = d.fox_feature_scores;
	const scores = TRAIT_AXES.map((a) => fs[a.key]);
	if (scores.every((s) => s == null)) return null;
	return scores.map((s) => s ?? 0);
}

function getTopicDistribution(
	details: unknown,
): { topic: string; percentage: number }[] | null {
	const d = details as ScoreDetails | null;
	const dist = d?.conversation_analysis?.topic_distribution;
	if (!dist || !Array.isArray(dist) || dist.length === 0) return null;
	return dist;
}

/** メッセージをプレーンテキスト表示用に変換（Markdown記法を除去） */
function messageToPlainText(text: string): string {
	if (!text?.trim()) return text;
	return text
		.replace(/\*\*([^*]*)\*\*/g, "$1")
		.replace(/\*([^*]*)\*/g, "$1")
		.replace(/#{1,6}\s*/g, "")
		.replace(/__([^_]*)__/g, "$1")
		.replace(/_([^_]*)_/g, "$1")
		.trim();
}

export function Chat() {
	const { t } = useTranslation("chat");
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const { data: matchingData, isLoading } = useMatchingResults(
		{
			status:
				"fox_conversation_in_progress,fox_conversation_completed,fox_conversation_failed,partner_chat_started,direct_chat_requested,direct_chat_active,chat_request_expired,chat_request_declined",
		},
		{ enabled: !!user },
	);
	const matches = matchingData?.data ?? [];
	const sessions: ChatSession[] = matches.map((m) => ({
		id: m.id,
		partnerName: m.partner?.nickname ?? "マッチ",
		partnerFoxVariant: 0,
		partnerImage:
			m.partner?.persona_icon_url ?? m.partner?.avatar_url ?? undefined,
		lastMessage: "",
		compatibilityScore:
			m.conversation_score != null ? (m.final_score ?? 0) : null,
		status: "active" as const,
		matchStatus: m.status,
		messages: [],
	}));

	const sortedSessions = useMemo(() => {
		return [...sessions].sort((a, b) => {
			const aIsMeasuring = a.matchStatus === "fox_conversation_in_progress";
			const bIsMeasuring = b.matchStatus === "fox_conversation_in_progress";
			if (aIsMeasuring && !bIsMeasuring) return -1;
			if (!aIsMeasuring && bIsMeasuring) return 1;
			return (b.compatibilityScore ?? 0) - (a.compatibilityScore ?? 0);
		});
	}, [sessions]);

	const search = useSearch({ from: "/_authenticated/chat" });
	const [activeSessionId, setActiveSessionId] = useState<string>("");

	// Sync activeSessionId from URL (deep link) or sessions: initial from search.match_id or first session; fix if current selection not in list
	useEffect(() => {
		if (sessions.length === 0) return;
		const validFromSearch =
			search.match_id && sessions.some((s) => s.id === search.match_id);
		if (activeSessionId === "" && validFromSearch && search.match_id) {
			setActiveSessionId(search.match_id);
		} else if (activeSessionId === "" && sessions[0]) {
			setActiveSessionId(sessions[0].id);
		} else if (!sessions.some((s) => s.id === activeSessionId) && sessions[0]) {
			setActiveSessionId(sessions[0].id);
		}
	}, [sessions, search.match_id, activeSessionId]);
	const [inputValue, setInputValue] = useState("");
	const [showReportModal, setShowReportModal] = useState(false);
	const [showUnmatchModal, setShowUnmatchModal] = useState(false);
	const isMobile = useIsMobile();
	const [mobileView, setMobileView] = useState<"list" | "chat" | "analysis">(
		"list",
	);
	const [activeFoxConvMap, setActiveFoxConvMap] = useState<
		Record<string, string>
	>({});
	const [dailyMatchFoxConvMap, setDailyMatchFoxConvMap] = useState<
		Record<string, string>
	>({});
	const activeFoxConvIds = useMemo(
		() => Object.values(activeFoxConvMap),
		[activeFoxConvMap],
	);
	const anyFoxConvLive = activeFoxConvIds.length > 0;
	const blockUser = useBlockUser();
	const startFoxSearch = useStartFoxSearch();
	const retryFoxConversation = useRetryFoxConversation();
	const multiStatus = useMultipleFoxConversationStatus(activeFoxConvIds);

	// Restore activeFoxConvMap from server data on mount/reload
	// biome-ignore lint/correctness/useExhaustiveDependencies: run only when matches changes; activeFoxConvMap intentionally excluded to avoid loop
	useEffect(() => {
		if (Object.keys(activeFoxConvMap).length > 0) return;
		const restoredMap: Record<string, string> = {};
		for (const m of matches) {
			if (
				m.status === "fox_conversation_in_progress" &&
				m.fox_conversation_id
			) {
				restoredMap[m.id] = m.fox_conversation_id;
			}
		}
		if (Object.keys(restoredMap).length > 0) {
			setActiveFoxConvMap(restoredMap);
		}
	}, [matches]);

	// Refetch match list when fox conversations complete
	const completedIdsRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		let newlyCompleted = false;
		for (const id of activeFoxConvIds) {
			const s = multiStatus.statusMap.get(id);
			if (
				(s?.status === "completed" || s?.status === "failed") &&
				!completedIdsRef.current.has(id)
			) {
				completedIdsRef.current.add(id);
				newlyCompleted = true;
			}
		}
		if (newlyCompleted) {
			queryClient.invalidateQueries({ queryKey: ["matching", "results"] });
		}
		const allDone =
			activeFoxConvIds.length > 0 &&
			activeFoxConvIds.every((id) => completedIdsRef.current.has(id));
		if (allDone) {
			setActiveFoxConvMap({});
			completedIdsRef.current.clear();
		}
	}, [activeFoxConvIds, multiStatus.statusMap, queryClient]);

	const matchDetail = useMatchingResult(activeSessionId, { enabled: !!user });
	const detail = matchDetail.data;
	const directChatRoomId = detail?.direct_chat_room_id ?? null;
	// Use fox_conversation_id mapped to the currently selected match, or fall back to match detail
	const foxConversationId =
		activeFoxConvMap[activeSessionId] ??
		dailyMatchFoxConvMap[activeSessionId] ??
		detail?.fox_conversation_id ??
		null;
	const isFoxConvLive = Boolean(activeFoxConvMap[activeSessionId]);
	const partnerId = detail?.partner_id ?? null;
	const partnerName =
		detail?.partner?.nickname ??
		sessions.find((s) => s.id === activeSessionId)?.partnerName ??
		"";

	// Tab state
	type ChatTab = "fox" | "partner_fox" | "direct";
	const [activeTab, setActiveTab] = useState<ChatTab>("fox");

	// Partner Fox Chat hooks
	const partnerFoxChatId = detail?.partner_fox_chat_id ?? null;
	const partnerFoxMessages = usePartnerFoxChatMessages(partnerFoxChatId);
	const sendPartnerFox = useSendPartnerFoxMessage(partnerFoxChatId);
	const createPartnerFoxChat = useCreatePartnerFoxChat();

	const directMessages = useDirectChatMessages(directChatRoomId);
	const sendDirect = useSendDirectChatMessage(directChatRoomId);
	const foxMessages = useFoxConversationMessages(foxConversationId, undefined, {
		refetchInterval: isFoxConvLive ? 3000 : false,
	});

	// Chat request hooks
	const requestDirectChat = useRequestDirectChat();
	const pendingChatRequests = usePendingChatRequests();
	const respondChatRequest = useRespondChatRequest();

	// Find pending chat request for the currently selected match
	const pendingRequestForMatch = useMemo(() => {
		return (
			pendingChatRequests.data?.find((r) => r.match_id === activeSessionId) ??
			null
		);
	}, [pendingChatRequests.data, activeSessionId]);

	// Tab visibility conditions
	const showFoxTab = Boolean(foxConversationId);
	// Tab visibility: show "Foxとチャット" when completed so user can create it, or when already started
	const showPartnerFoxTab =
		Boolean(partnerFoxChatId) ||
		(detail?.status &&
			[
				"fox_conversation_completed",
				"partner_chat_started",
				"direct_chat_requested",
				"direct_chat_active",
			].includes(detail.status));
	const showDirectTab =
		Boolean(directChatRoomId) ||
		(detail?.status &&
			[
				"partner_chat_started",
				"direct_chat_requested",
				"direct_chat_active",
			].includes(detail.status)) ||
		Boolean(pendingRequestForMatch);

	// Auto-select appropriate tab when match status changes (do not switch to partner_fox when only completed)
	// When there's a pending DM request for this match, show "direct" tab so user sees approve/decline buttons.
	// When match status is direct_chat_requested (request sent, no room yet), always show "direct" tab so both
	// requester sees "waiting" and responder sees approve/decline as soon as pendingRequestForMatch loads.
	useEffect(() => {
		if (directChatRoomId) {
			setActiveTab("direct");
		} else if (
			pendingRequestForMatch ||
			detail?.status === "direct_chat_requested"
		) {
			setActiveTab("direct");
		} else if (
			partnerFoxChatId ||
			(detail?.status &&
				["partner_chat_started", "direct_chat_active"].includes(detail.status))
		) {
			setActiveTab("partner_fox");
		} else {
			setActiveTab("fox");
		}
	}, [
		directChatRoomId,
		partnerFoxChatId,
		detail?.status,
		pendingRequestForMatch,
	]);

	// Resolve messages for active session based on active tab
	const activeMessages: Message[] = useMemo(() => {
		if (
			activeTab === "direct" &&
			directChatRoomId &&
			directMessages.data?.pages
		) {
			return [...directMessages.data.pages].reverse().flatMap((page) =>
				page.data.map((m) => ({
					id: m.id,
					senderId: m.is_mine ? "me" : m.sender_id,
					senderName: m.is_mine ? "You" : partnerName,
					text: m.content,
					type: "text" as const,
					timestamp: new Date(m.created_at),
					isAi: false,
				})),
			);
		}
		if (
			activeTab === "partner_fox" &&
			partnerFoxChatId &&
			partnerFoxMessages.data?.data
		) {
			return partnerFoxMessages.data.data.map((m) => ({
				id: m.id,
				senderId: m.role === "user" ? "me" : "partner_fox",
				senderName: m.role === "user" ? "You" : `${partnerName} Fox`,
				text: m.content,
				type: "text" as const,
				timestamp: new Date(m.created_at),
				isAi: m.role !== "user",
			}));
		}
		if (activeTab === "fox" && foxConversationId && foxMessages.data?.data) {
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
	}, [
		activeTab,
		directChatRoomId,
		directMessages.data?.pages,
		partnerFoxChatId,
		partnerFoxMessages.data?.data,
		foxConversationId,
		foxMessages.data?.data,
		partnerName,
	]);

	const activeSession: ChatSession | undefined = sessions.find(
		(s) => s.id === activeSessionId,
	);
	const displaySession: ChatSession = activeSession
		? { ...activeSession, messages: activeMessages }
		: ({
				id: activeSessionId,
				partnerName: partnerName || "マッチ",
				partnerImage:
					detail?.partner?.persona_icon_url ??
					detail?.partner?.avatar_url ??
					undefined,
				partnerFoxVariant: 0,
				lastMessage: "",
				compatibilityScore:
					detail?.conversation_score != null
						? (detail?.final_score ?? 0)
						: null,
				status: "active",
				matchStatus: detail?.status ?? "",
				messages: activeMessages,
			} as ChatSession);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const topSentinelRef = useRef<HTMLDivElement>(null);
	const prevScrollHeightRef = useRef<number>(0);
	const initialScrollDoneRef = useRef<string | null>(null);

	// Scroll to bottom (for initial load & new messages)
	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		messagesEndRef.current?.scrollIntoView({ behavior });
	}, []);

	// Initial scroll to bottom when session changes or first load
	useEffect(() => {
		if (
			activeMessages.length > 0 &&
			initialScrollDoneRef.current !== activeSessionId
		) {
			initialScrollDoneRef.current = activeSessionId;
			// Use requestAnimationFrame to ensure DOM has rendered
			requestAnimationFrame(() => {
				scrollToBottom("instant");
			});
		}
	}, [activeMessages.length, activeSessionId, scrollToBottom]);

	// Reset initial scroll flag when session changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset ref when session changes intentionally
	useEffect(() => {
		initialScrollDoneRef.current = null;
	}, [activeSessionId]);

	// Scroll position preservation after loading older messages
	// biome-ignore lint/correctness/useExhaustiveDependencies: sync scroll on layout; activeMessages used as trigger only
	useEffect(() => {
		const container = chatContainerRef.current;
		if (!container) return;
		if (prevScrollHeightRef.current > 0) {
			const newScrollHeight = container.scrollHeight;
			container.scrollTop += newScrollHeight - prevScrollHeightRef.current;
			prevScrollHeightRef.current = 0;
		}
	}, [activeMessages]);

	// IntersectionObserver for infinite scroll (load older messages)
	useEffect(() => {
		const sentinel = topSentinelRef.current;
		const container = chatContainerRef.current;
		if (!sentinel || !container) return;
		if (!directMessages.hasNextPage || directMessages.isFetchingNextPage)
			return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (
					entries[0]?.isIntersecting &&
					directMessages.hasNextPage &&
					!directMessages.isFetchingNextPage
				) {
					prevScrollHeightRef.current = container.scrollHeight;
					directMessages.fetchNextPage();
				}
			},
			{ root: container, threshold: 0.1 },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [
		directMessages.hasNextPage,
		directMessages.isFetchingNextPage,
		directMessages.fetchNextPage,
	]);

	// Auto-scroll to bottom when sending a new message (if near bottom)
	const prevMessageCountRef = useRef(activeMessages.length);
	useEffect(() => {
		const container = chatContainerRef.current;
		if (!container) return;
		const wasNearBottom =
			container.scrollHeight - container.scrollTop - container.clientHeight <
			100;
		if (activeMessages.length > prevMessageCountRef.current && wasNearBottom) {
			requestAnimationFrame(() => scrollToBottom("smooth"));
		}
		prevMessageCountRef.current = activeMessages.length;
	}, [activeMessages.length, scrollToBottom]);

	const canSendMessage =
		(activeTab === "direct" && Boolean(directChatRoomId && sendDirect)) ||
		(activeTab === "partner_fox" &&
			Boolean(partnerFoxChatId && sendPartnerFox));

	const handleSendMessage = async (text: string) => {
		if (!text.trim()) return;
		setInputValue("");
		try {
			if (activeTab === "direct" && directChatRoomId) {
				await sendDirect.mutateAsync(text);
			} else if (activeTab === "partner_fox" && partnerFoxChatId) {
				await sendPartnerFox.mutateAsync(text);
			}
		} catch (e) {
			console.error(e);
			toast.error(t("send_failed"));
		}
	};

	const handlePartnerFoxTabClick = async () => {
		if (partnerFoxChatId) {
			setActiveTab("partner_fox");
			return;
		}
		if (!activeSessionId) return;
		try {
			toast.info(t("creating_partner_fox_chat"));
			await createPartnerFoxChat.mutateAsync(activeSessionId);
			queryClient.invalidateQueries({
				queryKey: ["matching", "results", activeSessionId],
			});
			toast.success(t("partner_fox_chat_created"));
			setActiveTab("partner_fox");
		} catch (e) {
			console.error(e);
			toast.error(t("send_failed"));
		}
	};

	const handleStartFoxSearch = async () => {
		try {
			const result = await startFoxSearch.mutateAsync();
			const convMap: Record<string, string> = {};
			for (const c of result.conversations) {
				convMap[c.match_id] = c.fox_conversation_id;
			}
			setActiveFoxConvMap(convMap);
			// Auto-select the first new match and refresh sidebar
			if (result.conversations.length > 0) {
				setActiveSessionId(result.conversations[0].match_id);
				if (isMobile) setMobileView("chat");
			}
			queryClient.invalidateQueries({ queryKey: ["matching", "results"] });
			toast.success(
				t("fox_search_started_multiple", {
					count: result.conversations.length,
				}),
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "";
			if (msg.includes("already in progress")) {
				toast.info(t("fox_search_in_progress"));
			} else if (msg.includes("No eligible partners")) {
				toast.info(t("fox_search_no_candidates"));
			} else {
				console.error(e);
				toast.error(t("fox_search_error"));
			}
		}
	};

	const handleRetryFoxConversation = async (matchId: string) => {
		try {
			const result = await retryFoxConversation.mutateAsync(matchId);
			setActiveFoxConvMap((prev) => ({
				...prev,
				[result.match_id]: result.fox_conversation_id,
			}));
			queryClient.invalidateQueries({ queryKey: ["matching", "results"] });
			toast.success(t("fox_retry_started"));
		} catch (e) {
			console.error(e);
			toast.error(t("fox_retry_error"));
		}
	};

	const handleApproveSuggestion = () => {
		toast.info("APIでは提案承認は未実装です");
	};

	const handleRejectSuggestion = () => {
		toast.info("提案を破棄しました");
	};

	// Aggregate progress from multiple conversations
	const foxProgress =
		anyFoxConvLive && multiStatus.totalRounds > 0
			? {
					current_round: multiStatus.currentRounds,
					total_rounds: multiStatus.totalRounds,
					completed: multiStatus.completedCount,
					total: multiStatus.total,
				}
			: null;

	// When all fox conversations are terminal, refresh matches and clear state
	useEffect(() => {
		if (anyFoxConvLive && multiStatus.allTerminal) {
			queryClient.invalidateQueries({ queryKey: ["matching", "results"] });
			setActiveFoxConvMap({});
			if (multiStatus.completedCount > 0) {
				toast.success(
					t("fox_search_completed_multiple", {
						count: multiStatus.completedCount,
					}),
				);
			}
			if (multiStatus.failedCount > 0) {
				toast.error(
					t("fox_search_failed_multiple", { count: multiStatus.failedCount }),
				);
			}
		}
	}, [
		anyFoxConvLive,
		multiStatus.allTerminal,
		multiStatus.completedCount,
		multiStatus.failedCount,
		queryClient,
		t,
	]);

	// Reset mobileView when switching to desktop
	useEffect(() => {
		if (!isMobile) setMobileView("list");
	}, [isMobile]);

	// Set first match as active when matches load or current session is removed (stable deps to avoid re-run every render)
	useEffect(() => {
		const list = matchingData?.data ?? [];
		if (
			list.length > 0 &&
			(!activeSessionId || !list.some((m) => m.id === activeSessionId)) &&
			!activeFoxConvMap[activeSessionId] &&
			!dailyMatchFoxConvMap[activeSessionId]
		) {
			setActiveSessionId(list[0].id);
		}
	}, [
		matchingData?.data,
		activeSessionId,
		activeFoxConvMap,
		dailyMatchFoxConvMap,
	]);

	const handleReport = () => {
		setShowReportModal(false);
		toast.error(t("reported_toast"));
	};

	const handleUnmatch = async () => {
		if (!partnerId) return;
		try {
			await blockUser.mutateAsync(partnerId);
			setShowUnmatchModal(false);
			toast.success(t("unmatch_success"));
			setActiveSessionId("");
		} catch {
			toast.error(t("unmatch_error"));
		}
	};

	const traitScores = getTraitScores(detail?.score_details);
	const topicDist = getTopicDistribution(detail?.score_details);

	return (
		<div className="flex h-[calc(100vh-4rem)] w-full bg-background text-foreground overflow-hidden p-4 md:p-6">
			<div className="w-full h-full max-h-full grid grid-cols-12 gap-4 md:gap-6 max-w-[1600px] mx-auto min-h-0 overflow-hidden">
				{/* Left Sidebar */}
				<div
					className={cn(
						"col-span-12 md:col-span-4 lg:col-span-3 flex flex-col min-h-0 h-full",
						isMobile
							? mobileView === "list"
								? "flex"
								: "hidden"
							: "hidden md:flex",
					)}
				>
					<div className="flex items-center justify-between mb-2 shrink-0">
						<h2 className="text-2xl font-black tracking-tight">{t("title")}</h2>
						<div className="text-[10px] font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20 uppercase">
							{t("active")}
						</div>
					</div>
					{/* Daily Match Banner */}
					<DailyMatchBanner
						onMatchSelect={(matchId, foxConversationId) => {
							setActiveSessionId(matchId);
							if (foxConversationId) {
								setDailyMatchFoxConvMap((prev) => ({
									...prev,
									[matchId]: foxConversationId,
								}));
							}
							setActiveTab("fox");
							if (isMobile) setMobileView("chat");
							queryClient.invalidateQueries({
								queryKey: ["matching", "results"],
							});
						}}
					/>
					{/* Fox Search Button & Progress */}
					<div className="mb-3 shrink-0">
						<button
							type="button"
							onClick={handleStartFoxSearch}
							disabled={startFoxSearch.isPending || anyFoxConvLive}
							className="w-full py-3 rounded-2xl border-2 border-dashed border-secondary/50 bg-secondary/5 text-sm font-bold hover:bg-secondary/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
						>
							{startFoxSearch.isPending ? (
								<div className="animate-spin rounded-full h-4 w-4 border-2 border-secondary border-t-transparent" />
							) : (
								<Search className="w-4 h-4" />
							)}
							{startFoxSearch.isPending
								? t("fox_search_searching")
								: anyFoxConvLive
									? t("fox_search_in_progress")
									: t("fox_search_button")}
						</button>
						{anyFoxConvLive && foxProgress && (
							<div className="mt-2 px-2">
								<div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground mb-1">
									<span>
										{t("fox_search_progress")} ({foxProgress.completed}/
										{foxProgress.total})
									</span>
									<span>
										{foxProgress.current_round}/{foxProgress.total_rounds}
									</span>
								</div>
								<div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
									<m.div
										initial={{ width: 0 }}
										animate={{
											width: `${(foxProgress.current_round / foxProgress.total_rounds) * 100}%`,
										}}
										transition={{ duration: 0.5, ease: "easeOut" }}
										className="h-full bg-secondary rounded-full"
									/>
								</div>
							</div>
						)}
					</div>

					<div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
						{isLoading ? (
							<div className="flex items-center justify-center py-8">
								<div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary border-t-transparent" />
							</div>
						) : sortedSessions.length === 0 ? (
							<p className="text-sm text-muted-foreground p-4">
								マッチング結果がありません
							</p>
						) : (
							sortedSessions.map((session) => (
								<button
									type="button"
									key={session.id}
									tabIndex={0}
									onClick={() => {
										setActiveSessionId(session.id);
										if (isMobile) setMobileView("chat");
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											setActiveSessionId(session.id);
											if (isMobile) setMobileView("chat");
										}
									}}
									className={cn(
										"group relative p-4 rounded-2xl border transition-all cursor-pointer w-full text-left",
										activeSessionId === session.id
											? "bg-card border-secondary/50 ring-1 ring-secondary/20 shadow-sm"
											: "bg-card border-border hover:bg-accent/50",
									)}
								>
									<div className="flex items-start gap-3">
										<div className="relative">
											<FoxAvatar
												iconUrl={session.partnerImage}
												className="w-10 h-10 md:w-12 md:h-12"
											/>
											{(() => {
												const foxConvId = activeFoxConvMap[session.id];
												if (!foxConvId) return null;
												const status = multiStatus.statusMap.get(foxConvId);
												if (status?.status === "completed") {
													return (
														<span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
													);
												}
												if (status?.status === "failed") {
													return (
														<span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-card" />
													);
												}
												return (
													<span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-secondary rounded-full border-2 border-card animate-pulse" />
												);
											})()}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex justify-between items-center gap-2 mb-1 min-h-[22px]">
												<h3 className="font-bold text-sm truncate uppercase">
													{session.partnerName}
												</h3>
												<span className="shrink-0">
													{session.compatibilityScore != null ? (
														<span className="text-[10px] font-black text-secondary bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">
															{session.compatibilityScore}%
														</span>
													) : session.matchStatus ===
														"fox_conversation_in_progress" ? (
														<span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 animate-pulse">
															{t("score_measuring")}
														</span>
													) : (
														<span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
															—%
														</span>
													)}
												</span>
											</div>
											{(() => {
												const foxConvId = activeFoxConvMap[session.id];
												if (!foxConvId) {
													if (
														session.matchStatus === "fox_conversation_failed"
													) {
														return (
															<div className="flex items-center gap-2 mt-1 min-h-[24px]">
																<span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
																	{t("match_status_fox_failed", "会話失敗")}
																</span>
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		handleRetryFoxConversation(session.id);
																	}}
																	disabled={retryFoxConversation.isPending}
																	className="text-[10px] font-bold text-secondary bg-secondary/10 hover:bg-secondary/20 px-2 py-0.5 rounded-full border border-secondary/20 disabled:opacity-50"
																>
																	{retryFoxConversation.isPending ? (
																		<Loader2 className="w-3 h-3 animate-spin inline" />
																	) : (
																		t("retry_measurement", "再測定")
																	)}
																</button>
															</div>
														);
													}
													if (
														session.matchStatus === "fox_conversation_completed"
													) {
														return (
															<div className="flex items-center gap-2 mt-1 min-h-[24px]">
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		handleRetryFoxConversation(session.id);
																	}}
																	disabled={retryFoxConversation.isPending}
																	className="text-[10px] font-bold text-secondary bg-secondary/10 hover:bg-secondary/20 px-2 py-0.5 rounded-full border border-secondary/20 disabled:opacity-50"
																>
																	{retryFoxConversation.isPending ? (
																		<Loader2 className="w-3 h-3 animate-spin inline" />
																	) : (
																		t("retry_measurement", "再測定")
																	)}
																</button>
															</div>
														);
													}
													if (session.matchStatus === "chat_request_expired") {
														return (
															<div className="mt-1 min-h-[24px] flex items-center">
																<span className="text-[10px] font-bold text-yellow-600 bg-yellow-500/10 px-2 py-0.5 rounded-full">
																	{t(
																		"match_status_request_expired",
																		"リクエスト期限切れ",
																	)}
																</span>
															</div>
														);
													}
													if (session.matchStatus === "chat_request_declined") {
														return (
															<div className="mt-1 min-h-[24px] flex items-center">
																<span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
																	{t(
																		"match_status_request_declined",
																		"リクエスト辞退",
																	)}
																</span>
															</div>
														);
													}
													return (
														<div className="mt-1 min-h-[24px] flex items-center">
															<p className="text-xs text-muted-foreground truncate line-clamp-1">
																{session.lastMessage}
															</p>
														</div>
													);
												}
												const status = multiStatus.statusMap.get(foxConvId);
												if (status?.status === "completed") {
													return (
														<div className="mt-1 min-h-[24px] flex items-center">
															<span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
																{t("fox_search_completed_badge")}
															</span>
														</div>
													);
												}
												if (status?.status === "failed") {
													return (
														<div className="mt-1 min-h-[24px] flex items-center">
															<span className="text-[10px] font-bold text-red-500">
																{t("fox_search_error")}
															</span>
														</div>
													);
												}
												const current = status?.current_round ?? 0;
												const total = status?.total_rounds ?? 0;
												return (
													<div className="mt-1 min-h-[24px]">
														<div className="h-1 w-full bg-muted rounded-full overflow-hidden">
															<m.div
																initial={{ width: 0 }}
																animate={{
																	width:
																		total > 0
																			? `${(current / total) * 100}%`
																			: "0%",
																}}
																transition={{ duration: 0.5, ease: "easeOut" }}
																className="h-full bg-secondary rounded-full"
															/>
														</div>
														<span className="text-[9px] text-muted-foreground font-bold">
															{current}/{total}
														</span>
													</div>
												);
											})()}
										</div>
									</div>
								</button>
							))
						)}
					</div>
				</div>

				{/* Center Main Chat Area */}
				<div
					className={cn(
						"col-span-12 md:col-span-8 lg:col-span-6 flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden relative min-h-0",
						isMobile && mobileView !== "chat" && "hidden",
					)}
				>
					<div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/50 backdrop-blur-sm shrink-0 z-10">
						<div className="flex items-center gap-3">
							{isMobile && (
								<button
									type="button"
									onClick={() => setMobileView("list")}
									className="p-2 -ml-2 rounded-full hover:bg-accent"
								>
									<ArrowLeft className="w-5 h-5" />
								</button>
							)}
							<div className="flex flex-col">
								<h3 className="font-black text-base uppercase tracking-tight">
									{displaySession.partnerName}
								</h3>
								{isFoxConvLive && (
									<span className="text-[10px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
										<span className="relative flex h-2 w-2">
											<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
											<span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
										</span>
										{t("fox_chat_active")}
									</span>
								)}
							</div>
						</div>
						<div className="flex items-center gap-3">
							{isMobile && (
								<button
									type="button"
									onClick={() => setMobileView("analysis")}
									className="p-2 text-muted-foreground hover:text-secondary transition-colors"
									title={t("analysis")}
								>
									<PieChart className="w-5 h-5" />
								</button>
							)}
							<button
								type="button"
								onClick={async () => {
									if (activeTab === "direct" && directChatRoomId) {
										await directMessages.refetch();
										queryClient.invalidateQueries({
											queryKey: ["direct-chats"],
										});
										toast.success(t("reload_talk"));
									} else if (activeTab === "partner_fox" && partnerFoxChatId) {
										await partnerFoxMessages.refetch();
										toast.success(t("reload_talk"));
									} else if (activeTab === "fox" && foxConversationId) {
										await foxMessages.refetch();
										toast.success(t("reload_talk"));
									}
								}}
								disabled={
									(activeTab === "direct" && directMessages.isRefetching) ||
									(activeTab === "partner_fox" &&
										partnerFoxMessages.isRefetching) ||
									(activeTab === "fox" && foxMessages.isRefetching)
								}
								className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
								title={t("reload_talk")}
							>
								{(activeTab === "direct" && directMessages.isRefetching) ||
								(activeTab === "partner_fox" &&
									partnerFoxMessages.isRefetching) ||
								(activeTab === "fox" && foxMessages.isRefetching) ? (
									<Loader2 className="w-5 h-5 animate-spin" />
								) : (
									<RefreshCw className="w-5 h-5" />
								)}
							</button>
							<button
								type="button"
								onClick={() => setShowUnmatchModal(true)}
								className="p-2 text-muted-foreground hover:text-orange-500 transition-colors"
								title={t("unmatch")}
							>
								<UserX className="w-5 h-5" />
							</button>
							<button
								type="button"
								onClick={() => setShowReportModal(true)}
								className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
							>
								<ShieldAlert className="w-5 h-5" />
							</button>
						</div>
					</div>

					{/* Tab Bar */}
					{(showFoxTab || showPartnerFoxTab || showDirectTab) && (
						<div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background/30 shrink-0">
							{showFoxTab && (
								<button
									type="button"
									onClick={() => setActiveTab("fox")}
									className={cn(
										"px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1.5",
										activeTab === "fox"
											? "bg-secondary text-white"
											: "text-muted-foreground hover:bg-accent",
									)}
								>
									<Bot className="w-3.5 h-3.5" />
									{t("tab_fox_conversation")}
								</button>
							)}
							{showPartnerFoxTab && (
								<button
									type="button"
									onClick={handlePartnerFoxTabClick}
									disabled={createPartnerFoxChat.isPending}
									className={cn(
										"px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1.5",
										activeTab === "partner_fox"
											? "bg-secondary text-white"
											: "text-muted-foreground hover:bg-accent",
									)}
								>
									{createPartnerFoxChat.isPending ? (
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
									) : (
										<MessageCircle className="w-3.5 h-3.5" />
									)}
									{t("tab_partner_fox")}
								</button>
							)}
							{showDirectTab && (
								<button
									type="button"
									onClick={() => setActiveTab("direct")}
									className={cn(
										"px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1.5",
										activeTab === "direct"
											? "bg-secondary text-white"
											: "text-muted-foreground hover:bg-accent",
									)}
								>
									<User className="w-3.5 h-3.5" />
									{t("tab_direct")}
								</button>
							)}
						</div>
					)}

					<div
						ref={chatContainerRef}
						className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 min-h-0"
					>
						{/* Sentinel for loading older messages */}
						<div ref={topSentinelRef} className="h-1" />
						{directMessages.isFetchingNextPage && (
							<div className="flex items-center justify-center py-2">
								<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
							</div>
						)}
						{/* Direct Chat state UI (when no messages yet) */}
						{activeTab === "direct" &&
							!directChatRoomId &&
							(() => {
								// State: Received request (responder side) — check FIRST so we show approve/decline when user received the request
								if (pendingRequestForMatch) {
									return (
										<div className="flex flex-col items-center justify-center py-16 text-center">
											<div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
												<Mail className="w-8 h-8 text-secondary" />
											</div>
											<h3 className="text-lg font-black mb-2">
												{t("direct_chat_request_received_title")}
											</h3>
											<p className="text-sm text-muted-foreground mb-6">
												{t("direct_chat_request_received_description", {
													name: pendingRequestForMatch.requester.nickname,
												})}
											</p>
											<div className="flex gap-3">
												<button
													type="button"
													onClick={async () => {
														try {
															await respondChatRequest.mutateAsync({
																id: pendingRequestForMatch.id,
																action: "accept",
															});
															toast.success(t("direct_chat_accepted"));
															// Refetch match detail so direct_chat_room_id is available and chat UI shows immediately
															await queryClient.refetchQueries({
																queryKey: [
																	"matching",
																	"results",
																	activeSessionId,
																],
															});
														} catch {
															toast.error(t("direct_chat_request_error"));
														}
													}}
													disabled={respondChatRequest.isPending}
													className="px-6 py-2.5 bg-secondary text-white text-[11px] font-black uppercase rounded-full hover:bg-secondary/90 disabled:opacity-50"
												>
													{respondChatRequest.isPending ? (
														<Loader2 className="w-4 h-4 animate-spin" />
													) : (
														t("direct_chat_accept")
													)}
												</button>
												<button
													type="button"
													onClick={async () => {
														try {
															await respondChatRequest.mutateAsync({
																id: pendingRequestForMatch.id,
																action: "decline",
															});
															toast.info(t("direct_chat_declined"));
														} catch {
															toast.error(t("direct_chat_request_error"));
														}
													}}
													disabled={respondChatRequest.isPending}
													className="px-6 py-2.5 border border-border text-[11px] font-black uppercase rounded-full hover:bg-muted disabled:opacity-50"
												>
													{t("direct_chat_decline")}
												</button>
											</div>
										</div>
									);
								}
								// State B: Request already sent (requester side)
								if (
									detail?.chat_request_status === "pending" ||
									detail?.status === "direct_chat_requested"
								) {
									return (
										<div className="flex flex-col items-center justify-center py-16 text-center">
											<div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
												<Clock className="w-8 h-8 text-muted-foreground" />
											</div>
											<h3 className="text-lg font-black mb-2">
												{t("direct_chat_request_sent")}
											</h3>
											<p className="text-sm text-muted-foreground">
												{t("direct_chat_request_pending")}
											</p>
										</div>
									);
								}
								// State A: Can send request
								return (
									<div className="flex flex-col items-center justify-center py-16 text-center">
										<div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
											<MessageCircle className="w-8 h-8 text-secondary" />
										</div>
										<h3 className="text-lg font-black mb-2">
											{t("direct_chat_invite_title")}
										</h3>
										<p className="text-sm text-muted-foreground mb-6">
											{t("direct_chat_invite_description")}
										</p>
										<button
											type="button"
											onClick={async () => {
												try {
													await requestDirectChat.mutateAsync(activeSessionId);
													toast.success(t("direct_chat_request_sent"));
													queryClient.invalidateQueries({
														queryKey: ["matching", "results", activeSessionId],
													});
												} catch {
													toast.error(t("direct_chat_request_error"));
												}
											}}
											disabled={requestDirectChat.isPending}
											className="px-8 py-3 bg-secondary text-white text-[11px] font-black uppercase rounded-full hover:bg-secondary/90 disabled:opacity-50 flex items-center gap-2"
										>
											{requestDirectChat.isPending ? (
												<Loader2 className="w-4 h-4 animate-spin" />
											) : (
												<Send className="w-4 h-4" />
											)}
											{t("direct_chat_request_button")}
										</button>
									</div>
								);
							})()}

						{/* Message list */}
						{displaySession.messages.map((msg) => {
							const isMe =
								msg.senderId === "me" ||
								msg.senderId === "user" ||
								msg.senderId === "my_fox";
							return (
								<m.div
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
											{messageToPlainText(msg.text)}
										</div>
										<span className="text-[10px] text-muted-foreground mt-1 px-1 uppercase font-bold tracking-tighter">
											{msg.senderName} &bull; {formatTime(msg.timestamp)}
										</span>
									</div>
								</m.div>
							);
						})}

						<AnimatePresence>
							{displaySession.suggestion && (
								<m.div
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
											&ldquo;
											{messageToPlainText(displaySession.suggestion.text)}
											&rdquo;
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
								</m.div>
							)}
						</AnimatePresence>
						<div ref={messagesEndRef} />
					</div>

					{activeTab !== "fox" && canSendMessage && (
						<div className="p-6 bg-background/50 border-t border-border backdrop-blur-sm shrink-0">
							<div className="flex items-center gap-2 bg-background border border-border rounded-2xl px-4 py-2 focus-within:border-secondary transition-all">
								<input
									type="text"
									value={inputValue}
									onChange={(e) => setInputValue(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.nativeEvent.isComposing) {
											e.preventDefault();
											handleSendMessage(inputValue);
										}
									}}
									placeholder={
										activeTab === "partner_fox"
											? t("input_placeholder_partner_fox")
											: activeTab === "direct"
												? t("input_placeholder_direct")
												: t("input_placeholder")
									}
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
					)}
				</div>

				{/* Right Info Panel */}
				<div
					className={cn(
						isMobile
							? mobileView === "analysis"
								? "col-span-12 flex flex-col gap-6 min-h-0 overflow-y-auto"
								: "hidden"
							: "hidden lg:col-span-3 lg:flex flex-col gap-6 min-h-0 overflow-y-auto pr-1",
					)}
				>
					{/* Mobile analysis header */}
					{isMobile && mobileView === "analysis" && (
						<div className="flex items-center gap-3 py-2 shrink-0">
							<button
								type="button"
								onClick={() => setMobileView("chat")}
								className="p-2 -ml-2 rounded-full hover:bg-accent"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							<h3 className="font-black text-base uppercase tracking-tight">
								{displaySession.partnerName} — {t("analysis")}
							</h3>
						</div>
					)}
					<div className="bg-card border border-border rounded-2xl p-6 flex flex-col relative overflow-hidden shrink-0">
						<div className="flex items-center justify-between mb-6">
							<span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
								{t("compatibility")}
							</span>
							<Target className="w-3.5 h-3.5 text-secondary/60" />
						</div>
						{displaySession.compatibilityScore != null ? (
							<>
								<div className="flex items-end gap-1.5 mb-2">
									<span className="text-5xl font-black tracking-tighter">
										{displaySession.compatibilityScore}
									</span>
									<span className="text-xs font-black text-secondary uppercase mb-2">
										{t("sync")}
									</span>
								</div>
								<div className="h-1 w-full bg-muted rounded-full overflow-hidden mb-4">
									<m.div
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
							</>
						) : (
							<span className="text-lg font-black text-blue-500 animate-pulse">
								{t("score_measuring")}
							</span>
						)}
					</div>

					{/* Trait Synergy - 6-axis radar chart from fox_feature_scores */}
					<div className="bg-card border border-border rounded-2xl p-6 flex flex-col shrink-0">
						<div className="flex items-center justify-between mb-4">
							<span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
								{t("trait_synergy")}
							</span>
						</div>
						{traitScores ? (
							(() => {
								const peakIdx = traitScores.indexOf(Math.max(...traitScores));
								const avg = Math.round(
									traitScores.reduce((a, b) => a + b, 0) / traitScores.length,
								);
								const angles = TRAIT_AXES.map(
									(_, i) => (360 / TRAIT_AXES.length) * i - 90,
								);
								const labelPositions = angles.map((deg) => {
									const rad = (Math.PI / 180) * deg;
									return {
										x: 50 + 48 * Math.cos(rad),
										y: 50 + 48 * Math.sin(rad),
									};
								});
								return (
									<>
										<div className="relative w-full aspect-square flex items-center justify-center">
											<svg
												viewBox="0 0 100 100"
												className="w-full h-full overflow-visible"
												aria-hidden="true"
											>
												{[0.2, 0.4, 0.6, 0.8, 1.0].map((level) => (
													<polygon
														key={level}
														points={angles
															.map((deg) => {
																const rad = (Math.PI / 180) * deg;
																return `${50 + 40 * level * Math.cos(rad)},${50 + 40 * level * Math.sin(rad)}`;
															})
															.join(" ")}
														className="fill-none stroke-border stroke-[0.5]"
													/>
												))}
												{angles.map((deg) => {
													const rad = (Math.PI / 180) * deg;
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
												<m.polygon
													initial={{ opacity: 0, scale: 0.8 }}
													animate={{ opacity: 1, scale: 1 }}
													points={traitScores
														.map((val, i) => {
															const rad = (Math.PI / 180) * angles[i];
															const dist = (val / 100) * 40;
															return `${50 + dist * Math.cos(rad)},${50 + dist * Math.sin(rad)}`;
														})
														.join(" ")}
													className="fill-secondary/20 stroke-secondary stroke-1"
												/>
												{labelPositions.map((pos, i) => (
													<text
														key={TRAIT_AXES[i].key}
														x={pos.x}
														y={pos.y}
														textAnchor="middle"
														dominantBaseline="central"
														className="fill-muted-foreground font-bold text-[3.5px]"
													>
														{TRAIT_AXES[i].label}
													</text>
												))}
											</svg>
										</div>
										<div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-1">
											<div className="flex flex-col">
												<span className="text-[8px] font-black text-muted-foreground uppercase">
													{t("peak")}
												</span>
												<span className="text-xs font-black truncate">
													{TRAIT_AXES[peakIdx].label}
												</span>
											</div>
											<div className="flex flex-col items-end">
												<span className="text-[8px] font-black text-muted-foreground uppercase">
													{t("avg")}
												</span>
												<span className="text-xs font-black">{avg}%</span>
											</div>
										</div>
									</>
								);
							})()
						) : (
							<div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
								{t("no_trait_data")}
							</div>
						)}
					</div>

					{/* Topic Distribution from DB */}
					<div className="bg-card border border-border rounded-2xl p-6 flex flex-col shrink-0">
						<div className="flex items-center justify-between mb-6">
							<span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
								{t("topic_distribution")}
							</span>
							<PieChart className="w-3.5 h-3.5 text-secondary/60" />
						</div>
						{topicDist ? (
							<div className="flex flex-col gap-5">
								{topicDist.map((topic, i) => (
									<div key={topic.topic} className="flex items-center gap-3">
										<div
											className={cn(
												"w-1.5 h-1.5 rounded-full",
												TOPIC_COLORS[i % TOPIC_COLORS.length],
											)}
										/>
										<div className="flex-1 flex justify-between items-center">
											<span className="text-[10px] font-black uppercase tracking-tight">
												{topic.topic}
											</span>
											<span className="text-[10px] font-black">
												{topic.percentage}%
											</span>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="flex items-center justify-center py-4 text-xs text-muted-foreground text-center">
								{t("topic_pending")}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Report Modal */}
			<AnimatePresence>
				{showReportModal && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
						<m.div
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
						</m.div>
					</div>
				)}
			</AnimatePresence>

			{/* Unmatch Modal */}
			<AnimatePresence>
				{showUnmatchModal && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
						<m.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							className="bg-card w-full max-w-md border border-border rounded-2xl shadow-2xl overflow-hidden"
						>
							<div className="p-8 text-center">
								<div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
									<UserX className="w-8 h-8" />
								</div>
								<h3 className="text-xl font-black mb-2">
									{t("unmatch_title")}
								</h3>
								<p className="text-sm text-muted-foreground">
									{t("unmatch_description")}
								</p>
								<div className="mt-6 space-y-2">
									<button
										type="button"
										onClick={handleUnmatch}
										disabled={blockUser.isPending}
										className="w-full py-3 bg-orange-600 text-white text-[10px] font-black uppercase rounded-full hover:bg-orange-700 disabled:opacity-50"
									>
										{blockUser.isPending ? "..." : t("confirm_unmatch")}
									</button>
									<button
										type="button"
										onClick={() => setShowUnmatchModal(false)}
										className="w-full py-3 text-[10px] font-black uppercase text-muted-foreground hover:text-foreground"
									>
										{t("cancel")}
									</button>
								</div>
							</div>
						</m.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
}
