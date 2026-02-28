import {
	useCachedPersonas,
	useSpeedDatingPersonas,
	useSpeedDatingSessions,
	type SpeedDatingPersona,
} from "@/lib/hooks/useSpeedDating";
import { ApiError } from "@/lib/api";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { saveSpeedDatingSession } from "@/lib/speed-dating-session-storage";

type VirtualPersonaSummary = { id: string; name: string; persona_type: string; bio: string };

function extractBio(compiledDocument: string): string {
	const coreMatch = compiledDocument.match(
		/##\s*(?:コアアイデンティティ|Core Identity)\s*\n([\s\S]*?)(?=\n##\s|\n*$)/,
	);
	if (coreMatch?.[1]) {
		const raw = coreMatch[1].trim().replace(/[#*_`\[\]|]/g, "");
		const firstSentences = raw.split(/[。.!！\n]/).filter(Boolean).slice(0, 2).join("。");
		if (firstSentences.length > 120) return `${firstSentences.slice(0, 120)}...`;
		return firstSentences;
	}
	return "";
}

function personaToSummary(p: SpeedDatingPersona | { id: string; name: string; persona_type: string; compiled_document?: string }): VirtualPersonaSummary {
	return {
		id: p.id,
		name: p.name,
		persona_type: p.persona_type,
		bio: "compiled_document" in p && p.compiled_document ? extractBio(p.compiled_document) : "",
	};
}

export function OnboardingSpeedDating() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const { data: cachedPersonas } = useCachedPersonas();
	const generatePersonas = useSpeedDatingPersonas();
	const createSession = useSpeedDatingSessions();
	const [isStarting, setIsStarting] = useState(false);
	const [isRegenerating, setIsRegenerating] = useState(false);
	const [previewPersonas, setPreviewPersonas] = useState<VirtualPersonaSummary[]>([]);
	const [generationError, setGenerationError] = useState<string | null>(null);
	const [startError, setStartError] = useState<string | null>(null);
	const prefetchedFirstRef = useRef<{ sessionId: string; personaId: string } | null>(null);
	const prefetchingFirstRef = useRef(false);

	useEffect(() => {
		if (!cachedPersonas || cachedPersonas.length === 0) return;
		setPreviewPersonas(cachedPersonas.map(personaToSummary));
	}, [cachedPersonas]);

	useEffect(() => {
		if (previewPersonas.length < 3) return;
		if (prefetchedFirstRef.current?.personaId === previewPersonas[0].id) return;
		if (prefetchingFirstRef.current) return;
		prefetchingFirstRef.current = true;
		(async () => {
			try {
				const session = (await createSession.mutateAsync(previewPersonas[0].id)) as { session_id: string };
				prefetchedFirstRef.current = { sessionId: session.session_id, personaId: previewPersonas[0].id };
			} catch {
				// ignore
			} finally {
				prefetchingFirstRef.current = false;
			}
		})();
	}, [previewPersonas, createSession]);

	useEffect(() => {
		if (previewPersonas.length >= 3) return;
		if (cachedPersonas === undefined) return;
		if (cachedPersonas?.length >= 3) return;
		if (generatePersonas.isPending) return;
		if (generationError) return; // Don't retry if there was an error

		generatePersonas.mutateAsync().then((result) => {
			const personas = Array.isArray(result) ? result : [];
			if (personas.length > 0) {
				setPreviewPersonas(personas.map((p: SpeedDatingPersona) => personaToSummary(p)));
				setGenerationError(null); // Clear any previous errors
			}
		}).catch((err) => {
			console.error("[SpeedDate] Auto-generation failed:", err);
			setGenerationError(t("speed_dating.error_guest_failed"));
		});
	}, [cachedPersonas, generationError]); // eslint-disable-line react-hooks/exhaustive-deps

	const regenerateDates = async () => {
		if (isRegenerating || isStarting) return;
		setIsRegenerating(true);
		setGenerationError(null); // Clear previous errors
		prefetchedFirstRef.current = null;
		try {
			const personasResult = await generatePersonas.mutateAsync();
			const personas = Array.isArray(personasResult) ? personasResult : [];
			if (personas.length === 0) {
				toast.error(t("speed_dating.error_regen_failed"));
				return;
			}
			setPreviewPersonas(personas.map((p: SpeedDatingPersona) => personaToSummary(p)));
			toast.success(t("speed_dating.regen_success"));
		} catch (e) {
			const err = e as ApiError;
			const errorMessage = err?.message ? `${t("speed_dating.error_regen_failed")}: ${err.message}` : t("speed_dating.error_regen_failed");
			toast.error(errorMessage);
			setGenerationError(errorMessage);
		} finally {
			setIsRegenerating(false);
		}
	};

	const startSpeedDate = async () => {
		if (isStarting) return;
		setIsStarting(true);
		setStartError(null); // Clear previous errors
		try {
			let personas: VirtualPersonaSummary[];
			if (previewPersonas.length >= 3) {
				personas = previewPersonas;
			} else if (cachedPersonas && cachedPersonas.length >= 3) {
				personas = cachedPersonas.map(personaToSummary);
			} else {
				const result = await generatePersonas.mutateAsync();
				personas = Array.isArray(result) ? result.map((p: SpeedDatingPersona) => personaToSummary(p)) : [];
			}
			if (personas.length === 0) {
				toast.error(t("speed_dating.error_guest_failed"));
				setStartError(t("speed_dating.error_guest_failed"));
				return;
			}
			setPreviewPersonas(personas);

			const prefetched = prefetchedFirstRef.current;
			let sessionId: string;
			if (prefetched?.personaId === personas[0].id) {
				sessionId = prefetched.sessionId;
				prefetchedFirstRef.current = null;
			} else {
				const session = (await createSession.mutateAsync(personas[0].id)) as { session_id: string };
				sessionId = session.session_id;
			}

			saveSpeedDatingSession({
				personas: personas.map((p) => ({ id: p.id, name: p.name })),
				sessionId,
				personaIndex: 0,
			});
			navigate({ to: "/onboarding/speed-dating-session" });
		} catch (e) {
			console.error("[SpeedDate] startSpeedDate", e);
			const errorMessage = t("speed_dating.error_start_failed");
			toast.error(errorMessage);
			setStartError(errorMessage);
		} finally {
			setIsStarting(false);
		}
	};

	return (
		<div className="p-4 md:p-6 min-h-full w-full max-w-7xl mx-auto">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="space-y-8"
			>
				<div className="space-y-4">
					<h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
						{t("speed_dating.lounge_title")}
					</h1>
					{(generationError || startError) && (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							<AlertTriangle className="inline w-4 h-4 mr-2 -translate-y-px" />
							{generationError || startError}
							<button
								onClick={() => {
									setGenerationError(null);
									setStartError(null);
								}}
								className="ml-3 text-destructive/70 hover:text-destructive"
							>
								×
							</button>
						</div>
					)}
				</div>

				<div className="grid grid-cols-12 gap-6">
					<div className={`relative col-span-12 rounded-2xl ${isRegenerating ? "p-[3px]" : ""}`}>
						{isRegenerating && (
							<div
								className="absolute inset-0 rounded-2xl animate-[spin_2s_linear_infinite]"
								style={{
									background:
										"conic-gradient(from 0deg, var(--color-secondary) 0%, transparent 35%, var(--color-secondary) 70%, transparent 100%)",
								}}
								aria-hidden
							/>
						)}
						<div className={`relative z-10 overflow-hidden rounded-2xl border-2 border-secondary/20 bg-card shadow-lg shadow-secondary/5 ${isRegenerating ? "m-0" : ""}`}>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-0">
								<div className="p-6 md:p-8 space-y-4 bg-muted/30 border border-border border-b md:border-e-0 md:border-b-0">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="text-[10px] font-bold uppercase tracking-widest text-secondary">
												{t("speed_dating.tonights_dates")}
											</p>
											<p className="text-sm font-semibold text-foreground">
												{t("speed_dating.candidates_count", { count: 3 })}
											</p>
										</div>
										<button
											type="button"
											onClick={regenerateDates}
											disabled={isStarting || isRegenerating || generatePersonas.isPending}
											className="inline-flex items-center gap-2 rounded-full border-2 border-secondary/40 px-4 py-2 text-xs font-bold text-secondary hover:bg-secondary/10 hover:border-secondary transition-colors disabled:opacity-40"
										>
											{isRegenerating ? (
												<Loader2 className="w-3.5 h-3.5 animate-spin" />
											) : (
												<RefreshCw className="w-3.5 h-3.5" />
											)}
											{t("speed_dating.regenerate")}
										</button>
									</div>

									{generatePersonas.isPending && previewPersonas.length === 0 ? (
										<div className="flex flex-col items-center justify-center py-12 gap-4 rounded-xl bg-secondary/5 border border-secondary/20">
											<Loader2 className="w-10 h-10 animate-spin text-secondary" />
											<p className="text-sm font-bold text-foreground">
												{t("speed_dating.generating_personas")}
											</p>
											<p className="text-xs text-muted-foreground">
												{t("speed_dating.generating_personas_hint")}
											</p>
										</div>
									) : (
										<div className="space-y-2.5">
											{previewPersonas.length > 0 ? (
												previewPersonas.map((p, i) => (
													<div
														key={p.id}
														className="rounded-xl border border-secondary/15 bg-background px-4 py-3 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-secondary/30 transition-all"
													>
														<div className="w-9 h-9 rounded-full bg-secondary/10 border-2 border-secondary/30 flex items-center justify-center text-sm font-bold text-secondary shrink-0">
															{p.name[0] ?? "?"}
														</div>
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-2">
																<p className="text-sm font-bold text-foreground truncate">
																	{p.name}
																</p>
																<span className="text-[9px] font-bold tracking-widest text-secondary shrink-0 px-2 py-0.5 rounded-md bg-secondary/10">
																	DATE {i + 1}
																</span>
															</div>
															<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
																{p.bio}
															</p>
														</div>
													</div>
												))
											) : (
												<div className="rounded-xl border border-dashed border-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground bg-secondary/5">
													{t("speed_dating.no_candidates")}
												</div>
											)}
										</div>
									)}
								</div>
								<div className="p-6 md:p-8 flex flex-col justify-center border border-border md:border-s-0">
									<div className="flex flex-col items-start gap-6">
										<button
											type="button"
											onClick={startSpeedDate}
											disabled={isStarting || isRegenerating || generatePersonas.isPending}
											className="px-8 py-4 bg-secondary text-secondary-foreground rounded-full font-bold text-sm tracking-wide hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-40 disabled:hover:scale-100 shadow-md shadow-secondary/20"
										>
											{isStarting ? (
												<>
													<Loader2 className="w-4 h-4 animate-spin" />
													{t("speed_dating.preparing")}
												</>
											) : (
												<>
													{t("speed_dating.enter_speed_date")}
													<ArrowRight className="w-4 h-4" />
												</>
											)}
										</button>
										<div className="rounded-xl border-2 border-secondary bg-secondary/5 px-4 py-3 text-sm text-muted-foreground w-full">
											<span className="font-semibold text-secondary">{t("speed_dating.hint_label")}</span>
											{" — "}
											{t("speed_dating.page_hint")}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</motion.div>
		</div>
	);
}
