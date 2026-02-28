import { FoxAvatar } from "@/components/icons/FoxAvatar";
import { formatDateTime } from "@/lib/date";
import {
	usePersonasList,
	usePersona,
	usePersonaSections,
	useUpdatePersonaSection,
} from "@/lib/hooks/usePersonasApi";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowRight,
	Edit2,
	Fingerprint,
	Loader2,
	MessageSquare,
	RefreshCw,
	Save,
	Sparkles,
	Tag,
	User,
	Zap,
} from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const Button = forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: "primary" | "secondary" | "outline" | "ghost";
	}
>(({ className, variant = "primary", ...props }, ref) => {
	const variants = {
		primary:
			"bg-primary text-primary-foreground hover:bg-primary/90 border-transparent",
		secondary:
			"bg-secondary text-secondary-foreground hover:bg-secondary/90 border-transparent",
		outline:
			"bg-transparent border border-border hover:bg-accent hover:text-accent-foreground",
		ghost:
			"bg-transparent border-transparent hover:bg-accent hover:text-accent-foreground",
	};
	return (
		<button
			ref={ref}
			className={cn(
				"inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-6 py-2",
				variants[variant],
				className,
			)}
			{...props}
		/>
	);
});
Button.displayName = "Button";

const Input = forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
	return (
		<input
			className={cn(
				"flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Input.displayName = "Input";

const Textarea = forwardRef<
	HTMLTextAreaElement,
	React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
	return (
		<textarea
			className={cn(
				"flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Textarea.displayName = "Textarea";

function Card({
	className,
	children,
}: { className?: string; children: React.ReactNode }) {
	return (
		<div
			className={cn(
				"rounded-2xl border border-border bg-card text-card-foreground overflow-hidden",
				className,
			)}
		>
			{children}
		</div>
	);
}

function Badge({
	children,
	className,
}: { children: React.ReactNode; className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
				className,
			)}
		>
			{children}
		</span>
	);
}

export function PersonasMe() {
	const { t } = useTranslation("personas");
	const { data: personasList, isLoading } = usePersonasList("wingfox");
	const myPersona = personasList && personasList.length > 0 ? personasList[0] : null;
	const { data: personaDetail } = usePersona(myPersona?.id);
	const { data: sections } = usePersonaSections(myPersona?.id);
	const updateSection = useUpdatePersonaSection(myPersona?.id ?? null, "core_identity");
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		profile_text: "",
	});

	useEffect(() => {
		if (myPersona) {
			setFormData({
				name: myPersona.name,
				profile_text:
					sections?.find((s) => s.section_id === "core_identity")?.content ?? "",
			});
		}
	}, [myPersona, sections]);

	const handleSave = async () => {
		if (!myPersona) return;
		try {
			await updateSection.mutateAsync(formData.profile_text);
			setIsEditing(false);
			toast.success(t("me.updated_toast"));
		} catch (error) {
			console.error(error);
			toast.error(t("me.update_error"));
		}
	};

	if (isLoading) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!myPersona) {
		return (
			<div className="p-4 md:p-6 w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
				<p className="text-muted-foreground">{t("me.no_persona_title")}</p>
				<Link to="/onboarding/quiz">
					<Button variant="secondary" className="text-sm">
						<Sparkles className="w-4 h-4 mr-2" />
						{t("me.start_speed_date")}
					</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-8 pb-20">
			<header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">{t("me.title")}</h1>
					<p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
						<RefreshCw className="w-3 h-3" />
						{t("me.last_updated", {
							date: myPersona.updated_at
								? formatDateTime(new Date(myPersona.updated_at))
								: "—",
						})}
					</p>
				</div>

				<div className="flex items-center gap-2">
					{isEditing ? (
						<div className="flex items-center gap-2">
							<Button variant="ghost" onClick={() => setIsEditing(false)}>
								{t("me.cancel")}
							</Button>
							<Button onClick={handleSave} variant="primary">
								<Save className="w-4 h-4 mr-2" />
								{t("me.save")}
							</Button>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<Button variant="outline" onClick={() => setIsEditing(true)}>
								<Edit2 className="w-4 h-4 mr-2" />
								{t("me.edit")}
							</Button>
							<Link to="/onboarding/speed-dating">
								<Button variant="outline">
									<RefreshCw className="w-4 h-4 mr-2" />
									{t("me.regenerate")}
								</Button>
							</Link>
						</div>
					)}
				</div>
			</header>

			<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
				<Card className="col-span-1 md:col-span-4 p-6 flex flex-col items-center text-center space-y-6 relative group">
					<div className="absolute top-4 right-4">
						<div className="w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-500/20" />
					</div>

					<motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ duration: 0.5 }}
						className="relative"
					>
						<div className="w-40 h-40 rounded-full border-4 border-background overflow-hidden shadow-xl ring-1 ring-border">
							<FoxAvatar
								seed={myPersona.id}
								className="w-full h-full"
							/>
						</div>
						<div className="absolute bottom-0 right-0 bg-secondary text-secondary-foreground p-2 rounded-full border-4 border-background">
							<Zap className="w-5 h-5 fill-current" />
						</div>
					</motion.div>

					<div className="space-y-2 w-full">
						{isEditing ? (
							<div className="space-y-1">
								<span className="text-xs text-muted-foreground font-medium text-left block w-full px-1">
									{t("me.display_name")}
								</span>
								<Input
									value={formData.name}
									onChange={(e) =>
										setFormData({
											...formData,
											name: e.target.value,
										})
									}
									className="text-center font-bold text-lg"
									placeholder={t("me.name_placeholder")}
								/>
							</div>
						) : (
							<div>
								<h2 className="text-3xl font-black tracking-tight text-foreground">
									{myPersona.name}
								</h2>
								<p className="text-sm text-muted-foreground">
									AI Persona ID: {myPersona.id.slice(0, 8)}
								</p>
							</div>
						)}
					</div>

					<div className="w-full pt-4 border-t border-border">
						<Link to="/chat" className="w-full">
							<Button
								variant="secondary"
								className="w-full h-12 text-base shadow-lg shadow-secondary/20 hover:shadow-secondary/40 transition-all"
							>
								<MessageSquare className="w-5 h-5 mr-2" />
								{t("me.enter_talk_room")}
							</Button>
						</Link>
					</div>
				</Card>

				<div className="col-span-1 md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
					<Card className="col-span-1 md:col-span-2 p-6 flex flex-col h-full">
						<div className="flex items-center gap-2 mb-4">
							<User className="w-5 h-5 text-secondary" />
							<h3 className="font-bold text-lg">{t("me.bio_title")}</h3>
						</div>

						{isEditing ? (
							<Textarea
								value={formData.profile_text}
								onChange={(e) =>
									setFormData({
										...formData,
										profile_text: e.target.value,
									})
								}
								className="min-h-[150px] text-base leading-relaxed resize-none bg-accent/10"
								placeholder={t("me.bio_placeholder")}
							/>
						) : (
							<div className="prose prose-sm max-w-none">
								<p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
									{formData.profile_text || t("me.no_profile")}
								</p>
							</div>
						)}
					</Card>

					<Card className="col-span-1 p-6">
						<div className="flex items-center gap-2 mb-4">
							<Tag className="w-5 h-5 text-tertiary" />
							<h3 className="font-bold text-lg">{t("me.traits_title")}</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{sections && sections.length > 0 ? (
								sections.slice(0, 5).map((s) => (
									<Badge
										key={s.section_id}
										className="bg-accent/50 text-foreground hover:bg-accent border-accent px-3 py-1.5 text-sm font-medium"
									>
										#{s.section_id}
									</Badge>
								))
							) : (
								<p className="text-sm text-muted-foreground">
									{t("me.no_traits")}
								</p>
							)}
						</div>
					</Card>

					<Card className="col-span-1 p-6 flex flex-col justify-between">
						<div className="flex items-center gap-2 mb-4">
							<Fingerprint className="w-5 h-5 text-chart-1" />
							<h3 className="font-bold text-lg">{t("me.status_title")}</h3>
						</div>

						<div className="space-y-4">
							<div className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border">
								<span className="text-sm font-medium">
									{t("me.avg_compatibility")}
								</span>
								<span className="text-xl font-black text-secondary">84%</span>
							</div>

							<div className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border">
								<span className="text-sm font-medium">
									{t("me.total_dialogues")}
								</span>
								<span className="text-xl font-black">128</span>
							</div>

							<div className="pt-2">
								<span className="text-sm text-muted-foreground flex items-center gap-1">
									{t("me.view_analysis")} <ArrowRight className="w-3 h-3" />
								</span>
							</div>
						</div>
					</Card>

					<Card className="col-span-1 md:col-span-2 mt-4">
						<div className="bg-gradient-to-r from-secondary/10 to-tertiary/10 border border-secondary/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
							<div className="space-y-1">
								<h3 className="font-bold text-lg">{t("me.retrain_title")}</h3>
								<p className="text-sm text-muted-foreground">
									{t("me.retrain_description")}
								</p>
							</div>
							<Link to="/onboarding/speed-dating">
								<Button
									variant="outline"
									className="bg-background border-secondary/30 hover:bg-secondary hover:text-white transition-all whitespace-nowrap"
								>
									<Sparkles className="w-4 h-4 mr-2" />
									{t("me.retrain_button")}
								</Button>
							</Link>
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}
