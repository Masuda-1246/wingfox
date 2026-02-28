import { InteractionDnaDetails } from "@/components/InteractionDnaDetails";
import { InteractionDnaRadar } from "@/components/InteractionDnaRadar";
import { FoxAvatar } from "@/components/icons/FoxAvatar";
import { formatDateTime } from "@/lib/date";
import { useAuthMe } from "@/lib/hooks/useAuthMe";
import {
	usePersonaSections,
	usePersonasList,
	useSetRandomPersonaIcon,
	useUpdatePersonaSection,
} from "@/lib/hooks/usePersonasApi";
import { useProfileMe } from "@/lib/hooks/useProfile";
import {
	type QuizQuestion,
	useQuizAnswers,
	useQuizQuestions,
	useSubmitQuizAnswers,
} from "@/lib/hooks/useQuiz";
import type { InteractionStyleWithDna, PersonaSection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { m } from "framer-motion";
import {
	Brain,
	ClipboardList,
	Edit2,
	Heart,
	ImageIcon,
	Loader2,
	MessageSquare,
	RefreshCw,
	Save,
	Sparkles,
	Tag,
	User,
	Zap,
} from "lucide-react";
import {
	forwardRef,
	useCallback,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type QuizOptionItem = { value: string; label: string };

function normalizeQuizOptions(
	options: string[] | Record<string, unknown>,
): QuizOptionItem[] {
	if (Array.isArray(options)) {
		return options.map((o) =>
			typeof o === "string"
				? { value: o, label: o }
				: {
						value: (o as QuizOptionItem).value,
						label: (o as QuizOptionItem).label,
					},
		);
	}
	const arr = options as unknown as QuizOptionItem[] | undefined;
	return Array.isArray(arr) ? arr : [];
}

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

function AxisBar({
	value,
	leftLabel,
	rightLabel,
}: { value: number; leftLabel: string; rightLabel: string }) {
	const pct = Math.round(value * 100);
	return (
		<div className="space-y-1">
			<div className="flex justify-between text-xs text-muted-foreground">
				<span>{leftLabel}</span>
				<span>{rightLabel}</span>
			</div>
			<div className="relative h-2 rounded-full bg-muted overflow-hidden">
				<div
					className="absolute top-0 left-0 h-full rounded-full bg-secondary/70 transition-all"
					style={{ width: `${pct}%` }}
				/>
				<div className="absolute top-0 left-1/2 w-px h-full bg-muted-foreground/30" />
			</div>
		</div>
	);
}

function ScoreBarSimple({ value, label }: { value: number; label: string }) {
	const pct = Math.round(value * 100);
	return (
		<div className="space-y-1">
			<div className="flex justify-between text-xs">
				<span>{label}</span>
				<span className="text-muted-foreground">{pct}%</span>
			</div>
			<div className="h-1.5 rounded-full bg-muted overflow-hidden">
				<div
					className="h-full rounded-full bg-secondary transition-all"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

function PersonalityAnalysisCard({
	profile,
	t,
}: {
	profile: {
		personality_tags?: string[];
		personality_analysis?: Record<string, unknown>;
		values?: Record<string, unknown>;
		romance_style?: Record<string, unknown>;
		communication_style?: Record<string, unknown>;
		interests?: Array<{ category: string; items: string[] }>;
		lifestyle?: Record<string, unknown>;
	};
	t: (key: string) => string;
}) {
	const analysis = profile.personality_analysis;
	const values = profile.values;
	const romance = profile.romance_style;
	const comm = profile.communication_style;
	const interests = profile.interests;
	const lifestyle = profile.lifestyle;
	const tags = profile.personality_tags;

	const hasAnalysis = analysis && Object.keys(analysis).length > 0;
	const hasValues = values && Object.keys(values).length > 0;
	const hasRomance = romance && Object.keys(romance).length > 0;
	const hasComm = comm && Object.keys(comm).length > 0;
	const hasInterests = interests && interests.length > 0;
	const hasLifestyle = lifestyle && Object.keys(lifestyle).length > 0;
	const hasTags = tags && tags.length > 0;

	if (
		!hasAnalysis &&
		!hasValues &&
		!hasRomance &&
		!hasComm &&
		!hasInterests &&
		!hasTags
	) {
		return null;
	}

	return (
		<Card className="col-span-1 md:col-span-2 p-6">
			<div className="flex items-center gap-2 mb-1">
				<Brain className="w-5 h-5 text-secondary" />
				<h3 className="font-bold text-lg">
					{t("me.personality_analysis_title")}
				</h3>
			</div>
			<p className="text-xs text-muted-foreground mb-4">
				{t("me.personality_analysis_desc")}
			</p>

			<div className="space-y-5">
				{/* Personality tags */}
				{hasTags && (
					<div className="flex flex-wrap gap-1.5">
						{tags.map((tag) => (
							<Badge
								key={tag}
								className="bg-secondary/10 text-secondary-foreground border-secondary/20 px-3 py-1 text-sm"
							>
								{tag}
							</Badge>
						))}
					</div>
				)}

				{/* 3 personality axes */}
				{hasAnalysis && (
					<div className="space-y-3">
						{typeof analysis.introvert_extrovert === "number" && (
							<AxisBar
								value={analysis.introvert_extrovert}
								leftLabel={t("me.axis_introvert_extrovert").split(" / ")[0]}
								rightLabel={t("me.axis_introvert_extrovert").split(" / ")[1]}
							/>
						)}
						{typeof analysis.planned_spontaneous === "number" && (
							<AxisBar
								value={analysis.planned_spontaneous}
								leftLabel={t("me.axis_planned_spontaneous").split(" / ")[0]}
								rightLabel={t("me.axis_planned_spontaneous").split(" / ")[1]}
							/>
						)}
						{typeof analysis.logical_emotional === "number" && (
							<AxisBar
								value={analysis.logical_emotional}
								leftLabel={t("me.axis_logical_emotional").split(" / ")[0]}
								rightLabel={t("me.axis_logical_emotional").split(" / ")[1]}
							/>
						)}
					</div>
				)}

				{/* Values */}
				{hasValues && (
					<div className="space-y-2">
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{t("me.section_values")}
						</span>
						<div className="grid gap-2">
							{typeof values.work_life_balance === "number" && (
								<ScoreBarSimple
									value={values.work_life_balance}
									label={t("me.value_work_life_balance")}
								/>
							)}
							{typeof values.family_oriented === "number" && (
								<ScoreBarSimple
									value={values.family_oriented}
									label={t("me.value_family_oriented")}
								/>
							)}
							{typeof values.experience_vs_material === "number" && (
								<ScoreBarSimple
									value={values.experience_vs_material}
									label={t("me.value_experience_vs_material")}
								/>
							)}
						</div>
					</div>
				)}

				{/* Communication style */}
				{hasComm && (
					<div className="space-y-2">
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{t("me.section_communication")}
						</span>
						<div className="grid gap-2">
							{typeof comm.humor_level === "number" && (
								<ScoreBarSimple
									value={comm.humor_level}
									label={t("me.comm_humor_level")}
								/>
							)}
							{typeof comm.empathy_level === "number" && (
								<ScoreBarSimple
									value={comm.empathy_level}
									label={t("me.comm_empathy_level")}
								/>
							)}
							{typeof comm.question_ratio === "number" && (
								<ScoreBarSimple
									value={comm.question_ratio}
									label={t("me.comm_question_ratio")}
								/>
							)}
							{typeof comm.message_length === "string" && (
								<div className="flex gap-2 text-xs">
									<span className="text-muted-foreground">
										{t("me.comm_message_length")}:
									</span>
									<Badge className="bg-accent/50 text-foreground border-accent text-xs">
										{comm.message_length}
									</Badge>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Romance style */}
				{hasRomance && (
					<div className="space-y-2">
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							<Heart className="w-3 h-3 inline mr-1" />
							{t("me.section_romance")}
						</span>
						<div className="grid gap-1.5 text-sm">
							{typeof romance.ideal_relationship === "string" &&
								romance.ideal_relationship && (
									<div className="flex gap-2 text-xs">
										<span className="text-muted-foreground">
											{t("me.romance_ideal_relationship")}:
										</span>
										<span>{romance.ideal_relationship as string}</span>
									</div>
								)}
							{typeof romance.communication_frequency === "string" &&
								romance.communication_frequency && (
									<div className="flex gap-2 text-xs">
										<span className="text-muted-foreground">
											{t("me.romance_communication_frequency")}:
										</span>
										<span>{romance.communication_frequency as string}</span>
									</div>
								)}
							{typeof romance.preferred_partner_type === "string" &&
								romance.preferred_partner_type && (
									<div className="flex gap-2 text-xs">
										<span className="text-muted-foreground">
											{t("me.romance_preferred_partner")}:
										</span>
										<span>{romance.preferred_partner_type as string}</span>
									</div>
								)}
							{Array.isArray(romance.dealbreakers) &&
								(romance.dealbreakers as string[]).length > 0 && (
									<div className="flex gap-2 text-xs">
										<span className="text-muted-foreground">
											{t("me.romance_dealbreakers")}:
										</span>
										<span>{(romance.dealbreakers as string[]).join(", ")}</span>
									</div>
								)}
						</div>
					</div>
				)}

				{/* Interests */}
				{hasInterests && (
					<div className="space-y-2">
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{t("me.section_interests")}
						</span>
						<div className="flex flex-wrap gap-1.5">
							{interests.map((group) =>
								group.items.map((item) => (
									<Badge
										key={`${group.category}-${item}`}
										className="bg-accent/50 text-foreground border-accent px-2 py-0.5 text-xs"
									>
										{item}
									</Badge>
								)),
							)}
						</div>
					</div>
				)}

				{/* Lifestyle */}
				{hasLifestyle && (
					<div className="space-y-2">
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{t("me.section_lifestyle")}
						</span>
						<div className="flex flex-wrap gap-1.5">
							{Array.isArray(lifestyle.weekend_activities) &&
								(lifestyle.weekend_activities as string[]).map((a) => (
									<Badge
										key={a}
										className="bg-accent/50 text-foreground border-accent px-2 py-0.5 text-xs"
									>
										{a}
									</Badge>
								))}
							{typeof lifestyle.diet === "string" && lifestyle.diet && (
								<Badge className="bg-accent/50 text-foreground border-accent px-2 py-0.5 text-xs">
									{lifestyle.diet}
								</Badge>
							)}
							{typeof lifestyle.exercise === "string" && lifestyle.exercise && (
								<Badge className="bg-accent/50 text-foreground border-accent px-2 py-0.5 text-xs">
									{lifestyle.exercise}
								</Badge>
							)}
						</div>
					</div>
				)}
			</div>
		</Card>
	);
}

// --- Form state (profile edit) ---
type FormState = { isEditing: boolean; profileText: string };
type FormAction =
	| { type: "SET_EDITING"; payload: boolean }
	| { type: "SET_PROFILE_TEXT"; payload: string }
	| { type: "SYNC_FROM_SECTIONS"; payload: string };

function formReducer(state: FormState, action: FormAction): FormState {
	switch (action.type) {
		case "SET_EDITING":
			return { ...state, isEditing: action.payload };
		case "SET_PROFILE_TEXT":
			return { ...state, profileText: action.payload };
		case "SYNC_FROM_SECTIONS":
			return { ...state, profileText: action.payload };
		default:
			return state;
	}
}

// --- Quiz edit state ---
type QuizEditState = { editMode: boolean; answers: Record<string, string[]> };
type QuizEditAction =
	| { type: "OPEN_EDIT"; payload: Record<string, string[]> }
	| { type: "CLOSE_EDIT" }
	| {
			type: "SET_ANSWER";
			questionId: string;
			value: string;
			allowMultiple: boolean;
	  }
	| { type: "SET_ANSWERS"; payload: Record<string, string[]> };

function quizEditReducer(
	state: QuizEditState,
	action: QuizEditAction,
): QuizEditState {
	switch (action.type) {
		case "OPEN_EDIT":
			return { editMode: true, answers: action.payload };
		case "CLOSE_EDIT":
			return { ...state, editMode: false };
		case "SET_ANSWER": {
			const next = { ...state.answers };
			const arr = next[action.questionId] ?? [];
			if (action.allowMultiple) {
				if (arr.includes(action.value)) {
					next[action.questionId] = arr.filter((v) => v !== action.value);
				} else {
					next[action.questionId] = [...arr, action.value];
				}
			} else {
				next[action.questionId] = [action.value];
			}
			return { ...state, answers: next };
		}
		case "SET_ANSWERS":
			return { ...state, answers: action.payload };
		default:
			return state;
	}
}

function PersonasMeHeader({
	t,
	lastUpdated,
	isEditing,
	onCancelEdit,
	onStartEdit,
	onSave,
}: {
	t: (key: string, opts?: Record<string, unknown>) => string;
	lastUpdated: string;
	isEditing: boolean;
	onCancelEdit: () => void;
	onStartEdit: () => void;
	onSave: () => void;
}) {
	return (
		<header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">{t("me.title")}</h1>
				<p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
					<RefreshCw className="w-3 h-3" />
					{t("me.last_updated", { date: lastUpdated })}
				</p>
			</div>
			<div className="flex items-center gap-2">
				{isEditing ? (
					<div className="flex items-center gap-2">
						<Button variant="ghost" onClick={onCancelEdit}>
							{t("me.cancel")}
						</Button>
						<Button onClick={onSave} variant="primary">
							<Save className="w-4 h-4 mr-2" />
							{t("me.save")}
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={onStartEdit}>
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
	);
}

function PersonasMeAvatarCard({
	myPersona,
	displayName,
	t,
	isIconLoading,
	onRandomIcon,
}: {
	myPersona: { id: string; icon_url?: string | null };
	displayName: string;
	t: (key: string) => string;
	isIconLoading: boolean;
	onRandomIcon: () => void;
}) {
	const generating = isIconLoading;

	return (
		<Card className="col-span-1 md:col-span-4 p-6 flex flex-col items-center text-center space-y-6 relative group">
			<div className="absolute top-4 right-4">
				<div className="w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-500/20" />
			</div>
			<m.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{
					scale: generating ? [1, 1.02, 1] : 1,
					opacity: 1,
				}}
				transition={
					generating
						? { scale: { repeat: Number.POSITIVE_INFINITY, duration: 1.5 } }
						: { duration: 0.5 }
				}
				className="relative"
			>
				<div
					className={cn(
						"w-40 h-40 overflow-hidden rounded-lg",
						generating && "animate-pulse bg-muted",
					)}
				>
					{generating ? (
						<div className="flex h-full w-full items-center justify-center bg-muted">
							<Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
						</div>
					) : (
						<FoxAvatar
							key={myPersona.icon_url ?? "default"}
							seed={myPersona.id}
							iconUrl={myPersona.icon_url}
							className="w-full h-full"
						/>
					)}
				</div>
				<div className="absolute bottom-0 right-0 bg-secondary text-secondary-foreground p-2 rounded-full border-4 border-background">
					<Zap className="w-5 h-5 fill-current" />
				</div>
			</m.div>
			<div className="space-y-2 w-full">
				<h2 className="text-3xl font-black tracking-tight text-foreground">
					{displayName}
				</h2>
				<p className="text-sm text-muted-foreground">
					AI Persona ID: {myPersona.id.slice(0, 8)}
				</p>
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
				<p className="text-xs text-muted-foreground mt-2 mb-3">
					{t("me.icon_random_notice")}
				</p>
				<Button
					variant="outline"
					className="w-full"
					disabled={generating}
					onClick={onRandomIcon}
				>
					{generating ? (
						<>
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							{t("me.icon_random_loading")}
						</>
					) : (
						<>
							<ImageIcon className="w-4 h-4 mr-2" />
							{t("me.icon_random")}
						</>
					)}
				</Button>
			</div>
		</Card>
	);
}

function PersonasMeBioCard({
	t,
	profileText,
	isEditing,
	onProfileTextChange,
	placeholder,
	noProfileLabel,
}: {
	t: (key: string) => string;
	profileText: string;
	isEditing: boolean;
	onProfileTextChange: (value: string) => void;
	placeholder: string;
	noProfileLabel: string;
}) {
	return (
		<Card className="col-span-1 md:col-span-2 p-6 flex flex-col h-full">
			<div className="flex items-center gap-2 mb-4">
				<User className="w-5 h-5 text-secondary" />
				<h3 className="font-bold text-lg">{t("me.bio_title")}</h3>
			</div>
			{isEditing ? (
				<Textarea
					value={profileText}
					onChange={(e) => onProfileTextChange(e.target.value)}
					className="min-h-[150px] text-base leading-relaxed resize-none bg-accent/10"
					placeholder={placeholder}
				/>
			) : (
				<div className="prose prose-sm max-w-none">
					<p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
						{profileText || noProfileLabel}
					</p>
				</div>
			)}
		</Card>
	);
}

function PersonasMeInteractionCard({
	profileData,
	t,
}: {
	profileData: {
		interaction_style?: InteractionStyleWithDna;
		personality_tags?: string[];
	} | null;
	t: (key: string) => string;
}) {
	const interactionStyle = profileData?.interaction_style;
	const dnaScores = interactionStyle?.dna_scores;
	const hasDna = dnaScores != null && Object.keys(dnaScores).length > 0;

	if (hasDna && dnaScores) {
		return (
			<Card className="col-span-1 md:col-span-2 p-6">
				<div className="flex items-center gap-2 mb-4">
					<Zap className="w-5 h-5 text-secondary" />
					<h3 className="font-bold text-lg">{t("me.interaction_dna_title")}</h3>
				</div>
				{interactionStyle?.overall_signature && (
					<p className="text-sm italic text-muted-foreground mb-4">
						"{interactionStyle.overall_signature}"
					</p>
				)}
				<div className="flex justify-center mb-4">
					<InteractionDnaRadar scores={dnaScores} size={260} />
				</div>
				<InteractionDnaDetails scores={dnaScores} compact />
			</Card>
		);
	}

	const tags = profileData?.personality_tags;
	return (
		<Card className="col-span-1 md:col-span-2 p-6">
			<div className="flex items-center gap-2 mb-4">
				<Tag className="w-5 h-5 text-tertiary" />
				<h3 className="font-bold text-lg">{t("me.traits_title")}</h3>
			</div>
			<div className="flex flex-wrap gap-2">
				{tags && tags.length > 0 ? (
					tags.map((tag) => (
						<Badge
							key={tag}
							className="bg-accent/50 text-foreground hover:bg-accent border-accent px-3 py-1.5 text-sm font-medium"
						>
							{tag}
						</Badge>
					))
				) : (
					<p className="text-sm text-muted-foreground">
						{t("me.no_interaction_data")}
					</p>
				)}
			</div>
		</Card>
	);
}

function PersonasMeQuizCard({
	t,
	quizAnswersData,
	quizAnswersLoading,
	quizEditMode,
	quizAnswers,
	sortedQuestions,
	answersMap,
	onOpenEdit,
	onQuizSelect,
	onQuizSave,
	onQuizCancel,
	submitPending,
}: {
	t: (key: string, opts?: Record<string, unknown>) => string;
	quizAnswersData: unknown;
	quizAnswersLoading: boolean;
	quizEditMode: boolean;
	quizAnswers: Record<string, string[]>;
	sortedQuestions: QuizQuestion[];
	answersMap: Record<string, string[]>;
	onOpenEdit: () => void;
	onQuizSelect: (q: QuizQuestion, value: string) => void;
	onQuizSave: () => void;
	onQuizCancel: () => void;
	submitPending: boolean;
}) {
	const hasSavedAnswers =
		Array.isArray(quizAnswersData) && quizAnswersData.length > 0;

	return (
		<Card className="col-span-1 md:col-span-2 p-6">
			<div className="flex items-center justify-between gap-2 mb-4">
				<div className="flex items-center gap-2">
					<ClipboardList className="w-5 h-5 text-secondary" />
					<div>
						<h3 className="font-bold text-lg">{t("me.quiz_results_title")}</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							{t("me.quiz_results_description")}
						</p>
					</div>
				</div>
				{!quizEditMode && hasSavedAnswers && (
					<Button
						variant="outline"
						onClick={onOpenEdit}
						className="text-xs h-9 px-3"
					>
						<Edit2 className="w-3 h-3 mr-1" />
						{t("me.quiz_results_edit")}
					</Button>
				)}
			</div>

			{quizAnswersLoading ? (
				<div className="flex items-center justify-center py-8 text-muted-foreground">
					<Loader2 className="w-6 h-6 animate-spin" />
				</div>
			) : !hasSavedAnswers ? (
				<div className="space-y-3">
					<p className="text-sm text-muted-foreground">
						{t("me.quiz_results_empty")}
					</p>
					<Link to="/onboarding/quiz">
						<Button variant="secondary" className="text-sm">
							{t("me.quiz_button")}
						</Button>
					</Link>
				</div>
			) : quizEditMode ? (
				<div className="space-y-6">
					{sortedQuestions.map((q) => {
						const options = normalizeQuizOptions(
							t(`quiz.questions.${q.id}.options`, {
								ns: "onboarding",
								returnObjects: true,
							}) as unknown as string[] | Record<string, unknown>,
						);
						const selected = quizAnswers[q.id] ?? [];
						return (
							<div key={q.id} className="space-y-2">
								<span className="text-xs font-medium text-muted-foreground">
									{t(`quiz.categories.${q.category}`, { ns: "onboarding" })}
								</span>
								<p className="text-sm font-medium">
									{t(`quiz.questions.${q.id}.text`, { ns: "onboarding" })}
								</p>
								<div
									className={cn(
										"grid gap-2",
										q.allow_multiple
											? "grid-cols-1"
											: "grid-cols-1 sm:grid-cols-2",
									)}
								>
									{options.map((opt) => {
										const isSelected = selected.includes(opt.value);
										return (
											<button
												key={opt.value}
												type="button"
												onClick={() => onQuizSelect(q, opt.value)}
												className={cn(
													"rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-colors",
													isSelected
														? "border-primary bg-primary/10 text-primary"
														: "border-border bg-card hover:bg-accent/50",
												)}
											>
												{q.allow_multiple && (
													<span className="mr-2">{isSelected ? "☑" : "☐"}</span>
												)}
												{opt.label}
											</button>
										);
									})}
								</div>
							</div>
						);
					})}
					<div className="flex items-center gap-2 pt-2">
						<Button variant="ghost" onClick={onQuizCancel}>
							{t("me.quiz_results_cancel")}
						</Button>
						<Button
							variant="primary"
							onClick={onQuizSave}
							disabled={submitPending}
						>
							{submitPending ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<>
									<Save className="w-4 h-4 mr-2" />
									{t("me.quiz_results_save")}
								</>
							)}
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-4">
					{sortedQuestions.map((q) => {
						const options = normalizeQuizOptions(
							t(`quiz.questions.${q.id}.options`, {
								ns: "onboarding",
								returnObjects: true,
							}) as unknown as string[] | Record<string, unknown>,
						);
						const selectedValues = answersMap[q.id] ?? [];
						const labels = selectedValues
							.map((v) => options.find((o) => o.value === v)?.label ?? v)
							.filter(Boolean);
						return (
							<div
								key={q.id}
								className="border-b border-border pb-3 last:border-0 last:pb-0"
							>
								<p className="text-xs text-muted-foreground mb-0.5">
									{t(`quiz.categories.${q.category}`, { ns: "onboarding" })}
								</p>
								<p className="text-sm font-medium">
									{t(`quiz.questions.${q.id}.text`, { ns: "onboarding" })}
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									{labels.length > 0 ? labels.join(" / ") : "—"}
								</p>
							</div>
						);
					})}
				</div>
			)}
		</Card>
	);
}

export function PersonasMe() {
	const { t } = useTranslation(["personas", "onboarding"]);
	const { data: personasList, isLoading } = usePersonasList("wingfox");
	const myPersona =
		personasList && personasList.length > 0 ? personasList[0] : null;
	const { data: authMe } = useAuthMe();
	const myPersonaDisplayName =
		myPersona?.persona_type === "wingfox" && authMe?.nickname
			? `${authMe.nickname.trim()}Fox`
			: (myPersona?.name ?? "");
	const { data: sections } = usePersonaSections(myPersona?.id);
	const updateSection = useUpdatePersonaSection(
		myPersona?.id ?? null,
		"core_identity",
	);
	const { data: profileData } = useProfileMe();
	const setRandomIcon = useSetRandomPersonaIcon(myPersona?.id ?? null);
	const [isIconGenerating, setIsIconGenerating] = useState(false);
	const iconGenerateStartRef = useRef<number>(0);
	const MIN_ICON_GENERATING_MS = 7000;
	const { data: quizQuestions } = useQuizQuestions();
	const { data: quizAnswersData, isLoading: quizAnswersLoading } =
		useQuizAnswers();
	const submitQuiz = useSubmitQuizAnswers();

	const [formState, formDispatch] = useReducer(formReducer, {
		isEditing: false,
		profileText: "",
	});
	const [quizState, quizDispatch] = useReducer(quizEditReducer, {
		editMode: false,
		answers: {},
	});

	const sortedQuestions = useMemo(
		() =>
			[...(quizQuestions ?? [])].sort(
				(a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
			),
		[quizQuestions],
	);

	const answersMap = useMemo(() => {
		const arr = Array.isArray(quizAnswersData) ? quizAnswersData : [];
		return arr.reduce<Record<string, string[]>>((acc, row) => {
			acc[row.question_id] = Array.isArray(row.selected) ? row.selected : [];
			return acc;
		}, {});
	}, [quizAnswersData]);

	const coreContent =
		sections?.find((s: PersonaSection) => s.section_id === "core_identity")
			?.content ?? "";

	const startEdit = useCallback(() => {
		formDispatch({ type: "SYNC_FROM_SECTIONS", payload: coreContent });
		formDispatch({ type: "SET_EDITING", payload: true });
	}, [coreContent]);

	const openQuizEdit = useCallback(() => {
		const initial: Record<string, string[]> = {};
		for (const q of sortedQuestions) {
			initial[q.id] = answersMap[q.id] ?? [];
		}
		quizDispatch({ type: "OPEN_EDIT", payload: initial });
	}, [sortedQuestions, answersMap]);

	const handleQuizSelect = useCallback((q: QuizQuestion, value: string) => {
		quizDispatch({
			type: "SET_ANSWER",
			questionId: q.id,
			value,
			allowMultiple: q.allow_multiple ?? false,
		});
	}, []);

	const handleQuizSave = useCallback(async () => {
		const payload = sortedQuestions.map((q) => ({
			question_id: q.id,
			selected: quizState.answers[q.id] ?? [],
		}));
		try {
			await submitQuiz.mutateAsync(payload);
			quizDispatch({ type: "CLOSE_EDIT" });
			toast.success(t("me.quiz_results_updated_toast"));
		} catch (e) {
			console.error(e);
			toast.error(t("me.quiz_results_update_error"));
		}
	}, [sortedQuestions, quizState.answers, submitQuiz, t]);

	const handleSave = async () => {
		if (!myPersona) return;
		try {
			await updateSection.mutateAsync(formState.profileText);
			formDispatch({ type: "SET_EDITING", payload: false });
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
			<PersonasMeHeader
				t={t}
				lastUpdated={
					myPersona.updated_at
						? formatDateTime(new Date(myPersona.updated_at))
						: "—"
				}
				isEditing={formState.isEditing}
				onCancelEdit={() =>
					formDispatch({ type: "SET_EDITING", payload: false })
				}
				onStartEdit={startEdit}
				onSave={handleSave}
			/>

			<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
				<PersonasMeAvatarCard
					myPersona={myPersona}
					displayName={myPersonaDisplayName}
					t={t}
					isIconLoading={setRandomIcon.isPending || isIconGenerating}
					onRandomIcon={() => {
						iconGenerateStartRef.current = Date.now();
						setIsIconGenerating(true);
						setRandomIcon.mutate(undefined, {
							onSuccess: () => {
								const elapsed = Date.now() - iconGenerateStartRef.current;
								const remain = Math.max(0, MIN_ICON_GENERATING_MS - elapsed);
								setTimeout(() => {
									setIsIconGenerating(false);
									toast.success(t("me.icon_random_success"));
								}, remain);
							},
							onError: () => {
								setIsIconGenerating(false);
								toast.error(t("me.icon_random_error"));
							},
						});
					}}
				/>

				<div className="col-span-1 md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
					<PersonasMeBioCard
						t={t}
						profileText={
							formState.isEditing ? formState.profileText : coreContent
						}
						isEditing={formState.isEditing}
						onProfileTextChange={(value) =>
							formDispatch({ type: "SET_PROFILE_TEXT", payload: value })
						}
						placeholder={t("me.bio_placeholder")}
						noProfileLabel={t("me.no_profile")}
					/>

					{profileData && (
						<PersonalityAnalysisCard profile={profileData} t={t} />
					)}

					<PersonasMeInteractionCard profileData={profileData ?? null} t={t} />

					<PersonasMeQuizCard
						t={t}
						quizAnswersData={quizAnswersData}
						quizAnswersLoading={quizAnswersLoading}
						quizEditMode={quizState.editMode}
						quizAnswers={quizState.answers}
						sortedQuestions={sortedQuestions}
						answersMap={answersMap}
						onOpenEdit={openQuizEdit}
						onQuizSelect={handleQuizSelect}
						onQuizSave={handleQuizSave}
						onQuizCancel={() => quizDispatch({ type: "CLOSE_EDIT" })}
						submitPending={submitQuiz.isPending}
					/>
				</div>
			</div>
		</div>
	);
}
