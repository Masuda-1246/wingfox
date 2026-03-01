import { FoxAvatar } from "@/components/icons/FoxAvatar";
import {
	useDailyMatchResults,
	useMarkDailyResultsSeen,
} from "@/lib/hooks/useDailyMatchResults";
import type { DailyMatchItem } from "@/lib/hooks/useDailyMatchResults";
import { useRetryFoxConversation } from "@/lib/hooks/useFoxSearch";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";
import { Inbox, Loader2, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface DailyMatchBannerProps {
	onMatchSelect: (matchId: string, foxConversationId: string | null) => void;
}

const getTopTopic = (match: DailyMatchItem): string | null => {
	const dist = match.score_details?.conversation_analysis?.topic_distribution;
	if (!dist || dist.length === 0) return null;
	return [...dist].sort((a, b) => b.percentage - a.percentage)[0].topic;
};

export function DailyMatchBanner({ onMatchSelect }: DailyMatchBannerProps) {
	const { t } = useTranslation("chat");
	const { data, isLoading } = useDailyMatchResults();
	const markSeen = useMarkDailyResultsSeen();
	const retryFoxConversation = useRetryFoxConversation();
	const queryClient = useQueryClient();

	const handleRetry = async (matchId: string) => {
		try {
			await retryFoxConversation.mutateAsync(matchId);
			queryClient.invalidateQueries({
				queryKey: ["matching", "daily-results"],
			});
			toast.success(t("fox_retry_started"));
		} catch (e) {
			console.error(e);
			toast.error(t("fox_retry_error"));
		}
	};

	if (isLoading || !data) return null;

	// バッチが存在しない場合は非表示
	if (!data.batch_status) return null;

	// 既読済みかつ新規でない場合は非表示
	if (!data.is_new && data.batch_status === "completed") return null;

	const isInProgress =
		data.batch_status === "matching" ||
		data.batch_status === "conversations_running";
	const isCompleted = data.batch_status === "completed";
	const hasMatches = data.matches.length > 0;

	const handleDismiss = () => {
		markSeen.mutate(undefined);
	};

	return (
		<m.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			className="mb-3 shrink-0 rounded-2xl border border-secondary/30 bg-secondary/5 p-3"
		>
			{/* ヘッダー */}
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-1.5 text-sm font-bold">
					{isInProgress ? (
						<Loader2 className="w-4 h-4 animate-spin text-secondary" />
					) : hasMatches ? (
						<Sparkles className="w-4 h-4 text-secondary" />
					) : (
						<Inbox className="w-4 h-4 text-muted-foreground" />
					)}
					<span>
						{hasMatches || isInProgress
							? t("daily_match_title")
							: t("daily_match_no_results")}
					</span>
				</div>
				{(isCompleted || (!isInProgress && !hasMatches)) && (
					<button
						type="button"
						onClick={handleDismiss}
						className="p-0.5 rounded-full hover:bg-muted transition-colors"
						disabled={markSeen.isPending}
					>
						<X className="w-3.5 h-3.5 text-muted-foreground" />
					</button>
				)}
			</div>

			{/* 進行中メッセージ */}
			{isInProgress && (
				<p className="text-[10px] font-bold text-muted-foreground mb-1">
					{t("daily_match_in_progress")}
				</p>
			)}

			{/* マッチ一覧 */}
			{hasMatches && (
				<div className="space-y-1.5">
					{data.matches.map((match: DailyMatchItem) => (
						<button
							key={match.id}
							type="button"
							onClick={() => onMatchSelect(match.id, match.fox_conversation_id)}
							className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-secondary/10 transition-colors text-left"
						>
							<FoxAvatar
								iconUrl={
									match.partner?.persona_icon_url ?? match.partner?.avatar_url
								}
								className="w-8 h-8 rounded-full object-cover shrink-0"
							/>
							<div className="flex-1 min-w-0">
								<span className="text-xs font-bold truncate block">
									{match.partner?.nickname ?? "マッチ"}
								</span>
								{match.status === "fox_conversation_in_progress" ? (
									<span className="text-[10px] text-muted-foreground">
										{t("score_measuring")}
									</span>
								) : match.status === "fox_conversation_failed" ? (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											handleRetry(match.id);
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
								) : match.status === "fox_conversation_completed" ? (
									(() => {
										const topTopic = getTopTopic(match);
										return topTopic ? (
											<span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
												{topTopic}
											</span>
										) : null;
									})()
								) : null}
							</div>
							{match.final_score != null && (
								<div className="text-xs font-black text-secondary shrink-0">
									{Math.round(match.final_score)}%
								</div>
							)}
							{match.status === "fox_conversation_in_progress" && (
								<div className="animate-spin rounded-full h-3 w-3 border border-secondary border-t-transparent shrink-0" />
							)}
						</button>
					))}
				</div>
			)}

			{/* 詳細を見るボタン */}
			{isCompleted && hasMatches && (
				<button
					type="button"
					onClick={handleDismiss}
					className="w-full mt-2 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors text-center"
				>
					{t("daily_match_dismiss")}
				</button>
			)}
		</m.div>
	);
}
