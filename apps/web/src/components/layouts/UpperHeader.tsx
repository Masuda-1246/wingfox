import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	Bell,
	ChevronDown,
	HelpCircle,
	LogOut,
	MessageSquare,
	Search,
	Settings,
	UserCircle2,
} from "lucide-react";
import { FoxAvatar } from "@/components/icons/FoxAvatar";
import { WingfoxLogo } from "@/components/icons/WingfoxLogo";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const CURRENT_USER_PLACEHOLDER = {
	name: "User",
	avatar: "https://picsum.photos/200/300",
	email: "",
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
	const [isSearchFocused, setIsSearchFocused] = useState(false);
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
	const userMenuRef = useRef<HTMLDivElement>(null);
	const location = useLocation();
	const navigate = useNavigate();
	const { user, signOut } = useAuth();
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
						<div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
							<WingfoxLogo className="w-8 h-8" />
						</div>
						<span className="font-black text-lg tracking-tight hidden sm:inline-block">
							Wing<span className="text-secondary">Fox</span>
						</span>
					</Link>
				</div>

				<div className="flex-1 flex justify-center max-w-2xl mx-auto">
					<div
						className={cn(
							"relative w-full transition-all duration-300 ease-out",
							isSearchFocused ? "scale-[1.01]" : "scale-100",
						)}
					>
						<div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
							<Search className="w-4 h-4" />
						</div>
						<input
							type="text"
							placeholder={t("search_placeholder")}
							className={cn(
								"flex h-10 w-full rounded-full border border-input bg-muted/30 px-10 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none transition-all",
								isSearchFocused && "bg-background border-secondary/50",
							)}
							onFocus={() => setIsSearchFocused(true)}
							onBlur={() => setIsSearchFocused(false)}
						/>
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					{isAuthenticated ? (
						<>
							<div className="relative">
								<Button
									variant="ghost"
									size="icon"
									className="relative text-muted-foreground hover:text-foreground"
								>
									<Bell className="w-5 h-5" />
									<span className="absolute top-2.5 right-2.5 flex h-2 w-2">
										<span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
									</span>
								</Button>
							</div>

							<div className="relative ml-2" ref={userMenuRef}>
								<button
									type="button"
									onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
									className="flex items-center gap-2 p-1 pl-2 pr-1 rounded-full border border-border hover:bg-accent transition-colors outline-none"
								>
									<span className="text-xs font-bold hidden md:block px-1 truncate">
										{user?.user_metadata?.display_name ?? user?.email ?? CURRENT_USER_PLACEHOLDER.name}
									</span>
									<div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-muted">
										<img
											src={user?.user_metadata?.avatar_url ?? CURRENT_USER_PLACEHOLDER.avatar}
											alt="User"
											className="w-full h-full object-cover"
										/>
									</div>
									<ChevronDown
										className={cn(
											"w-3 h-3 text-muted-foreground transition-transform",
											isUserMenuOpen && "rotate-180",
										)}
									/>
								</button>

								<AnimatePresence>
									{isUserMenuOpen && (
										<motion.div
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
										</motion.div>
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
