import { FoxAvatar } from "@/components/icons/FoxAvatar";
import { type TranscriptEntry, useSpeedDate } from "@/hooks/use-speed-date";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronRight, Mic, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────

interface PersonaDraft {
	name: string;
	gender: string;
	ageRange: string;
	interests: string[];
}

interface DateCharacter {
	name: string;
	subtitle: string;
	foxVariant: number;
}

interface ThemeConfig {
	id: string;
	name: string;
	subtitle: string;
	character: DateCharacter;
	colors: {
		background: string;
		accent: string;
		bubbleAi: string;
		bubbleUser: string;
		timerNormal: string;
		timerLow: string;
	};
}

interface CompletedDate {
	theme: ThemeConfig;
	transcript: TranscriptEntry[];
}

// ─── Constants ───────────────────────────────────────

const TOTAL_DATES = 3;

const ALL_THEMES: ThemeConfig[] = [
	{
		id: "aquarium",
		name: "Deep Blue Lounge",
		subtitle: "水族館の静けさの中で",
		character: {
			name: "Emma",
			subtitle: "明るくて好奇心旺盛なガイド",
			foxVariant: 0,
		},
		colors: {
			background:
				"radial-gradient(ellipse at 30% 50%, #0a3d62 0%, #0e6655 40%, #061224 100%)",
			accent: "#4fc3f7",
			bubbleAi: "rgba(79, 195, 247, 0.15)",
			bubbleUser: "rgba(79, 195, 247, 0.35)",
			timerNormal: "#4fc3f7",
			timerLow: "#ef5350",
		},
	},
	{
		id: "library",
		name: "The Quiet Corner",
		subtitle: "古い本に囲まれた静かな空間",
		character: {
			name: "Liam",
			subtitle: "落ち着いた知識人",
			foxVariant: 1,
		},
		colors: {
			background:
				"radial-gradient(ellipse at 50% 40%, #3e2723 0%, #4e342e 50%, #1a120b 100%)",
			accent: "#ffb74d",
			bubbleAi: "rgba(255, 183, 77, 0.15)",
			bubbleUser: "rgba(255, 183, 77, 0.35)",
			timerNormal: "#ffb74d",
			timerLow: "#ef5350",
		},
	},
	{
		id: "rooftop",
		name: "Neon Heights",
		subtitle: "夜景を見下ろすルーフトップバー",
		character: {
			name: "Sakura",
			subtitle: "優しくてクリエイティブ",
			foxVariant: 3,
		},
		colors: {
			background: "linear-gradient(180deg, #0d1b2a 0%, #000000 100%)",
			accent: "#e040fb",
			bubbleAi: "rgba(224, 64, 251, 0.15)",
			bubbleUser: "rgba(224, 64, 251, 0.35)",
			timerNormal: "#e040fb",
			timerLow: "#ef5350",
		},
	},
	{
		id: "garden",
		name: "Sunlit Terrace",
		subtitle: "木漏れ日が差すガーデンカフェ",
		character: {
			name: "Kai",
			subtitle: "アクティブで冒険好き",
			foxVariant: 2,
		},
		colors: {
			background:
				"radial-gradient(ellipse at 40% 30%, #2e7d32 0%, #1b5e20 60%, #0a2e0c 100%)",
			accent: "#aed581",
			bubbleAi: "rgba(174, 213, 129, 0.15)",
			bubbleUser: "rgba(174, 213, 129, 0.35)",
			timerNormal: "#aed581",
			timerLow: "#ef5350",
		},
	},
];

