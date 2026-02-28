import { FoxAvatar } from "@/components/icons/FoxAvatar";
import { useUsers } from "@/lib/hooks/useUsers";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
	Globe,
	Languages,
	LogOut,
	Save,
	Settings as SettingsIcon,
	Trash2,
	User,
} from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
	const { t, i18n } = useTranslation("settings");
	const { users, isLoading, edit, add, remove } = useUsers();

	const [formData, setFormData] = useState({
		id: "",
		display_name: "",
		location: "",
		bio: "",
		age: 0,
		email: "user@example.com",
	});

	const [activeTab, setActiveTab] = useState<"profile" | "account">("profile");

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
				toast.success(t("updated_toast"));
			} else {
				await add({
					id: formData.id,
					display_name: formData.display_name,
					location: formData.location,
					bio: formData.bio,
					age: Number(formData.age),
					created_at: new Date(),
				});
				toast.success(t("created_toast"));
			}
		} catch (error) {
			console.error(error);
			toast.error(t("save_error"));
		}
	};

	const handleDeleteAccount = async () => {
		if (confirm(t("delete_confirm"))) {
			try {
				await remove(formData.id);
				toast.success(t("deleted_toast"));
			} catch (error) {
				toast.error(t("delete_error"));
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
						{t("title")}
					</h1>
					<p className="text-muted-foreground text-sm max-w-lg">
						{t("description")}
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => window.location.reload()}>
						{t("cancel")}
					</Button>
					<Button onClick={handleSave} className="gap-2">
						<Save className="w-4 h-4" />
						{t("save")}
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
							{t("tab_profile")}
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
							{t("tab_account")}
						</button>
					</nav>
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
										title={t("profile_title")}
										description={t("profile_description")}
									/>
									<div className="grid gap-6 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="display_name">{t("display_name")}</Label>
											<Input
												id="display_name"
												value={formData.display_name}
												onChange={(e) =>
													setFormData({
														...formData,
														display_name: e.target.value,
													})
												}
												placeholder={t("display_name_placeholder")}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="location">{t("location")}</Label>
											<Input
												id="location"
												value={formData.location}
												onChange={(e) =>
													setFormData({
														...formData,
														location: e.target.value,
													})
												}
												placeholder={t("location_placeholder")}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="age">{t("age")}</Label>
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
										<Label htmlFor="bio">{t("bio_label")}</Label>
										<Textarea
											id="bio"
											value={formData.bio}
											onChange={(e) =>
												setFormData({
													...formData,
													bio: e.target.value,
												})
											}
											placeholder={t("bio_placeholder")}
											className="min-h-[120px]"
										/>
										<p className="text-[11px] text-muted-foreground text-right">
											{t("bio_count", { count: formData.bio.length })}
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
											{t("change_photo")}
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="text-red-500 hover:text-red-600 hover:bg-red-50"
										>
											{t("delete_photo")}
										</Button>
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
										title={t("account_title")}
										description={t("account_description")}
									/>
									<div className="grid gap-6 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="email">{t("email_label")}</Label>
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
											<Label htmlFor="password">{t("password_label")}</Label>
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
												{t("change_password")}
											</Button>
										</div>
									</div>
								</Card>

								<Card className="p-6">
									<SectionHeader
										icon={Languages}
										title={t("language_title")}
										description={t("language_description")}
									/>
									<div className="space-y-4 mt-4">
										{[
											{
												id: "ja",
												label: t("language_ja"),
											},
											{
												id: "en",
												label: t("language_en"),
											},
										].map((option) => (
											<div
												key={option.id}
												onClick={() => i18n.changeLanguage(option.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter") i18n.changeLanguage(option.id);
												}}
												className={cn(
													"cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all",
													i18n.language === option.id
														? "bg-primary/10 border-primary shadow-sm"
														: "bg-transparent border-transparent hover:bg-accent",
												)}
											>
												<Globe
													className={cn(
														"w-5 h-5",
														i18n.language === option.id
															? "text-primary"
															: "text-muted-foreground",
													)}
												/>
												<p className="text-sm font-medium">{option.label}</p>
											</div>
										))}
									</div>
								</Card>

								<Card className="p-6 border-red-200 bg-red-50/50">
									<div className="flex items-start gap-4">
										<div className="p-2 rounded-xl bg-red-100 text-red-600">
											<Trash2 className="w-5 h-5" />
										</div>
										<div className="flex-1">
											<h3 className="text-lg font-semibold tracking-tight text-red-600">
												{t("danger_zone")}
											</h3>
											<p className="text-sm text-muted-foreground mt-1">
												{t("danger_description")}
											</p>
											<div className="mt-6 flex flex-wrap gap-4">
												<Button
													variant="destructive"
													onClick={handleDeleteAccount}
												>
													{t("delete_account")}
												</Button>
												<Button
													variant="ghost"
													className="text-muted-foreground"
												>
													<LogOut className="w-4 h-4 mr-2" />
													{t("logout")}
												</Button>
											</div>
										</div>
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
