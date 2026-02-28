import type { DnaScoreEntry } from "@/lib/types";
import { useTranslation } from "react-i18next";

const DNA_FEATURES = [
	// Layer 1 — Meeting Affinity
	"mere_exposure",
	"reciprocity",
	"similarity_complementarity",
	// Layer 2 — Psychological Sync
	"attachment",
	"humor_sharing",
	"self_disclosure",
	"synchrony",
	"emotional_responsiveness",
	"self_expansion",
	"self_esteem_reception",
	// Layer 3 — Future Compatibility
	"physiological",
	"economic_alignment",
	"conflict_resolution",
] as const;

type DnaFeatureKey = (typeof DNA_FEATURES)[number];

const FEATURE_LABELS: Record<DnaFeatureKey, { en: string; ja: string }> = {
	mere_exposure: { en: "Warmup", ja: "打ち解け" },
	reciprocity: { en: "Reciprocity", ja: "返報性" },
	similarity_complementarity: { en: "Similarity", ja: "類似性" },
	attachment: { en: "Attachment", ja: "愛着" },
	humor_sharing: { en: "Humor", ja: "ユーモア" },
	self_disclosure: { en: "Disclosure", ja: "自己開示" },
	synchrony: { en: "Synchrony", ja: "同調" },
	emotional_responsiveness: { en: "Emotion", ja: "感情応答" },
	self_expansion: { en: "Expansion", ja: "自己拡張" },
	self_esteem_reception: { en: "Esteem", ja: "自己肯定" },
	physiological: { en: "Rhythm", ja: "リズム" },
	economic_alignment: { en: "Values", ja: "経済観" },
	conflict_resolution: { en: "Conflict", ja: "葛藤解決" },
};

// Layer boundaries for coloring axis lines
const LAYER_RANGES: { start: number; end: number; color: string }[] = [
	{ start: 0, end: 2, color: "var(--secondary)" }, // Layer 1: Meeting Affinity
	{ start: 3, end: 9, color: "var(--tertiary, var(--secondary))" }, // Layer 2: Psychological Sync
	{ start: 10, end: 12, color: "var(--primary, var(--secondary))" }, // Layer 3: Future Compatibility
];

function getLayerColor(index: number): string {
	for (const range of LAYER_RANGES) {
		if (index >= range.start && index <= range.end) return range.color;
	}
	return "var(--secondary)";
}

interface InteractionDnaRadarProps {
	scores: Record<string, DnaScoreEntry>;
	size?: number;
	showLabels?: boolean;
	className?: string;
}

export function InteractionDnaRadar({
	scores,
	size = 300,
	showLabels = true,
	className,
}: InteractionDnaRadarProps) {
	const { i18n } = useTranslation();
	const lang = i18n.language?.startsWith("en") ? "en" : "ja";

	const n = DNA_FEATURES.length;
	const cx = size / 2;
	const cy = size / 2;
	const maxRadius = size * 0.35;
	const labelOffset = size * 0.47;

	function polarToXY(index: number, value: number) {
		const angle = (2 * Math.PI * index) / n - Math.PI / 2;
		return {
			x: cx + Math.cos(angle) * maxRadius * value,
			y: cy + Math.sin(angle) * maxRadius * value,
		};
	}

	function gridPolygon(level: number) {
		return DNA_FEATURES.map((_, i) => {
			const { x, y } = polarToXY(i, level);
			return `${x},${y}`;
		}).join(" ");
	}

	const scoreValues = DNA_FEATURES.map((key) => scores[key]?.score ?? 0);
	const scorePolygon = scoreValues
		.map((val, i) => {
			const { x, y } = polarToXY(i, val);
			return `${x},${y}`;
		})
		.join(" ");

	return (
		<div className={className}>
			<svg
				viewBox={`0 0 ${size} ${size}`}
				width="100%"
				height="100%"
				style={{ maxWidth: size, maxHeight: size }}
				aria-label="Interaction DNA radar chart"
			>
				<title>Interaction DNA radar chart</title>
				{/* Grid polygons */}
				{[0.25, 0.5, 0.75, 1.0].map((level) => (
					<polygon
						key={level}
						points={gridPolygon(level)}
						fill="none"
						stroke="currentColor"
						strokeOpacity={0.1}
						strokeWidth={1}
					/>
				))}

				{/* Axis lines */}
				{DNA_FEATURES.map((feature, i) => {
					const { x, y } = polarToXY(i, 1);
					return (
						<line
							key={`axis-${feature}`}
							x1={cx}
							y1={cy}
							x2={x}
							y2={y}
							stroke={getLayerColor(i)}
							strokeOpacity={0.2}
							strokeWidth={1}
						/>
					);
				})}

				{/* Score polygon fill */}
				<polygon
					points={scorePolygon}
					fill="var(--secondary)"
					fillOpacity={0.2}
					stroke="var(--secondary)"
					strokeWidth={2}
					strokeOpacity={0.8}
				/>

				{/* Score dots */}
				{scoreValues.map((val, i) => {
					const { x, y } = polarToXY(i, val);
					return (
						<circle
							key={`dot-${DNA_FEATURES[i]}`}
							cx={x}
							cy={y}
							r={3}
							fill="var(--secondary)"
						/>
					);
				})}

				{/* Labels */}
				{showLabels &&
					DNA_FEATURES.map((key) => {
						const i = DNA_FEATURES.indexOf(key);
						const angle = (2 * Math.PI * i) / n - Math.PI / 2;
						const lx = cx + Math.cos(angle) * labelOffset;
						const ly = cy + Math.sin(angle) * labelOffset;

						// Determine text-anchor based on position
						let anchor: "start" | "middle" | "end" = "middle";
						const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);
						if (
							normalizedAngle > Math.PI * 0.1 &&
							normalizedAngle < Math.PI * 0.9
						) {
							anchor = "start";
						} else if (
							normalizedAngle > Math.PI * 1.1 &&
							normalizedAngle < Math.PI * 1.9
						) {
							anchor = "end";
						}

						const label = FEATURE_LABELS[key]?.[lang] ?? key;

						return (
							<text
								key={`label-${key}`}
								x={lx}
								y={ly}
								textAnchor={anchor}
								dominantBaseline="central"
								fontSize={lang === "ja" ? 9 : 10}
								fill="currentColor"
								fillOpacity={0.6}
							>
								{label}
							</text>
						);
					})}
			</svg>
		</div>
	);
}
