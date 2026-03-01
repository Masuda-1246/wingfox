import { WingfoxLogo } from "@/components/icons/WingfoxLogo";
import { useAuth } from "@/lib/auth";
import { useAuthMe, useMarkNotificationSeen } from "@/lib/hooks/useAuthMe";
import { useChatRequestNotifications } from "@/lib/hooks/useChatRequestNotifications";
import { usePendingChatRequests } from "@/lib/hooks/useChatRequests";
import type { PendingChatRequest } from "@/lib/hooks/useChatRequests";
import { useDirectChatRooms } from "@/lib/hooks/useDirectChats";
import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, m } from "framer-motion";
import {
	Bell,
	ChevronDown,
	LogOut,
	MessageSquare,
	Settings,
	UserCircle2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const CURRENT_USER_PLACEHOLDER = {
	name: "User",
};

function Button({
	className,
	variant = "default",
	size = "default",
	ref,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "default" | "ghost" | "outline" | "secondary";
	size?: "sm" | "default" | "icon";
	ref?: React.Ref<HTMLButtonElement>;
}) {
	const variants = {
		default:
			"bg-primary text-primary-foreground border border-border hover:bg-primary/90",
		secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
		ghost: "hover:bg-accent hover:text-accent-foreground",
		outline:
			"border border-input bg-background hover:bg-accent hover:text-accent-foreground",
	};
	const sizes = {
		default: "h-10 px-4 py-2",
		sm: "h-9 rounded-full px-3",
		icon: "h-10 w-10",
	};

	return (
		<button
			ref={ref}
			className={cn(
				"inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		/>
	);
}

export function UpperHeader() {
	const { t } = useTranslation("common");
	const { t: tNotif } = useTranslation("notification");
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
	const [isNotificationOpen, setIsNotificationOpen] = useState(false);
	const userMenuRef = useRef<HTMLDivElement>(null);
	const notificationRef = useRef<HTMLDivElement>(null);
	const location = useLocation();
	const navigate = useNavigate();
	const { user, signOut } = useAuth();
	const { data: authMe } = useAuthMe({ enabled: Boolean(user) });
	const markNotificationSeen = useMarkNotificationSeen();
	const isAuthenticated = Boolean(user);

	useChatRequestNotifications();
	const { data: pendingRequests = [], refetch: refetchPending } =
		usePendingChatRequests({
			refetchInterval: 15_000,
		});
	const { data: directChatRooms = [], refetch: refetchRooms } =
		useDirectChatRooms({
			refetchInterval: 15_000,
		});
	const pendingCount = pendingRequests.length;
	const roomsWithUnread = directChatRooms.filter(
		(r) => (r.unread_count ?? 0) > 0,
	);
	const notificationSeenAt = authMe?.notification_seen_at ?? null;
	// Unseen = 通知を開いた時刻より後に来たものだけ（DB の notification_seen_at で永続化）
	const unseenPendingCount = notificationSeenAt
		? pendingRequests.filter(
				(r) => new Date(r.created_at) > new Date(notificationSeenAt),
			).length
		: pendingCount;
	const unseenDmCount = directChatRooms.filter(
		(r) => (r.unread_count_after_seen ?? r.unread_count ?? 0) > 0,
	).length;
	const unseenCount = unseenPendingCount + unseenDmCount;
	const totalNotificationCount = pendingCount + roomsWithUnread.length;

	// 通知を開いた時点で DB に「確認した」を記録し、バッジを消す（リロードしても復活しない）
	// biome-ignore lint/correctness/useExhaustiveDependencies: 開いた瞬間だけ mark したいので isNotificationOpen のみ依存
	useEffect(() => {
		if (isNotificationOpen) {
			markNotificationSeen.mutate(undefined, {
				onSettled: () => {
					void refetchPending();
					void refetchRooms();
				},
			});
		}
	}, [isNotificationOpen]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				userMenuRef.current &&
				!userMenuRef.current.contains(event.target as Node)
			) {
				setIsUserMenuOpen(false);
			}
			if (
				notificationRef.current &&
				!notificationRef.current.contains(event.target as Node)
			) {
				setIsNotificationOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSignOut = async () => {
		await signOut();
		setIsUserMenuOpen(false);
		toast.success(t("signed_out_success"));
		navigate({ to: "/login" });
	};

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
			<div className="flex h-16 items-center px-4 sm:px-8 gap-4 max-w-[1920px] mx-auto">
				<div className="flex items-center gap-2 mr-4 shrink-0">
					<Link to="/chat" className="flex items-center gap-2 group">
						<WingfoxLogo className="w-8 h-8 group-hover:scale-105 transition-transform duration-300" />
						<span className="font-black text-lg tracking-tight hidden sm:inline-block">
							Wing<span className="text-secondary">Fox</span>
						</span>
					</Link>
				</div>

				<div className="flex items-center gap-2 shrink-0 ml-auto">
					{isAuthenticated ? (
						<>
							<div className="relative" ref={notificationRef}>
								<Button
									variant="ghost"
									size="icon"
									className="relative text-muted-foreground hover:text-foreground"
									onClick={() => setIsNotificationOpen(!isNotificationOpen)}
									aria-label={tNotif("dm_requests_section")}
								>
									<Bell className="w-5 h-5" />
									{unseenCount > 0 && (
										<span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
											{unseenCount > 99 ? "99+" : unseenCount}
										</span>
									)}
								</Button>

								<AnimatePresence>
									{isNotificationOpen && (
										<m.div
											initial={{ opacity: 0, y: 8, scale: 0.98 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: 8, scale: 0.98 }}
											transition={{ duration: 0.1, ease: "easeOut" }}
											className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card p-1.5 text-card-foreground"
										>
											{/* DM requests */}
											<div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
												{tNotif("dm_requests_section")}
											</div>
											{pendingCount === 0 ? (
												<div className="px-3 py-2 text-center text-xs text-muted-foreground">
													—
												</div>
											) : (
												<ul className="max-h-40 space-y-0.5 overflow-y-auto">
													{pendingRequests.map((r: PendingChatRequest) => (
														<li key={r.id}>
															<Link
																to="/chat"
																search={{ match_id: r.match_id }}
																className="flex flex-col gap-0.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
																onClick={() => setIsNotificationOpen(false)}
															>
																<span className="font-medium">
																	{tNotif("dm_request_from", {
																		name: r.requester.nickname ?? "",
																	})}
																</span>
																<span className="text-xs text-muted-foreground">
																	{tNotif("go_to_chat")}
																</span>
															</Link>
														</li>
													))}
												</ul>
											)}

											{/* New messages (unread DMs) */}
											{roomsWithUnread.length > 0 && (
												<>
													<div className="mt-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
														{tNotif("dm_messages_section")}
													</div>
													<ul className="max-h-40 space-y-0.5 overflow-y-auto">
														{roomsWithUnread.map((room) => (
															<li key={room.id}>
																<Link
																	to="/chat"
																	search={{ match_id: room.match_id }}
																	className="flex flex-col gap-0.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
																	onClick={() => setIsNotificationOpen(false)}
																>
																	<span className="font-medium">
																		{tNotif("dm_message_from_in_list", {
																			name: room.partner?.nickname ?? "",
																		})}
																	</span>
																	<span className="text-xs text-muted-foreground">
																		{tNotif("go_to_chat")}
																	</span>
																</Link>
															</li>
														))}
													</ul>
												</>
											)}

											{totalNotificationCount === 0 && (
												<div className="px-3 py-4 text-center text-sm text-muted-foreground">
													{tNotif("notifications_empty")}
												</div>
											)}
										</m.div>
									)}
								</AnimatePresence>
							</div>

							<div className="relative ml-2" ref={userMenuRef}>
								<button
									type="button"
									onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
									className="flex items-center gap-2 px-3 py-2 rounded-full border border-border hover:bg-accent transition-colors outline-none"
								>
									<span className="text-xs font-bold truncate max-w-[120px] sm:max-w-[180px]">
										{authMe?.nickname?.trim() ||
											user?.user_metadata?.display_name ||
											CURRENT_USER_PLACEHOLDER.name}
									</span>
									<ChevronDown
										className={cn(
											"w-3 h-3 text-muted-foreground transition-transform shrink-0",
											isUserMenuOpen && "rotate-180",
										)}
									/>
								</button>

								<AnimatePresence>
									{isUserMenuOpen && (
										<m.div
											initial={{ opacity: 0, y: 8, scale: 0.98 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: 8, scale: 0.98 }}
											transition={{ duration: 0.1, ease: "easeOut" }}
											className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-border bg-card text-card-foreground z-50 overflow-hidden p-1.5"
										>
											<div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
												{t("navigation")}
											</div>

											<Link
												to="/personas/me"
												className={cn(
													"flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
													location.pathname === "/personas/me"
														? "bg-secondary text-secondary-foreground"
														: "hover:bg-accent",
												)}
												onClick={() => setIsUserMenuOpen(false)}
											>
												<UserCircle2 className="h-4 w-4 shrink-0" />
												<span className="font-medium">{t("my_persona")}</span>
											</Link>

											<Link
												to="/chat"
												className={cn(
													"flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
													location.pathname === "/chat"
														? "bg-secondary text-secondary-foreground"
														: "hover:bg-accent",
												)}
												onClick={() => setIsUserMenuOpen(false)}
											>
												<MessageSquare className="h-4 w-4 shrink-0" />
												<span className="font-medium">{t("chat")}</span>
											</Link>

											<div className="h-px bg-border my-1.5 mx-2" />

											<div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
												{t("system")}
											</div>

											<Link
												to="/settings"
												className={cn(
													"flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
													location.pathname === "/settings"
														? "bg-secondary text-secondary-foreground"
														: "hover:bg-accent",
												)}
												onClick={() => setIsUserMenuOpen(false)}
											>
												<Settings className="h-4 w-4 shrink-0" />
												<span className="font-medium">{t("settings")}</span>
											</Link>

											<div className="h-px bg-border my-1.5 mx-2" />

											<button
												type="button"
												className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
												onClick={handleSignOut}
											>
												<LogOut className="h-4 w-4 shrink-0" />
												<span className="font-medium uppercase tracking-tight">
													{t("sign_out")}
												</span>
											</button>
										</m.div>
									)}
								</AnimatePresence>
							</div>
						</>
					) : (
						<Link to="/login">
							<Button variant="secondary" size="sm" className="font-bold px-6">
								{t("log_in")}
							</Button>
						</Link>
					)}
				</div>
			</div>
		</header>
	);
}
