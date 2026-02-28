import { FoxAvatar } from "@/components/icons/FoxAvatar";
import { useUsers } from "@/lib/hooks/useUsers";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
	Bell,
	Clock,
	Eye,
	Globe,
	Lock,
	LogOut,
	Save,
	Settings as SettingsIcon,
	Shield,
	Smartphone,
	Trash2,
	User,
} from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { toast } from "sonner";

function Card({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"rounded-2xl border border-border bg-card text-card-foreground overflow-hidden",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

function Button({
	className,
	variant = "primary",
	size = "default",
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "destructive" | "ghost" | "outline";
	size?: "default" | "sm" | "icon";
}) {
	const variants = {
		primary: "bg-primary text-primary-foreground hover:opacity-90",
		secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
		destructive: "bg-red-500 text-white hover:bg-red-600",
		ghost: "hover:bg-accent hover:text-accent-foreground",
		outline: "border border-input hover:bg-accent hover:text-accent-foreground",
	};
	const sizes = {
		default: "h-10 px-4 py-2",
		sm: "h-9 rounded-md px-3",
		icon: "h-10 w-10 flex items-center justify-center",
	};

	return (
		<button
			type="button"
			className={cn(
				"inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		/>
	);
}

const Input = forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
	return (
		<input
			className={cn(
				"flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Input.displayName = "Input";

function Label({
	className,
	children,
	...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via spread props
		<label
			className={cn(
				"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				className,
			)}
			{...props}
		>
			{children}
		</label>
	);
}

const Textarea = forwardRef<
	HTMLTextAreaElement,
	React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
	return (
		<textarea
			className={cn(
				"flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Textarea.displayName = "Textarea";

function Switch({
	checked,
	onCheckedChange,
}: { checked: boolean; onCheckedChange: (checked: boolean) => void }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onCheckedChange(!checked)}
			className={cn(
				"peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
				checked ? "bg-primary" : "bg-input",
			)}
		>
			<span
				className={cn(
					"pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
					checked ? "translate-x-5" : "translate-x-0",
				)}
			/>
		</button>
	);
}

function SectionHeader({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
}) {
	return (
		<div className="flex items-start gap-4 mb-6">
			<div className="p-2 rounded-xl bg-accent/50 text-foreground">
				<Icon className="w-5 h-5" />
			</div>
			<div>
				<h3 className="text-lg font-semibold tracking-tight">{title}</h3>
				<p className="text-sm text-muted-foreground mt-1">{description}</p>
			</div>
		</div>
	);
}

export function Settings() {
	const { users, isLoading, edit, add, remove } = useUsers();

	const [formData, setFormData] = useState({
		id: "",
		display_name: "",
		location: "",
		bio: "",
		age: 0,
		email: "user@example.com",
		notifications_email: true,
		notifications_push: true,
		privacy_persona_visible: "public",
		privacy_log_retention: "forever",
	});

	const [activeTab, setActiveTab] = useState<"profile" | "account" | "privacy">(
		"profile",
	);

	useEffect(() => {
		if (!isLoading) {
			if (users && users.length > 0) {
				const user = users[0];
				setFormData((prev) => ({
					...prev,
					id: user.id,
					display_name: user.display_name,
					location: user.location || "",
					bio: user.bio || "",
					age: user.age || 0,
				}));
			} else {
				setFormData((prev) => ({
					...prev,
					id: crypto.randomUUID(),
					display_name: "New User",
				}));
			}
		}
	}, [users, isLoading]);

	const handleSave = async () => {
		try {
			if (users.length > 0) {
				await edit(formData.id, {
					display_name: formData.display_name,
					location: formData.location,
					bio: formData.bio,
					age: Number(formData.age),
				});
				toast.success("設定を更新しました");
			} else {
				await add({
					id: formData.id,
					display_name: formData.display_name,
					location: formData.location,
					bio: formData.bio,
					age: Number(formData.age),
					created_at: new Date(),
				});
				toast.success("アカウントを作成しました");
			}
		} catch (error) {
			console.error(error);
			toast.error("保存中にエラーが発生しました");
		}
	};

	const handleDeleteAccount = async () => {
		if (confirm("本当にアカウントを削除しますか？この操作は取り消せません。")) {
			try {
				await remove(formData.id);
				toast.success("アカウントを削除しました");
			} catch (error) {
				toast.error("削除に失敗しました");
			}
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1 className="text-3xl font-black tracking-tighter sm:text-4xl mb-2">
						Settings
					</h1>
					<p className="text-muted-foreground text-sm max-w-lg">
						アカウント情報、通知設定、およびプライバシーとセキュリティを管理します。
						ここでの設定はAIペルソナのマッチング精度に影響します。
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => window.location.reload()}>
						キャンセル
					</Button>
					<Button onClick={handleSave} className="gap-2">
						<Save className="w-4 h-4" />
						変更を保存
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
				<Card className="col-span-1 md:col-span-3 h-fit p-2 sticky top-6">
					<nav className="flex flex-col gap-1">
						<button
							type="button"
							onClick={() => setActiveTab("profile")}
							className={cn(
								"flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all",
								activeTab === "profile"
									? "bg-primary text-primary-foreground"
									: "hover:bg-accent text-muted-foreground hover:text-foreground",
							)}
						>
							<User className="w-4 h-4" />
							プロフィール
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("account")}
							className={cn(
								"flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all",
								activeTab === "account"
									? "bg-primary text-primary-foreground"
									: "hover:bg-accent text-muted-foreground hover:text-foreground",
							)}
						>
							<SettingsIcon className="w-4 h-4" />
							アカウント設定
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("privacy")}
							className={cn(
								"flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all",
								activeTab === "privacy"
									? "bg-primary text-primary-foreground"
									: "hover:bg-accent text-muted-foreground hover:text-foreground",
							)}
						>
							<Shield className="w-4 h-4" />
							プライバシー & 通知
						</button>
					</nav>

					<div className="mt-6 px-4 pb-4">
						<div className="p-4 rounded-xl bg-accent/30 border border-accent">
							<p className="text-xs font-medium text-muted-foreground mb-2">
								ストレージ使用状況
							</p>
							<div className="h-2 w-full bg-background rounded-full overflow-hidden">
								<div className="h-full bg-secondary w-[45%]" />
							</div>
							<p className="text-[10px] text-muted-foreground mt-2 text-right">
								45% 使用中
							</p>
						</div>
					</div>
				</Card>

				<div className="col-span-1 md:col-span-9 space-y-6">
					<AnimatePresence mode="wait">
						{activeTab === "profile" && (
							<motion.div
								key="profile"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.2 }}
								className="grid grid-cols-1 md:grid-cols-2 gap-6"
							>
								<Card className="col-span-1 md:col-span-2 p-6">
									<SectionHeader
										icon={User}
										title="基本プロフィール"
										description="マッチング時に他のユーザーに表示される情報です。"
									/>
									<div className="grid gap-6 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="display_name">表示名</Label>
											<Input
												id="display_name"
												value={formData.display_name}
												onChange={(e) =>
													setFormData({
														...formData,
														display_name: e.target.value,
													})
												}
												placeholder="例: Alex Foxx"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="location">居住地</Label>
											<Input
												id="location"
												value={formData.location}
												onChange={(e) =>
													setFormData({
														...formData,
														location: e.target.value,
													})
												}
												placeholder="例: Tokyo, Japan"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="age">年齢</Label>
											<Input
												id="age"
												type="number"
												value={formData.age}
												onChange={(e) =>
													setFormData({
														...formData,
														age: Number(e.target.value),
													})
												}
												placeholder="25"
											/>
										</div>
									</div>
									<div className="space-y-2 mt-6">
										<Label htmlFor="bio">自己紹介 (Bio)</Label>
										<Textarea
											id="bio"
											value={formData.bio}
											onChange={(e) =>
												setFormData({
													...formData,
													bio: e.target.value,
												})
											}
											placeholder="あなたの趣味や興味について教えてください..."
											className="min-h-[120px]"
										/>
										<p className="text-[11px] text-muted-foreground text-right">
											{formData.bio.length} / 500 文字
										</p>
									</div>
								</Card>

								<Card className="col-span-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
									<div className="relative">
										<div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background shadow-xl ring-2 ring-border">
											<FoxAvatar
												variant={4}
												className="w-full h-full"
											/>
										</div>
										<button
											type="button"
											className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors shadow-sm"
										>
											<SettingsIcon className="w-4 h-4" />
										</button>
									</div>
									<div>
										<h3 className="font-semibold text-lg">
											{formData.display_name || "No Name"}
										</h3>
										<p className="text-sm text-muted-foreground">
											@{formData.id.slice(0, 8)}...
										</p>
									</div>
									<div className="flex gap-2">
										<Button variant="outline" size="sm">
											写真を変更
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="text-red-500 hover:text-red-600 hover:bg-red-50"
										>
											削除
										</Button>
									</div>
								</Card>

								<Card className="col-span-1 p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
									<SectionHeader
										icon={Globe}
										title="公開ステータス"
										description="あなたのプロフィールは現在公開されています。"
									/>
									<div className="flex items-center justify-between mt-4 bg-background/50 p-4 rounded-xl border border-border">
										<div className="flex items-center gap-3">
											<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
											<span className="text-sm font-medium">Active Now</span>
										</div>
										<Switch checked={true} onCheckedChange={() => {}} />
									</div>
								</Card>
							</motion.div>
						)}

						{activeTab === "account" && (
							<motion.div
								key="account"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.2 }}
								className="space-y-6"
							>
								<Card className="p-6">
									<SectionHeader
										icon={SettingsIcon}
										title="アカウント設定"
										description="ログイン情報や連絡先を管理します。"
									/>
									<div className="grid gap-6 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="email">メールアドレス</Label>
											<Input
												id="email"
												type="email"
												value={formData.email}
												onChange={(e) =>
													setFormData({
														...formData,
														email: e.target.value,
													})
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="password">パスワード</Label>
											<Input
												id="password"
												type="password"
												value="********"
												disabled
												className="bg-accent/50"
											/>
											<Button
												variant="outline"
												size="sm"
												className="w-full mt-2"
											>
												パスワードを変更
											</Button>
										</div>
									</div>
								</Card>

								<Card className="p-6 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10">
									<div className="flex items-start gap-4">
										<div className="p-2 rounded-xl bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
											<Trash2 className="w-5 h-5" />
										</div>
										<div className="flex-1">
											<h3 className="text-lg font-semibold tracking-tight text-red-600 dark:text-red-400">
												Danger Zone
											</h3>
											<p className="text-sm text-muted-foreground mt-1">
												アカウントを削除すると、全てのペルソナ、チャット履歴、マッチングデータが永久に削除されます。
											</p>
											<div className="mt-6 flex flex-wrap gap-4">
												<Button
													variant="destructive"
													onClick={handleDeleteAccount}
												>
													アカウントを削除する
												</Button>
												<Button
													variant="ghost"
													className="text-muted-foreground"
												>
													<LogOut className="w-4 h-4 mr-2" />
													ログアウト
												</Button>
											</div>
										</div>
									</div>
								</Card>
							</motion.div>
						)}

						{activeTab === "privacy" && (
							<motion.div
								key="privacy"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.2 }}
								className="grid grid-cols-1 md:grid-cols-2 gap-6"
							>
								<Card className="col-span-1 md:col-span-2 p-6">
									<SectionHeader
										icon={Bell}
										title="通知設定"
										description="受け取る通知の種類をカスタマイズします。"
									/>
									<div className="space-y-4">
										<div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 transition-colors">
											<div className="space-y-0.5">
												<Label className="text-base">メール通知</Label>
												<p className="text-sm text-muted-foreground">
													マッチングや重要なお知らせをメールで受け取る
												</p>
											</div>
											<Switch
												checked={formData.notifications_email}
												onCheckedChange={(c) =>
													setFormData({
														...formData,
														notifications_email: c,
													})
												}
											/>
										</div>
										<div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 transition-colors">
											<div className="space-y-0.5">
												<Label className="text-base">プッシュ通知</Label>
												<p className="text-sm text-muted-foreground">
													ブラウザでのデスクトップ通知を有効にする
												</p>
											</div>
											<Switch
												checked={formData.notifications_push}
												onCheckedChange={(c) =>
													setFormData({
														...formData,
														notifications_push: c,
													})
												}
											/>
										</div>
									</div>
								</Card>

								<Card className="col-span-1 p-6">
									<SectionHeader
										icon={Eye}
										title="公開範囲"
										description="ペルソナAIを誰に見せるか設定します。"
									/>
									<div className="space-y-4 mt-4">
										{[
											{
												id: "public",
												label: "全体公開",
												desc: "全てのユーザーが閲覧可能",
												icon: Globe,
											},
											{
												id: "match",
												label: "マッチのみ",
												desc: "相性の良い相手にのみ表示",
												icon: Smartphone,
											},
											{
												id: "private",
												label: "非公開",
												desc: "自分だけが閲覧可能",
												icon: Lock,
											},
										].map((option) => (
											<div
												key={option.id}
												onClick={() =>
													setFormData({
														...formData,
														privacy_persona_visible: option.id,
													})
												}
												onKeyDown={(e) => {
													if (e.key === "Enter")
														setFormData({
															...formData,
															privacy_persona_visible: option.id,
														});
												}}
												className={cn(
													"cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all",
													formData.privacy_persona_visible === option.id
														? "bg-primary/10 border-primary shadow-sm"
														: "bg-transparent border-transparent hover:bg-accent",
												)}
											>
												<option.icon
													className={cn(
														"w-5 h-5",
														formData.privacy_persona_visible === option.id
															? "text-primary"
															: "text-muted-foreground",
													)}
												/>
												<div>
													<p className="text-sm font-medium">{option.label}</p>
													<p className="text-xs text-muted-foreground">
														{option.desc}
													</p>
												</div>
											</div>
										))}
									</div>
								</Card>

								<Card className="col-span-1 p-6">
									<SectionHeader
										icon={Clock}
										title="データ保持期間"
										description="会話ログの保存期間を設定します。"
									/>
									<div className="space-y-4 mt-4">
										<div className="p-4 rounded-xl bg-accent/20 border border-border">
											<div className="flex justify-between items-center mb-2">
												<span className="text-sm font-medium">保存期間</span>
												<span className="text-sm text-primary font-bold">
													無期限
												</span>
											</div>
											<input
												type="range"
												className="w-full h-2 bg-secondary/30 rounded-lg appearance-none cursor-pointer accent-secondary"
												min="0"
												max="100"
											/>
											<p className="text-xs text-muted-foreground mt-2">
												現在、全ての会話ログが無期限に保存されています。これにより、AIの学習精度が向上します。
											</p>
										</div>
										<Button variant="outline" className="w-full text-xs">
											ログデータをダウンロード
										</Button>
									</div>
								</Card>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}
