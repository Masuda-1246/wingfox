import type { DnaScoreEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const LAYERS = [
	{
		key: "layer1",
		features: ["mere_exposure", "reciprocity", "similarity_complementarity"],
	},
	{
		key: "layer2",
		features: [
			"attachment",
			"humor_sharing",
			"self_disclosure",
			"synchrony",
			"emotional_responsiveness",
			"self_expansion",
			"self_esteem_reception",
		],
	},
	{
		key: "layer3",
		features: ["physiological", "economic_alignment", "conflict_resolution"],
	},
] as const;

const FEATURE_LABELS: Record<string, { en: string; ja: string }> = {
	mere_exposure: { en: "Warmup Speed", ja: "打ち解けやすさ" },
	reciprocity: { en: "Reciprocity", ja: "好意の返報性" },
	similarity_complementarity: {
		en: "Similarity / Complementarity",
		ja: "類似性・補完性",
	},
	attachment: { en: "Attachment Style", ja: "アタッチメントスタイル" },
	humor_sharing: { en: "Humor Sharing", ja: "ユーモア共有" },
	self_disclosure: { en: "Self-Disclosure", ja: "自己開示の深さ" },
	synchrony: { en: "Synchrony", ja: "同調傾向" },
	emotional_responsiveness: {
		en: "Emotional Responsiveness",
		ja: "感情的応答性",
	},
	self_expansion: { en: "Self-Expansion", ja: "自己拡張" },
	self_esteem_reception: {
		en: "Self-Esteem Reception",
		ja: "自己肯定感の受容",
	},
	physiological: { en: "Rhythm Fit", ja: "リズム適合" },
	economic_alignment: { en: "Value Alignment", ja: "経済的価値観" },
	conflict_resolution: { en: "Conflict Resolution", ja: "葛藤解決スタイル" },
};

const LAYER_LABELS: Record<string, { en: string; ja: string }> = {
	layer1: { en: "Meeting Affinity", ja: "出会いの親和性" },
	layer2: { en: "Psychological Sync", ja: "心理的シンクロ" },
	layer3: { en: "Future Compatibility", ja: "将来の適合性" },
};

interface InteractionDnaDetailsProps {
	scores: Record<string, DnaScoreEntry>;
	compact?: boolean;
	className?: string;
}

function ScoreBar({
	value,
	label,
	confidence,
}: { value: number; label: string; confidence: number }) {
	const pct = Math.round(value * 100);
	return (
		<div className="space-y-1">
			<div className="flex justify-between text-xs">
				<span>{label}</span>
				<span
					className="text-muted-foreground"
					style={{ opacity: Math.max(0.4, confidence) }}
				>
					{pct}%
				</span>
			</div>
			<div className="h-1.5 rounded-full bg-muted overflow-hidden">
				<div
					className="h-full rounded-full bg-secondary transition-all"
					style={{ width: `${pct}%`, opacity: Math.max(0.4, confidence) }}
				/>
			</div>
		</div>
	);
}

function FeatureRow({
	featureKey,
	entry,
	lang,
	compact,
}: {
	featureKey: string;
	entry: DnaScoreEntry;
	lang: "en" | "ja";
	compact: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const label = FEATURE_LABELS[featureKey]?.[lang] ?? featureKey;

	return (
		<div className="space-y-1">
			<ScoreBar
				value={entry.score}
				label={label}
				confidence={entry.confidence}
			/>
			{!compact && entry.reasoning && (
				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					<ChevronDown
						className={cn(
							"w-3 h-3 transition-transform",
							expanded && "rotate-180",
						)}
					/>
					{lang === "ja" ? "根拠" : "Evidence"}
				</button>
			)}
			{expanded && (
				<p className="text-xs text-muted-foreground pl-4 leading-relaxed">
					{entry.reasoning}
				</p>
			)}
		</div>
	);
}

export function InteractionDnaDetails({
	scores,
	compact = false,
	className,
}: InteractionDnaDetailsProps) {
	const { i18n } = useTranslation();
	const lang = i18n.language?.startsWith("en") ? "en" : "ja";

	return (
		<div className={cn("space-y-4", className)}>
			{LAYERS.map((layer) => {
				const layerFeatures = layer.features.filter((f) => scores[f] != null);
				if (layerFeatures.length === 0) return null;

				return (
					<div key={layer.key} className="space-y-2">
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{LAYER_LABELS[layer.key]?.[lang] ?? layer.key}
						</span>
						<div className="grid gap-2">
							{layerFeatures.map((featureKey) => (
								<FeatureRow
									key={featureKey}
									featureKey={featureKey}
									entry={scores[featureKey]}
									lang={lang}
									compact={compact}
								/>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}