function pickRandomThemes(count: number): ThemeConfig[] {
	const shuffled = [...ALL_THEMES].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

function formatTime(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ─── Static particle data (avoids array-index keys) ─

const BUBBLES = Array.from({ length: 12 }, (_, i) => ({
	id: `bubble-${i}`,
	size: 4 + ((i * 3) % 14),
	left: 5 + i * 8,
	duration: 7 + (i % 5) * 1.5,
	delay: i * 1.2,
}));

const MOTES = Array.from({ length: 16 }, (_, i) => ({
	id: `mote-${i}`,
	left: 5 + i * 6,
	top: 15 + (i % 5) * 16,
	duration: 5 + (i % 4) * 1.5,
	delay: i * 0.6,
	size: 2 + (i % 3),
}));

const STARS = Array.from({ length: 30 }, (_, i) => ({
	id: `star-${i}`,
	size: 1 + (i % 3),
	left: (i * 3.4) % 100,
	top: (i * 2.3) % 55,
	duration: 2 + (i % 4),
	delay: (i * 0.5) % 4,
}));

const PETALS = Array.from({ length: 10 }, (_, i) => ({
	id: `petal-${i}`,
	left: 5 + i * 9.5,
	opacity: 0.3 + (i % 3) * 0.15,
	duration: 8 + (i % 5) * 2,
	delay: i * 1.8,
	size: 6 + (i % 3) * 3,
}));

// ─── CSS Keyframes ───────────────────────────────────

function ThemeStyles() {
	return (
		<style>{`
			@keyframes float-up {
				0% { transform: translateY(100vh) scale(0.8); opacity: 0; }
				10% { opacity: 0.6; }
				90% { opacity: 0.6; }
				100% { transform: translateY(-10vh) scale(1.2); opacity: 0; }
			}
			@keyframes drift-right {
				0% { transform: translateX(-15vw) translateY(0); }
				50% { transform: translateX(50vw) translateY(-15px); }
				100% { transform: translateX(115vw) translateY(0); }
			}
			@keyframes drift-right-slow {
				0% { transform: translateX(-10vw); }
				100% { transform: translateX(110vw); }
			}
			@keyframes caustic {
				0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.3; }
				33% { transform: scale(1.3) translate(10px, -10px); opacity: 0.5; }
				66% { transform: scale(0.8) translate(-10px, 10px); opacity: 0.2; }
			}
			@keyframes float-mote {
				0% { transform: translate(0, 0); opacity: 0; }
				20% { opacity: 0.7; }
				80% { opacity: 0.7; }
				100% { transform: translate(30px, -50px); opacity: 0; }
			}
			@keyframes twinkle {
				0%, 100% { opacity: 0.15; }
				50% { opacity: 1; }
			}
			@keyframes fall-petal {
				0% { transform: translate(0, -10vh) rotate(0deg); opacity: 0; }
				10% { opacity: 0.7; }
				90% { opacity: 0.7; }
				100% { transform: translate(60px, 110vh) rotate(720deg); opacity: 0; }
			}
			@keyframes sway {
				0%, 100% { transform: rotate(-3deg); }
				50% { transform: rotate(3deg); }
			}
			@keyframes sway-slow {
				0%, 100% { transform: rotate(-1.5deg) translateX(-2px); }
				50% { transform: rotate(1.5deg) translateX(2px); }
			}
			@keyframes light-ray {
				0%, 100% { opacity: 0.03; transform: scaleX(1); }
				50% { opacity: 0.08; transform: scaleX(1.1); }
			}
			@keyframes jellyfish-float {
				0%, 100% { transform: translateY(0) translateX(0); }
				25% { transform: translateY(-20px) translateX(5px); }
				75% { transform: translateY(10px) translateX(-5px); }
			}
			@keyframes cloud-drift {
				0% { transform: translateX(-20vw); }
				100% { transform: translateX(120vw); }
			}
			@keyframes butterfly-float {
				0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
				25% { transform: translate(15px, -20px) rotate(10deg) scale(0.9); }
				50% { transform: translate(30px, -5px) rotate(-5deg) scale(1.1); }
				75% { transform: translate(10px, -25px) rotate(5deg) scale(0.95); }
			}
			@keyframes neon-pulse {
				0%, 100% { opacity: 0.6; filter: blur(0px); }
				50% { opacity: 1; filter: blur(1px); }
			}
		`}</style>
	);
}

// ─── Theme Background Components ─────────────────────

function AquariumBg() {
	return (
		<>
			{/* Light rays from above */}
			<div
				className="absolute top-0 left-[15%] w-[200px] h-full"
				style={{
					background:
						"linear-gradient(180deg, rgba(79,195,247,0.08) 0%, transparent 70%)",
					transform: "skewX(-10deg)",
					animation: "light-ray 6s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute top-0 left-[45%] w-[150px] h-full"
				style={{
					background:
						"linear-gradient(180deg, rgba(79,195,247,0.06) 0%, transparent 60%)",
					transform: "skewX(5deg)",
					animation: "light-ray 8s ease-in-out infinite 2s",
				}}
			/>
			<div
				className="absolute top-0 right-[20%] w-[120px] h-full"
				style={{
					background:
						"linear-gradient(180deg, rgba(79,195,247,0.05) 0%, transparent 50%)",
					transform: "skewX(-15deg)",
					animation: "light-ray 10s ease-in-out infinite 4s",
				}}
			/>

			{/* Caustic light blurs */}
			<div
				className="absolute w-72 h-72 rounded-full blur-3xl"
				style={{
					top: "8%",
					left: "15%",
					background: "rgba(79, 195, 247, 0.1)",
					animation: "caustic 8s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute w-56 h-56 rounded-full blur-3xl"
				style={{
					top: "45%",
					right: "8%",
					background: "rgba(79, 195, 247, 0.07)",
					animation: "caustic 12s ease-in-out infinite 3s",
				}}
			/>

			{/* Coral reef at bottom */}
			<svg
				aria-hidden="true"
				className="absolute bottom-0 left-0 w-full"
				viewBox="0 0 800 180"
				preserveAspectRatio="xMidYMax slice"
				style={{ opacity: 0.15 }}
			>
				{/* Coral formations */}
				<path
					d="M0,180 L0,140 Q20,100 40,130 Q50,90 70,120 Q80,80 100,110 Q110,70 130,100 L130,180 Z"
					fill="#4fc3f7"
				/>
				<path
					d="M120,180 L120,120 Q140,80 160,110 Q170,60 190,100 Q200,70 220,90 Q230,110 250,130 L250,180 Z"
					fill="#26c6da"
				/>
				<path
					d="M550,180 L550,130 Q570,90 590,120 Q600,70 620,100 Q630,60 650,90 Q670,100 680,120 L680,180 Z"
					fill="#4fc3f7"
				/>
				<path
					d="M670,180 L670,110 Q690,80 710,100 Q720,60 740,90 Q750,70 770,110 L800,130 L800,180 Z"
					fill="#26c6da"
				/>
				{/* Seaweed */}
				<path
					d="M300,180 Q295,140 310,120 Q300,100 315,80 Q305,60 320,40"
					stroke="#4fc3f7"
					strokeWidth="4"
					fill="none"
					style={{ animation: "sway-slow 4s ease-in-out infinite" }}
				/>
				<path
					d="M320,180 Q325,150 315,130 Q325,110 310,90 Q320,70 305,55"
					stroke="#26c6da"
					strokeWidth="3"
					fill="none"
					style={{ animation: "sway-slow 5s ease-in-out infinite 1s" }}
				/>
				<path
					d="M480,180 Q475,145 490,125 Q480,105 495,85 Q485,65 500,50"
					stroke="#4fc3f7"
					strokeWidth="3.5"
					fill="none"
					style={{ animation: "sway-slow 4.5s ease-in-out infinite 0.5s" }}
				/>
				{/* Sandy bottom */}
				<ellipse
					cx="400"
					cy="175"
					rx="400"
					ry="15"
					fill="#0e6655"
					opacity="0.3"
				/>
			</svg>

			{/* Jellyfish */}
			<svg
				aria-hidden="true"
				className="absolute"
				style={{
					top: "15%",
					right: "15%",
					width: "60px",
					height: "80px",
					opacity: 0.2,
					animation: "jellyfish-float 8s ease-in-out infinite",
				}}
				viewBox="0 0 60 80"
			>
				<ellipse cx="30" cy="25" rx="22" ry="18" fill="#4fc3f7" />
				<path
					d="M12,30 Q15,55 10,70"
					stroke="#4fc3f7"
					strokeWidth="2"
					fill="none"
				/>
				<path
					d="M22,32 Q25,60 20,75"
					stroke="#4fc3f7"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M38,32 Q35,60 40,75"
					stroke="#4fc3f7"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M48,30 Q45,55 50,70"
					stroke="#4fc3f7"
					strokeWidth="2"
					fill="none"
				/>
			</svg>
			<svg
				aria-hidden="true"
				className="absolute"
				style={{
					top: "50%",
					left: "8%",
					width: "40px",
					height: "55px",
					opacity: 0.12,
					animation: "jellyfish-float 10s ease-in-out infinite 3s",
				}}
				viewBox="0 0 60 80"
			>
				<ellipse cx="30" cy="25" rx="22" ry="18" fill="#4fc3f7" />
				<path
					d="M14,30 Q17,50 12,65"
					stroke="#4fc3f7"
					strokeWidth="2"
					fill="none"
				/>
				<path
					d="M30,33 Q30,55 28,70"
					stroke="#4fc3f7"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M46,30 Q43,50 48,65"
					stroke="#4fc3f7"
					strokeWidth="2"
					fill="none"
				/>
			</svg>

			{/* Bubbles */}
			{BUBBLES.map((b) => (
				<div
					key={b.id}
					className="absolute rounded-full"
					style={{
						width: `${b.size}px`,
						height: `${b.size}px`,
						left: `${b.left}%`,
						bottom: "0",
						border: "1px solid rgba(79, 195, 247, 0.35)",
						background: "rgba(79, 195, 247, 0.12)",
						animation: `float-up ${b.duration}s linear infinite ${b.delay}s`,
					}}
				/>
			))}

			{/* Fish silhouettes */}
			<svg
				aria-hidden="true"
				className="absolute"
				style={{
					top: "28%",
					width: "45px",
					height: "22px",
					animation: "drift-right 18s linear infinite",
					opacity: 0.2,
				}}
				viewBox="0 0 45 22"
			>
				<path
					d="M0 11 Q12 0 22 11 Q12 22 0 11 Z M22 11 L33 5 L33 17 Z"
					fill="#4fc3f7"
				/>
				<circle cx="8" cy="9" r="1.5" fill="#061224" />
			</svg>
			<svg
				aria-hidden="true"
				className="absolute"
				style={{
					top: "55%",
					width: "35px",
					height: "17px",
					animation: "drift-right 24s linear infinite 6s",
					opacity: 0.15,
				}}
				viewBox="0 0 45 22"
			>
				<path
					d="M0 11 Q12 0 22 11 Q12 22 0 11 Z M22 11 L33 5 L33 17 Z"
					fill="#26c6da"
				/>
				<circle cx="8" cy="9" r="1.5" fill="#061224" />
			</svg>
			<svg
				aria-hidden="true"
				className="absolute"
				style={{
					top: "40%",
					width: "28px",
					height: "14px",
					animation: "drift-right 30s linear infinite 12s",
					opacity: 0.12,
				}}
				viewBox="0 0 45 22"
			>
				<path
					d="M0 11 Q12 0 22 11 Q12 22 0 11 Z M22 11 L33 5 L33 17 Z"
					fill="#4fc3f7"
				/>
			</svg>
			{/* School of small fish */}
			<svg
				aria-hidden="true"
				className="absolute"
				style={{
					top: "35%",
					width: "80px",
					height: "40px",
					animation: "drift-right-slow 35s linear infinite 5s",
					opacity: 0.1,
				}}
				viewBox="0 0 80 40"
			>
				<path
					d="M0 10 Q5 5 10 10 Q5 15 0 10 Z M10 10 L15 7 L15 13 Z"
					fill="#4fc3f7"
				/>
				<path
					d="M15 20 Q20 15 25 20 Q20 25 15 20 Z M25 20 L30 17 L30 23 Z"
					fill="#4fc3f7"
				/>
				<path
					d="M5 28 Q10 23 15 28 Q10 33 5 28 Z M15 28 L20 25 L20 31 Z"
					fill="#4fc3f7"
				/>
				<path
					d="M25 8 Q30 3 35 8 Q30 13 25 8 Z M35 8 L40 5 L40 11 Z"
					fill="#4fc3f7"
				/>
				<path
					d="M35 30 Q40 25 45 30 Q40 35 35 30 Z M45 30 L50 27 L50 33 Z"
					fill="#4fc3f7"
				/>
			</svg>
		</>
	);
}

function LibraryBg() {
	return (
		<>
			{/* Window light */}
			<div
				className="absolute"
				style={{
					top: "5%",
					right: "10%",
					width: "180px",
					height: "250px",
					background:
						"radial-gradient(ellipse at center, rgba(255,183,77,0.12) 0%, rgba(255,183,77,0.03) 50%, transparent 70%)",
					animation: "caustic 10s ease-in-out infinite",
				}}
			/>
			{/* Warm lamp glow */}
			<div
				className="absolute w-64 h-64 rounded-full blur-3xl"
				style={{
					top: "25%",
					left: "50%",
					transform: "translateX(-50%)",
					background: "rgba(255, 183, 77, 0.08)",
					animation: "caustic 8s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute w-40 h-40 rounded-full blur-2xl"
				style={{
					bottom: "20%",
					left: "20%",
					background: "rgba(255, 183, 77, 0.05)",
					animation: "caustic 12s ease-in-out infinite 4s",
				}}
			/>

			{/* Full bookshelf - left wall */}
			<svg
				aria-hidden="true"
				className="absolute bottom-0 left-0 opacity-[0.12]"
				width="200"
				height="100%"
				viewBox="0 0 200 600"
				preserveAspectRatio="xMinYMax meet"
			>
				{/* Shelf boards */}
				<rect x="0" y="100" width="180" height="4" rx="1" fill="#ffb74d" />
				<rect x="0" y="220" width="180" height="4" rx="1" fill="#ffb74d" />
				<rect x="0" y="340" width="180" height="4" rx="1" fill="#ffb74d" />
				<rect x="0" y="460" width="180" height="4" rx="1" fill="#ffb74d" />
				{/* Top shelf books */}
				<rect x="10" y="40" width="16" height="58" rx="2" fill="#ffb74d" />
				<rect x="30" y="25" width="14" height="73" rx="2" fill="#ffcc80" />
				<rect x="48" y="35" width="20" height="63" rx="2" fill="#ffb74d" />
				<rect x="72" y="20" width="12" height="78" rx="2" fill="#ffe0b2" />
				<rect x="88" y="45" width="18" height="53" rx="2" fill="#ffb74d" />
				<rect x="110" y="30" width="15" height="68" rx="2" fill="#ffcc80" />
				<rect x="129" y="40" width="22" height="58" rx="2" fill="#ffb74d" />
				<rect x="155" y="22" width="13" height="76" rx="2" fill="#ffe0b2" />
				{/* Second shelf books */}
				<rect x="8" y="150" width="18" height="68" rx="2" fill="#ffcc80" />
				<rect x="30" y="140" width="14" height="78" rx="2" fill="#ffb74d" />
				<rect x="48" y="160" width="20" height="58" rx="2" fill="#ffe0b2" />
				<rect x="72" y="135" width="16" height="83" rx="2" fill="#ffb74d" />
				<rect x="92" y="155" width="12" height="63" rx="2" fill="#ffcc80" />
				<rect x="108" y="145" width="22" height="73" rx="2" fill="#ffb74d" />
				<rect x="134" y="138" width="15" height="80" rx="2" fill="#ffe0b2" />
				<rect x="153" y="150" width="18" height="68" rx="2" fill="#ffb74d" />
				{/* Third shelf books */}
				<rect x="12" y="265" width="20" height="73" rx="2" fill="#ffb74d" />
				<rect x="36" y="258" width="14" height="80" rx="2" fill="#ffe0b2" />
				<rect x="54" y="275" width="18" height="63" rx="2" fill="#ffcc80" />
				<rect x="76" y="260" width="22" height="78" rx="2" fill="#ffb74d" />
				<rect x="102" y="270" width="12" height="68" rx="2" fill="#ffb74d" />
				<rect x="118" y="255" width="16" height="83" rx="2" fill="#ffcc80" />
				<rect x="138" y="268" width="20" height="70" rx="2" fill="#ffe0b2" />
				{/* Bottom shelf books */}
				<rect x="10" y="395" width="22" height="63" rx="2" fill="#ffcc80" />
				<rect x="36" y="380" width="16" height="78" rx="2" fill="#ffb74d" />
				<rect x="56" y="390" width="18" height="68" rx="2" fill="#ffe0b2" />
				<rect x="78" y="375" width="14" height="83" rx="2" fill="#ffb74d" />
				<rect x="96" y="395" width="20" height="63" rx="2" fill="#ffcc80" />
				<rect x="120" y="382" width="16" height="76" rx="2" fill="#ffb74d" />
				<rect x="140" y="388" width="22" height="70" rx="2" fill="#ffe0b2" />
			</svg>

			{/* Right side - smaller bookshelf */}
			<svg
				aria-hidden="true"
				className="absolute bottom-0 right-0 opacity-[0.08]"
				width="160"
				height="70%"
				viewBox="0 0 160 420"
				preserveAspectRatio="xMaxYMax meet"
			>
				<rect x="0" y="120" width="150" height="3" rx="1" fill="#ffb74d" />
				<rect x="0" y="250" width="150" height="3" rx="1" fill="#ffb74d" />
				<rect x="0" y="380" width="150" height="3" rx="1" fill="#ffb74d" />
				<rect x="10" y="55" width="14" height="63" rx="2" fill="#ffb74d" />
				<rect x="28" y="40" width="18" height="78" rx="2" fill="#ffcc80" />
				<rect x="50" y="60" width="12" height="58" rx="2" fill="#ffb74d" />
				<rect x="66" y="48" width="20" height="70" rx="2" fill="#ffe0b2" />
				<rect x="90" y="55" width="15" height="63" rx="2" fill="#ffb74d" />
				<rect x="109" y="42" width="18" height="76" rx="2" fill="#ffcc80" />
				<rect x="131" y="52" width="14" height="66" rx="2" fill="#ffb74d" />
				<rect x="12" y="170" width="16" height="78" rx="2" fill="#ffcc80" />
				<rect x="32" y="160" width="20" height="88" rx="2" fill="#ffb74d" />
				<rect x="56" y="175" width="14" height="73" rx="2" fill="#ffe0b2" />
				<rect x="74" y="165" width="18" height="83" rx="2" fill="#ffb74d" />
				<rect x="96" y="172" width="12" height="76" rx="2" fill="#ffcc80" />
				<rect x="112" y="158" width="22" height="90" rx="2" fill="#ffb74d" />
				<rect x="14" y="300" width="18" height="78" rx="2" fill="#ffb74d" />
				<rect x="36" y="290" width="14" height="88" rx="2" fill="#ffcc80" />
				<rect x="54" y="305" width="20" height="73" rx="2" fill="#ffe0b2" />
				<rect x="78" y="295" width="16" height="83" rx="2" fill="#ffb74d" />
				<rect x="98" y="302" width="22" height="76" rx="2" fill="#ffb74d" />
			</svg>

			{/* Desk/table at bottom center */}
			<svg
				aria-hidden="true"
				className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-[0.1]"
				width="300"
				height="80"
				viewBox="0 0 300 80"
			>
				<rect x="20" y="10" width="260" height="8" rx="3" fill="#ffb74d" />
				{/* Lamp */}
				<rect x="220" y="0" width="3" height="10" fill="#ffcc80" />
				<ellipse cx="221" cy="0" rx="12" ry="6" fill="#ffb74d" />
				{/* Open book */}
				<path
					d="M100,8 Q115,0 130,8"
					stroke="#ffcc80"
					strokeWidth="2"
					fill="none"
				/>
				<path
					d="M130,8 Q145,0 160,8"
					stroke="#ffcc80"
					strokeWidth="2"
					fill="none"
				/>
			</svg>

			{/* Dust motes in light beams */}
			{MOTES.map((m) => (
				<div
					key={m.id}
					className="absolute rounded-full"
					style={{
						width: `${m.size}px`,
						height: `${m.size}px`,
						left: `${m.left}%`,
						top: `${m.top}%`,
						background: "rgba(255, 183, 77, 0.5)",
						animation: `float-mote ${m.duration}s ease-in-out infinite ${m.delay}s`,
					}}
				/>
			))}
		</>
	);
}

function RooftopBg() {
	return (
		<>
			{/* Moon */}
			<div
				className="absolute"
				style={{
					top: "8%",
					right: "15%",
					width: "60px",
					height: "60px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle at 40% 40%, #fff 0%, rgba(224,64,251,0.3) 50%, transparent 70%)",
					boxShadow: "0 0 60px 20px rgba(224,64,251,0.08)",
				}}
			/>

			{/* Stars */}
			{STARS.map((s) => (
				<div
					key={s.id}
					className="absolute rounded-full"
					style={{
						width: `${s.size}px`,
						height: `${s.size}px`,
						left: `${s.left}%`,
						top: `${s.top}%`,
						background: "#fff",
						animation: `twinkle ${s.duration}s ease-in-out infinite ${s.delay}s`,
					}}
				/>
			))}

			{/* Neon glow spots */}
			<div
				className="absolute w-40 h-40 rounded-full blur-3xl"
				style={{
					top: "25%",
					left: "10%",
					background: "rgba(224, 64, 251, 0.08)",
					animation: "caustic 8s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute w-48 h-48 rounded-full blur-3xl"
				style={{
					top: "15%",
					right: "25%",
					background: "rgba(224, 64, 251, 0.06)",
					animation: "caustic 12s ease-in-out infinite 4s",
				}}
			/>

			{/* Drifting clouds */}
			<div
				className="absolute w-48 h-12 rounded-full blur-xl"
				style={{
					top: "20%",
					background: "rgba(255,255,255,0.03)",
					animation: "cloud-drift 40s linear infinite",
				}}
			/>
			<div
				className="absolute w-64 h-8 rounded-full blur-xl"
				style={{
					top: "35%",
					background: "rgba(255,255,255,0.02)",
					animation: "cloud-drift 55s linear infinite 15s",
				}}
			/>

			{/* City skyline with lit windows */}
			<svg
				aria-hidden="true"
				className="absolute bottom-0 left-0 w-full"
				viewBox="0 0 800 200"
				preserveAspectRatio="xMidYMax slice"
				style={{ opacity: 0.2 }}
			>
				{/* Buildings */}
				<rect
					x="15"
					y="60"
					width="45"
					height="140"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="70"
					y="30"
					width="35"
					height="170"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="115"
					y="70"
					width="55"
					height="130"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="180"
					y="15"
					width="40"
					height="185"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="230"
					y="50"
					width="50"
					height="150"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="290"
					y="35"
					width="35"
					height="165"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="335"
					y="65"
					width="60"
					height="135"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="405"
					y="20"
					width="45"
					height="180"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="460"
					y="45"
					width="40"
					height="155"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="510"
					y="70"
					width="55"
					height="130"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="575"
					y="25"
					width="35"
					height="175"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="620"
					y="55"
					width="50"
					height="145"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="680"
					y="15"
					width="40"
					height="185"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				<rect
					x="730"
					y="40"
					width="55"
					height="160"
					fill="#1a1a2e"
					stroke="#e040fb"
					strokeWidth="0.5"
				/>
				{/* Windows (lit) */}
				<rect x="25" y="75" width="6" height="8" fill="#e040fb" opacity="0.6" />
				<rect x="40" y="95" width="6" height="8" fill="#ffeb3b" opacity="0.4" />
				<rect
					x="25"
					y="120"
					width="6"
					height="8"
					fill="#e040fb"
					opacity="0.3"
				/>
				<rect x="80" y="45" width="5" height="7" fill="#ffeb3b" opacity="0.5" />
				<rect x="90" y="70" width="5" height="7" fill="#e040fb" opacity="0.4" />
				<rect
					x="80"
					y="100"
					width="5"
					height="7"
					fill="#ffeb3b"
					opacity="0.3"
				/>
				<rect
					x="130"
					y="85"
					width="7"
					height="9"
					fill="#e040fb"
					opacity="0.5"
				/>
				<rect
					x="148"
					y="110"
					width="7"
					height="9"
					fill="#ffeb3b"
					opacity="0.3"
				/>
				<rect
					x="192"
					y="30"
					width="5"
					height="8"
					fill="#e040fb"
					opacity="0.6"
				/>
				<rect
					x="205"
					y="60"
					width="5"
					height="8"
					fill="#ffeb3b"
					opacity="0.4"
				/>
				<rect
					x="192"
					y="90"
					width="5"
					height="8"
					fill="#e040fb"
					opacity="0.3"
				/>
				<rect
					x="245"
					y="65"
					width="6"
					height="8"
					fill="#ffeb3b"
					opacity="0.5"
				/>
				<rect
					x="260"
					y="95"
					width="6"
					height="8"
					fill="#e040fb"
					opacity="0.4"
				/>
				<rect
					x="350"
					y="80"
					width="7"
					height="9"
					fill="#ffeb3b"
					opacity="0.4"
				/>
				<rect
					x="370"
					y="110"
					width="7"
					height="9"
					fill="#e040fb"
					opacity="0.5"
				/>
				<rect
					x="418"
					y="35"
					width="5"
					height="8"
					fill="#e040fb"
					opacity="0.5"
				/>
				<rect
					x="432"
					y="65"
					width="5"
					height="8"
					fill="#ffeb3b"
					opacity="0.3"
				/>
				<rect
					x="418"
					y="100"
					width="5"
					height="8"
					fill="#e040fb"
					opacity="0.4"
				/>
				<rect
					x="525"
					y="85"
					width="6"
					height="9"
					fill="#ffeb3b"
					opacity="0.4"
				/>
				<rect
					x="543"
					y="115"
					width="6"
					height="9"
					fill="#e040fb"
					opacity="0.3"
				/>
				<rect
					x="586"
					y="40"
					width="5"
					height="7"
					fill="#e040fb"
					opacity="0.6"
				/>
				<rect
					x="598"
					y="70"
					width="5"
					height="7"
					fill="#ffeb3b"
					opacity="0.4"
				/>
				<rect
					x="635"
					y="70"
					width="6"
					height="8"
					fill="#e040fb"
					opacity="0.4"
				/>
				<rect
					x="652"
					y="100"
					width="6"
					height="8"
					fill="#ffeb3b"
					opacity="0.3"
				/>
				<rect
					x="695"
					y="30"
					width="5"
					height="8"
					fill="#ffeb3b"
					opacity="0.5"
				/>
				<rect
					x="708"
					y="65"
					width="5"
					height="8"
					fill="#e040fb"
					opacity="0.4"
				/>
				<rect
					x="745"
					y="55"
					width="6"
					height="9"
					fill="#e040fb"
					opacity="0.5"
				/>
				<rect
					x="762"
					y="90"
					width="6"
					height="9"
					fill="#ffeb3b"
					opacity="0.3"
				/>
			</svg>

			{/* Neon signs */}
			<div
				className="absolute text-[10px] font-black tracking-widest"
				style={{
					bottom: "28%",
					left: "8%",
					color: "#e040fb",
					textShadow: "0 0 10px #e040fb, 0 0 20px rgba(224,64,251,0.5)",
					animation: "neon-pulse 3s ease-in-out infinite",
					opacity: 0.3,
				}}
			>
				BAR
			</div>
			<div
				className="absolute text-[8px] font-black tracking-widest"
				style={{
					bottom: "32%",
					right: "12%",
					color: "#ffeb3b",
					textShadow: "0 0 8px #ffeb3b, 0 0 16px rgba(255,235,59,0.4)",
					animation: "neon-pulse 4s ease-in-out infinite 1.5s",
					opacity: 0.25,
				}}
			>
				OPEN
			</div>
		</>
	);
}

function GardenBg() {
	return (
		<>
			{/* Sun glow */}
			<div
				className="absolute"
				style={{
					top: "-5%",
					right: "15%",
					width: "120px",
					height: "120px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(174,213,129,0.15) 0%, rgba(174,213,129,0.05) 40%, transparent 70%)",
					boxShadow: "0 0 80px 30px rgba(174,213,129,0.06)",
				}}
			/>
			{/* Sun rays */}
			<div
				className="absolute top-0 right-[12%] w-[100px] h-[60%]"
				style={{
					background:
						"linear-gradient(180deg, rgba(174,213,129,0.06) 0%, transparent 100%)",
					transform: "skewX(-8deg)",
					animation: "light-ray 8s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute top-0 right-[22%] w-[60px] h-[50%]"
				style={{
					background:
						"linear-gradient(180deg, rgba(174,213,129,0.04) 0%, transparent 100%)",
					transform: "skewX(5deg)",
					animation: "light-ray 10s ease-in-out infinite 3s",
				}}
			/>

			{/* Warm ambient glow */}
			<div
				className="absolute w-96 h-96 rounded-full blur-3xl"
				style={{
					top: "10%",
					right: "5%",
					background: "rgba(174, 213, 129, 0.06)",
					animation: "caustic 10s ease-in-out infinite",
				}}
			/>

			{/* Tree/branches - left side */}
			<svg
				aria-hidden="true"
				className="absolute top-0 left-0 opacity-[0.12]"
				width="250"
				height="60%"
				viewBox="0 0 250 400"
				preserveAspectRatio="xMinYMin meet"
				style={{ animation: "sway-slow 8s ease-in-out infinite" }}
			>
				{/* Branch */}
				<path
					d="M0,200 Q30,190 60,160 Q80,140 100,100 Q110,80 120,50"
					stroke="#2e7d32"
					strokeWidth="8"
					fill="none"
				/>
				<path
					d="M60,160 Q80,170 110,150"
					stroke="#2e7d32"
					strokeWidth="5"
					fill="none"
				/>
				<path
					d="M100,100 Q120,115 150,100"
					stroke="#2e7d32"
					strokeWidth="4"
					fill="none"
				/>
				{/* Leaves clusters */}
				<ellipse
					cx="120"
					cy="45"
					rx="35"
					ry="20"
					fill="#aed581"
					opacity="0.6"
				/>
				<ellipse
					cx="100"
					cy="65"
					rx="28"
					ry="16"
					fill="#81c784"
					opacity="0.5"
				/>
				<ellipse
					cx="150"
					cy="95"
					rx="30"
					ry="18"
					fill="#aed581"
					opacity="0.5"
				/>
				<ellipse
					cx="110"
					cy="145"
					rx="25"
					ry="15"
					fill="#81c784"
					opacity="0.4"
				/>
				<ellipse
					cx="55"
					cy="155"
					rx="22"
					ry="14"
					fill="#aed581"
					opacity="0.4"
				/>
			</svg>

			{/* Tree/branches - right side */}
			<svg
				aria-hidden="true"
				className="absolute top-0 right-0 opacity-[0.1]"
				width="200"
				height="50%"
				viewBox="0 0 200 350"
				preserveAspectRatio="xMaxYMin meet"
				style={{ animation: "sway-slow 10s ease-in-out infinite 3s" }}
			>
				<path
					d="M200,180 Q170,170 140,140 Q120,115 100,70"
					stroke="#2e7d32"
					strokeWidth="6"
					fill="none"
				/>
				<path
					d="M140,140 Q125,155 100,145"
					stroke="#2e7d32"
					strokeWidth="4"
					fill="none"
				/>
				<ellipse cx="95" cy="65" rx="30" ry="18" fill="#aed581" opacity="0.5" />
				<ellipse
					cx="115"
					cy="90"
					rx="25"
					ry="15"
					fill="#81c784"
					opacity="0.4"
				/>
				<ellipse
					cx="95"
					cy="140"
					rx="22"
					ry="13"
					fill="#aed581"
					opacity="0.4"
				/>
			</svg>

			{/* Ground with flowers */}
			<svg
				aria-hidden="true"
				className="absolute bottom-0 left-0 w-full"
				viewBox="0 0 800 120"
				preserveAspectRatio="xMidYMax slice"
				style={{ opacity: 0.15 }}
			>
				{/* Grass */}
				<ellipse cx="400" cy="115" rx="420" ry="25" fill="#2e7d32" />
				<ellipse cx="400" cy="120" rx="400" ry="15" fill="#1b5e20" />
				{/* Flowers */}
				<circle cx="80" cy="90" r="6" fill="#f48fb1" />
				<circle cx="80" cy="90" r="3" fill="#fce4ec" />
				<rect x="79" y="96" width="2" height="15" fill="#66bb6a" />
				<circle cx="200" cy="85" r="5" fill="#ce93d8" />
				<circle cx="200" cy="85" r="2.5" fill="#f3e5f5" />
				<rect x="199" y="90" width="2" height="18" fill="#66bb6a" />
				<circle cx="350" cy="92" r="6" fill="#ffab91" />
				<circle cx="350" cy="92" r="3" fill="#fbe9e7" />
				<rect x="349" y="98" width="2" height="14" fill="#66bb6a" />
				<circle cx="500" cy="88" r="5" fill="#f48fb1" />
				<circle cx="500" cy="88" r="2.5" fill="#fce4ec" />
				<rect x="499" y="93" width="2" height="16" fill="#66bb6a" />
				<circle cx="650" cy="91" r="6" fill="#ce93d8" />
				<circle cx="650" cy="91" r="3" fill="#f3e5f5" />
				<rect x="649" y="97" width="2" height="15" fill="#66bb6a" />
				<circle cx="750" cy="87" r="5" fill="#ffab91" />
				<circle cx="750" cy="87" r="2.5" fill="#fbe9e7" />
				<rect x="749" y="92" width="2" height="17" fill="#66bb6a" />
				{/* Small grass blades */}
				<path
					d="M50,105 Q55,85 52,95"
					stroke="#66bb6a"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M150,108 Q148,88 153,98"
					stroke="#66bb6a"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M280,106 Q285,86 282,96"
					stroke="#66bb6a"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M420,107 Q418,87 423,97"
					stroke="#66bb6a"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M570,105 Q575,85 572,95"
					stroke="#66bb6a"
					strokeWidth="1.5"
					fill="none"
				/>
				<path
					d="M700,108 Q698,88 703,98"
					stroke="#66bb6a"
					strokeWidth="1.5"
					fill="none"
				/>
			</svg>

			{/* Butterflies */}
			<svg
				aria-hidden="true"
				className="absolute"
				style={{
					top: "25%",
					left: "20%",
					width: "24px",
					height: "20px",
					opacity: 0.2,
					animation: "butterfly-float 12s ease-in-out infinite",
				}}
				viewBox="0 0 24 20"
			>
				<ellipse
					cx="8"
					cy="8"
					rx="7"
					ry="5"
					fill="#f48fb1"
					transform="rotate(-20 8 8)"
				/>
				<ellipse
					cx="16"
					cy="8"
					rx="7"
					ry="5"
					fill="#f48fb1"
					transform="rotate(20 16 8)"
				/>
				<rect x="11" y="5" width="2" height="12" rx="1" fill="#4a148c" />
			</svg>
			<svg
				aria-hidden="true"
				className="absolute"
				style={{
					top: "40%",
					right: "25%",
					width: "20px",
					height: "16px",
					opacity: 0.15,
					animation: "butterfly-float 15s ease-in-out infinite 5s",
				}}
				viewBox="0 0 24 20"
			>
				<ellipse
					cx="8"
					cy="8"
					rx="7"
					ry="5"
					fill="#ce93d8"
					transform="rotate(-20 8 8)"
				/>
				<ellipse
					cx="16"
					cy="8"
					rx="7"
					ry="5"
					fill="#ce93d8"
					transform="rotate(20 16 8)"
				/>
				<rect x="11" y="5" width="2" height="12" rx="1" fill="#4a148c" />
			</svg>

			{/* Falling petals */}
			{PETALS.map((p) => (
				<div
					key={p.id}
					className="absolute"
					style={{
						left: `${p.left}%`,
						top: "0",
						width: `${p.size}px`,
						height: `${p.size}px`,
						borderRadius: "50% 0 50% 0",
						background: `rgba(174, 213, 129, ${p.opacity})`,
						animation: `fall-petal ${p.duration}s linear infinite ${p.delay}s`,
					}}
				/>
			))}
		</>
	);
}

function ThemeBackground({ theme }: { theme: ThemeConfig }) {
	return (
		<div
			className="absolute inset-0 overflow-hidden"
			style={{ background: theme.colors.background }}
		>
			{theme.id === "aquarium" && <AquariumBg />}
			{theme.id === "library" && <LibraryBg />}
			{theme.id === "rooftop" && <RooftopBg />}
			{theme.id === "garden" && <GardenBg />}
		</div>
	);
}

// ─── Sub-components ──────────────────────────────────

function SpeakingIndicator({
	isSpeaking,
	accentColor,
}: { isSpeaking: boolean; accentColor?: string }) {
	const color = accentColor || "currentColor";
	if (isSpeaking) {
		return (
			<div className="flex items-center gap-2">
				<div className="flex items-center gap-0.5">
					<span
						className="block h-3 w-1 animate-pulse rounded-full [animation-delay:0ms]"
						style={{ background: color }}
					/>
					<span
						className="block h-4 w-1 animate-pulse rounded-full [animation-delay:150ms]"
						style={{ background: color }}
					/>
					<span
						className="block h-3 w-1 animate-pulse rounded-full [animation-delay:300ms]"
						style={{ background: color }}
					/>
				</div>
				<span
					className="text-[10px] font-black uppercase tracking-widest"
					style={{ color }}
				>
					Speaking
				</span>
			</div>
		);
	}
	return (
		<span className="text-[10px] font-black uppercase tracking-widest text-white/50">
			Listening
		</span>
	);
}

function ThemedTranscriptBubble({
	entry,
	theme,
}: { entry: TranscriptEntry; theme: ThemeConfig }) {
	const isAI = entry.source === "ai";
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className={`flex ${isAI ? "justify-start" : "justify-end"}`}
		>
			<div
				className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium backdrop-blur-sm"
				style={{
					background: isAI ? theme.colors.bubbleAi : theme.colors.bubbleUser,
					color: "#fff",
					border: `1px solid ${isAI ? `${theme.colors.accent}33` : `${theme.colors.accent}55`}`,
				}}
			>
				{entry.message}
			</div>
		</motion.div>
	);
}

function ProgressDots({
	current,
	total,
	accentColor,
}: { current: number; total: number; accentColor: string }) {
	const dots = Array.from({ length: total }, (_, i) => `dot-${i}`);
	return (
		<div className="flex items-center gap-2">
			{dots.map((id, i) => (
				<div
					key={id}
					className="w-2 h-2 rounded-full transition-all"
					style={{
						background: i <= current ? accentColor : "rgba(255,255,255,0.2)",
						boxShadow: i === current ? `0 0 8px ${accentColor}` : "none",
					}}
				/>
			))}
		</div>
	);
}

function TransitionCard({
	completedTheme,
	nextTheme,
	onContinue,
}: {
	completedTheme: ThemeConfig;
	nextTheme: ThemeConfig | null;
	onContinue: () => void;
}) {
	useEffect(() => {
		const timer = setTimeout(onContinue, 3000);
		return () => clearTimeout(timer);
	}, [onContinue]);

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md"
		>
			<motion.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				className="text-center space-y-6 p-8"
			>
				{/* Completed character */}
				<div className="flex flex-col items-center gap-3">
					<FoxAvatar
						variant={completedTheme.character.foxVariant}
						className="w-20 h-20 rounded-full"
					/>
					<div className="text-4xl sm:text-5xl font-black italic tracking-tighter text-white">
						Date with {completedTheme.character.name}
					</div>
					<div className="text-white/50 text-sm uppercase tracking-widest font-bold">
						Complete
					</div>
				</div>

				{nextTheme && (
					<div className="space-y-3 pt-4">
						<div className="text-white/40 text-xs uppercase tracking-widest">
							Next date
						</div>
						<div className="flex items-center justify-center gap-3">
							<FoxAvatar
								variant={nextTheme.character.foxVariant}
								className="w-12 h-12 rounded-full"
							/>
							<div className="text-left">
								<div
									className="text-xl font-black"
									style={{ color: nextTheme.colors.accent }}
								>
									{nextTheme.character.name}
								</div>
								<div className="text-white/40 text-xs">{nextTheme.name}</div>
							</div>
						</div>
					</div>
				)}
				<button
					type="button"
					onClick={onContinue}
					className="mt-4 px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all hover:scale-105"
					style={{
						background: (nextTheme || completedTheme).colors.accent,
						color: "#000",
					}}
				>
					Continue <ChevronRight className="w-3 h-3 inline" />
				</button>
			</motion.div>
		</motion.div>
	);
}

// ─── Speed Date Session (remounts per date via key) ──

function SpeedDateSession({
	theme,
	dateIndex,
	totalDates,
	onDateComplete,
}: {
	theme: ThemeConfig;
	dateIndex: number;
	totalDates: number;
	onDateComplete: (transcript: TranscriptEntry[]) => void;
}) {
	const {
		status: dateStatus,
		isSpeaking,
		connectionStatus,
		transcript,
		remainingMs,
		error: dateError,
		startDate,
		endDate,
	} = useSpeedDate();

	const scrollRef = useRef<HTMLDivElement>(null);
	const completedRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: transcript triggers auto-scroll
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [transcript]);

	const transcriptRef = useRef<TranscriptEntry[]>([]);
	transcriptRef.current = transcript;

	useEffect(() => {
		if (dateStatus === "done" && !completedRef.current) {
			completedRef.current = true;
			onDateComplete([...transcriptRef.current]);
		}
	}, [dateStatus, onDateComplete]);

	const isLowTime = remainingMs < 30_000;
	const { character } = theme;

	return (
		<div className="fixed inset-0 z-50 flex flex-col">
			<ThemeBackground theme={theme} />

			{/* Idle screen */}
			{dateStatus === "idle" && (
				<div className="relative z-10 flex-1 flex flex-col items-center justify-center space-y-8 p-6">
					<motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						className="relative"
					>
						{/* Fox avatar with themed glow */}
						<div
							className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center p-1"
							style={{
								boxShadow: `0 0 40px 8px ${theme.colors.accent}25`,
								border: `2px solid ${theme.colors.accent}40`,
							}}
						>
							<FoxAvatar
								variant={character.foxVariant}
								className="w-full h-full rounded-full"
							/>
						</div>
						{connectionStatus === "connecting" && (
							<div
								className="absolute -inset-3 border-2 rounded-full animate-pulse"
								style={{ borderColor: `${theme.colors.accent}60` }}
							/>
						)}
						<div
							className="absolute -inset-6 rounded-full blur-xl"
							style={{ background: `${theme.colors.accent}10` }}
						/>
					</motion.div>

					<div className="text-center space-y-2">
						<div
							className="text-xs font-black uppercase tracking-widest"
							style={{ color: theme.colors.accent }}
						>
							Date {dateIndex + 1} of {totalDates}
						</div>
						<h2 className="text-3xl font-black tracking-tighter italic uppercase text-white">
							{character.name}
						</h2>
						<p className="text-sm text-white/50 max-w-sm">
							{character.subtitle}
						</p>
						<p className="text-xs text-white/30">
							{theme.name} — {theme.subtitle}
						</p>
					</div>

					{dateError && (
						<p className="text-sm text-red-400 text-center max-w-sm">
							{dateError}
						</p>
					)}

					<button
						type="button"
						onClick={startDate}
						disabled={connectionStatus === "connecting"}
						className="px-10 py-4 rounded-full font-black text-xs tracking-widest hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50 shadow-xl"
						style={{
							background: theme.colors.accent,
							color: "#000",
						}}
					>
						{connectionStatus === "connecting" ? (
							<>
								<div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
								CONNECTING...
							</>
						) : (
							<>
								<Mic className="w-4 h-4" />
								START CONVERSATION
							</>
						)}
					</button>
				</div>
			)}

			{/* Talking screen */}
			{dateStatus === "talking" && (
				<div className="relative z-10 flex-1 flex flex-col">
					{/* Top bar */}
					<div className="h-16 px-6 flex items-center justify-between bg-black/30 backdrop-blur-md border-b border-white/5">
						<div className="flex items-center gap-3">
							<FoxAvatar
								variant={character.foxVariant}
								className="w-8 h-8 rounded-full"
							/>
							<span
								className="text-xs font-black uppercase tracking-widest"
								style={{ color: theme.colors.accent }}
							>
								{character.name}
							</span>
						</div>
						<ProgressDots
							current={dateIndex}
							total={totalDates}
							accentColor={theme.colors.accent}
						/>
						<div className="flex items-center gap-4">
							<span
								className="font-mono text-lg font-black px-3 py-1 rounded-full"
								style={{
									color: isLowTime
										? theme.colors.timerLow
										: theme.colors.timerNormal,
									background: isLowTime
										? "rgba(239,83,80,0.15)"
										: `${theme.colors.accent}15`,
								}}
							>
								{formatTime(remainingMs)}
							</span>
							<button
								type="button"
								onClick={endDate}
								className="px-5 py-2 bg-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all backdrop-blur-sm"
							>
								End Date
							</button>
						</div>
					</div>

					{/* Center: agent avatar */}
					<div className="flex-shrink-0 flex flex-col items-center justify-center py-6 sm:py-10">
						<motion.div
							animate={isSpeaking ? { scale: [1, 1.05, 1] } : { scale: 1 }}
							transition={
								isSpeaking
									? {
											repeat: Number.POSITIVE_INFINITY,
											duration: 1.5,
										}
									: {}
							}
							className="relative w-20 h-20 sm:w-28 sm:h-28"
						>
							<div
								className="absolute -inset-3 rounded-full transition-all"
								style={{
									border: `2px solid ${isSpeaking ? `${theme.colors.accent}60` : `${theme.colors.accent}15`}`,
									boxShadow: isSpeaking
										? `0 0 30px ${theme.colors.accent}30`
										: "none",
								}}
							/>
							<FoxAvatar
								variant={character.foxVariant}
								className="w-full h-full rounded-full"
							/>
						</motion.div>
						<div className="mt-3">
							<SpeakingIndicator
								isSpeaking={isSpeaking}
								accentColor={theme.colors.accent}
							/>
						</div>
					</div>

					{/* Bottom: transcript overlay */}
					<div
						className="flex-1 overflow-hidden"
						style={{
							background:
								"linear-gradient(to bottom, transparent, rgba(0,0,0,0.6) 20%)",
						}}
					>
						<div
							ref={scrollRef}
							className="h-full w-full max-w-2xl mx-auto overflow-y-auto px-6 pb-6 pt-4 space-y-3"
						>
							{transcript.length === 0 && (
								<p className="text-center text-sm text-white/40 pt-4">
									会話が始まるのを待っています...
								</p>
							)}
							{transcript.map((entry, i) => (
								<ThemedTranscriptBubble
									key={`${entry.timestamp}-${i}`}
									entry={entry}
									theme={theme}
								/>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Done state (brief, before transition card appears) */}
			{dateStatus === "done" && (
				<div className="relative z-10 flex-1 flex items-center justify-center">
					<div className="text-center space-y-4">
						<div
							className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
							style={{ background: `${theme.colors.accent}20` }}
						>
							<Sparkles
								className="w-8 h-8"
								style={{ color: theme.colors.accent }}
							/>
						</div>
						<div className="text-white/60 text-sm font-bold uppercase tracking-widest">
							Wrapping up...
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Review Transcript Bubble ────────────────────────

function ReviewTranscriptBubble({
	entry,
	accentColor,
}: { entry: TranscriptEntry; accentColor: string }) {
	const isAI = entry.source === "ai";
	return (
		<div className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
			<div
				className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium"
				style={{
					background: isAI ? `${accentColor}15` : `${accentColor}25`,
					border: `1px solid ${accentColor}22`,
				}}
			>
				{entry.message}
			</div>
		</div>
	);
}

// ─── Main Component ──────────────────────────────────

export function PersonasCreate() {
	const navigate = useNavigate();
	const [step, setStep] = useState<
		"initial" | "speed-date" | "review" | "creating"
	>("initial");
	const [draft, setDraft] = useState<PersonaDraft>({
		name: "",
		gender: "",
		ageRange: "",
		interests: [],
	});

	// Multi-date state
	const [currentDateIndex, setCurrentDateIndex] = useState(0);
	const [completedDates, setCompletedDates] = useState<CompletedDate[]>([]);
	const [sessionThemes] = useState<ThemeConfig[]>(() =>
		pickRandomThemes(TOTAL_DATES),
	);
	const [showTransition, setShowTransition] = useState(false);

	const handleDraftChange = (
		field: keyof PersonaDraft,
		value: string | string[],
	) => {
		setDraft((prev) => ({ ...prev, [field]: value }));
	};

	const toggleInterest = (interest: string) => {
		setDraft((prev) => {
			const exists = prev.interests.includes(interest);
			if (exists)
				return {
					...prev,
					interests: prev.interests.filter((i) => i !== interest),
				};
			if (prev.interests.length >= 5) return prev;
			return { ...prev, interests: [...prev.interests, interest] };
		});
	};

	const startSpeedDate = () => {
		if (!draft.name || !draft.gender) {
			toast.error("基本情報を入力してください");
			return;
		}
		setStep("speed-date");
	};

	const handleDateComplete = useCallback(
		(transcript: TranscriptEntry[]) => {
			const completed: CompletedDate = {
				theme: sessionThemes[currentDateIndex],
				transcript,
			};
			setCompletedDates((prev) => [...prev, completed]);

			if (currentDateIndex < TOTAL_DATES - 1) {
				setShowTransition(true);
			} else {
				// Last date done → go to review
				setTimeout(() => setStep("review"), 500);
			}
		},
		[currentDateIndex, sessionThemes],
	);

	const handleTransitionContinue = useCallback(() => {
		setShowTransition(false);
		setCurrentDateIndex((prev) => prev + 1);
	}, []);

	return (
		<div className="p-4 md:p-6 min-h-full w-full max-w-7xl mx-auto">
			<ThemeStyles />
			<AnimatePresence mode="wait">
				{step === "initial" && (
					<motion.div
						key="initial"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className="space-y-8"
					>
						<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
							<div>
								<h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 italic">
									<Users className="w-8 h-8 text-secondary" />
									THE LOUNGE
								</h1>
								<p className="text-muted-foreground mt-2">
									交流イベントへの準備。まずはあなたの簡単なプロフィールを設定しましょう。
								</p>
							</div>
						</div>

						<div className="grid grid-cols-12 gap-6">
							<div className="col-span-12 md:col-span-8 bg-card border border-border rounded-2xl p-8">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									<div className="space-y-6">
										<label className="space-y-2 block">
											<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
												Display Name
											</span>
											<input
												type="text"
												placeholder="あなたの名前"
												value={draft.name}
												onChange={(e) =>
													handleDraftChange("name", e.target.value)
												}
												className="w-full bg-transparent border-b border-border pb-2 text-xl font-bold focus:border-secondary outline-none transition-all"
											/>
										</label>
										<div className="grid grid-cols-2 gap-4">
											<label className="space-y-2 block">
												<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
													Gender
												</span>
												<select
													value={draft.gender}
													onChange={(e) =>
														handleDraftChange("gender", e.target.value)
													}
													className="w-full bg-input/50 border border-border rounded-lg p-2 text-sm"
												>
													<option value="">選択</option>
													<option value="男性">男性</option>
													<option value="女性">女性</option>
													<option value="その他">その他</option>
												</select>
											</label>
										</div>
									</div>
									<div className="space-y-4">
										<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
											Your Interests
										</span>
										<div className="flex flex-wrap gap-2">
											{[
												"音楽",
												"映画",
												"テック",
												"旅",
												"アート",
												"スポーツ",
												"料理",
												"読書",
											].map((tag) => (
												<button
													type="button"
													key={tag}
													onClick={() => toggleInterest(tag)}
													className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${draft.interests.includes(tag) ? "bg-secondary border-secondary text-white" : "bg-transparent border-border"}`}
												>
													{tag}
												</button>
											))}
										</div>
									</div>
								</div>
								<div className="mt-12 flex justify-end">
									<button
										type="button"
										onClick={startSpeedDate}
										disabled={!draft.name || !draft.gender}
										className="px-10 py-4 bg-foreground text-background rounded-full font-black text-xs tracking-widest hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-30 shadow-xl shadow-black/10"
									>
										ENTER SPEED DATE <ArrowRight className="w-4 h-4" />
									</button>
								</div>
							</div>
							<div className="col-span-12 md:col-span-4 bg-secondary/5 rounded-2xl p-6 border border-secondary/10 flex flex-col justify-center space-y-4">
								<Users className="w-10 h-10 text-secondary" />
								<h3 className="font-black text-xs uppercase tracking-tighter italic">
									Tonight&apos;s Experience
								</h3>
								<p className="text-xs text-muted-foreground leading-relaxed">
									3人のゲストと短い会話を交わし、あなたの「個性」を抽出します。それぞれの出会いがあなたの新しい一面を引き出します。
								</p>
							</div>
						</div>
					</motion.div>
				)}

				{step === "speed-date" && (
					<motion.div
						key="speed-date"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<SpeedDateSession
							key={currentDateIndex}
							theme={sessionThemes[currentDateIndex]}
							dateIndex={currentDateIndex}
							totalDates={TOTAL_DATES}
							onDateComplete={handleDateComplete}
						/>
						<AnimatePresence>
							{showTransition && (
								<TransitionCard
									completedTheme={sessionThemes[currentDateIndex]}
									nextTheme={
										currentDateIndex < TOTAL_DATES - 1
											? sessionThemes[currentDateIndex + 1]
											: null
									}
									onContinue={handleTransitionContinue}
								/>
							)}
						</AnimatePresence>
					</motion.div>
				)}

				{step === "review" && (
					<motion.div
						key="review"
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="max-w-4xl mx-auto space-y-8 py-12"
					>
						<div className="text-center space-y-4">
							<h2 className="text-4xl font-black italic tracking-tighter uppercase">
								All Sessions Complete
							</h2>
							<p className="text-muted-foreground">
								3人との会話の内容を確認してください。このデータからペルソナを生成します。
							</p>
						</div>

						{/* Date summary cards - character-focused */}
						{completedDates.map((date, i) => (
							<div
								key={date.theme.id}
								className="bg-card border border-border rounded-2xl overflow-hidden"
								style={{
									borderColor: `${date.theme.colors.accent}30`,
								}}
							>
								{/* Character header */}
								<div className="flex items-center gap-4 px-6 py-5">
									<div
										className="rounded-full p-0.5"
										style={{
											boxShadow: `0 0 20px 4px ${date.theme.colors.accent}15`,
											border: `2px solid ${date.theme.colors.accent}30`,
										}}
									>
										<FoxAvatar
											variant={date.theme.character.foxVariant}
											className="w-14 h-14 rounded-full"
										/>
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="text-lg font-black tracking-tight uppercase">
												{date.theme.character.name}
											</span>
											<span
												className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
												style={{
													color: date.theme.colors.accent,
													background: `${date.theme.colors.accent}15`,
												}}
											>
												Date {i + 1}
											</span>
										</div>
										<p className="text-xs text-muted-foreground truncate">
											{date.transcript.length > 0
												? date.transcript.find((t) => t.source === "ai")
														?.message || date.theme.character.subtitle
												: date.theme.character.subtitle}
										</p>
									</div>
									<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
										{date.transcript.length} turns
									</span>
								</div>
								{/* Transcript */}
								<div className="max-h-[30vh] overflow-y-auto space-y-3 px-6 pb-5 border-t border-border/50">
									{date.transcript.length === 0 && (
										<p className="text-center text-sm text-muted-foreground py-4">
											トランスクリプトはありません
										</p>
									)}
									{date.transcript.map((entry, j) => (
										<ReviewTranscriptBubble
											key={`${entry.timestamp}-${j}`}
											entry={entry}
											accentColor={date.theme.colors.accent}
										/>
									))}
								</div>
							</div>
						))}

						<div className="bg-zinc-900 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
							<div className="space-y-4 text-center md:text-left">
								<div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary/20 text-secondary rounded-full">
									<Sparkles className="w-4 h-4" />
									<span className="text-[10px] font-black uppercase tracking-widest">
										Ready to materialize
									</span>
								</div>
								<h3 className="text-3xl font-black italic tracking-tighter">
									SYNC COMPLETE.
								</h3>
								<p className="text-zinc-400 text-sm max-w-md">
									3人との交流のリズムが解析されました。このデータから、あなたを最もよく表現する「ペルソナ」を生成します。
								</p>
							</div>
							<button
								type="button"
								onClick={() => {
									setStep("creating");
									setTimeout(
										() =>
											navigate({
												to: "/personas/me",
											}),
										2500,
									);
								}}
								className="px-12 py-5 bg-white text-zinc-900 rounded-full font-black text-xs tracking-widest uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
							>
								Finalize Persona <ChevronRight className="w-4 h-4" />
							</button>
						</div>
					</motion.div>
				)}

				{step === "creating" && (
					<motion.div
						key="creating"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center space-y-10"
					>
						<div className="relative w-24 h-24">
							<div className="absolute inset-0 border-[6px] border-secondary/10 border-t-secondary rounded-full animate-spin" />
							<div className="absolute inset-0 flex items-center justify-center">
								<Sparkles className="w-10 h-10 text-secondary" />
							</div>
						</div>
						<div className="text-center space-y-4">
							<h3 className="text-2xl font-black tracking-tighter italic">
								EMBEDDING PERSONALITY...
							</h3>
							<p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
								Encoding patterns from voice dialogue
							</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
