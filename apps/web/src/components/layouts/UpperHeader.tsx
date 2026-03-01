import { WingfoxLogo } from "@/components/icons/WingfoxLogo";
import { useAuth } from "@/lib/auth";
import { useAuthMe } from "@/lib/hooks/useAuthMe";
import { useDailyMatchResults } from "@/lib/hooks/useDailyMatchResults";
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
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
	const userMenuRef = useRef<HTMLDivElement>(null);
	const location = useLocation();
	const navigate = useNavigate();
	const { user, signOut } = useAuth();
	const { data: authMe } = useAuthMe({ enabled: Boolean(user) });
	const { data: dailyResults } = useDailyMatchResults({
		enabled: Boolean(user),
	});
	const hasNewDailyMatch = dailyResults?.is_new ?? false;
	const isAuthenticated = Boolean(user);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				userMenuRef.current &&
				!userMenuRef.current.contains(event.target as Node)
			) {
				setIsUserMenuOpen(false);
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
							<div className="relative">
								<Button
									variant="ghost"
									size="icon"
									className="relative text-muted-foreground hover:text-foreground"
								>
									<Bell className="w-5 h-5" />
									{hasNewDailyMatch && (
										<span className="absolute top-2.5 right-2.5 flex h-2 w-2">
											<span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
										</span>
									)}
								</Button>
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
