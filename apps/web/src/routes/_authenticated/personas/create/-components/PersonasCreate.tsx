import {
	useSpeedDatingPersonas,
	useSpeedDatingSessions,
	useSendSpeedDatingMessage,
	useCompleteSpeedDatingSession,
} from "@/lib/hooks/useSpeedDating";
import { useGenerateProfile, useConfirmProfile } from "@/lib/hooks/useProfile";
import { useGenerateWingfoxPersona } from "@/lib/hooks/usePersonasApi";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowRight,
	ChevronRight,
	Sparkles,
	Users,
	CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Message {
	id: string;
	role: string;
	content: string;
}

interface Guest {
	id: string;
	name: string;
	image: string;
	messages: Message[];
	vibe: number;
	status: "waiting" | "active" | "finished";
}

function generateId(): string {
	return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

export interface ThemeConfig {
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

export function AquariumBg() {
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

export function LibraryBg() {
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

export function RooftopBg() {
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

export function GardenBg() {
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

export function PersonasCreate() {
	const { t } = useTranslation("personas");
	const navigate = useNavigate();
	const generatePersonas = useSpeedDatingPersonas();
	const createSession = useSpeedDatingSessions();
	const generateProfile = useGenerateProfile();
	const generateWingfox = useGenerateWingfoxPersona();
	const confirmProfile = useConfirmProfile();

	const [step, setStep] = useState<
		"initial" | "speed-date" | "review" | "creating"
	>("initial");
	// API-backed state
	const [virtualPersonas, setVirtualPersonas] = useState<
		Array<{ id: string; name: string; persona_type: string }>
	>([]);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [currentPersonaIndex, setCurrentPersonaIndex] = useState(0);
	const [_sessionIds, setSessionIds] = useState<string[]>([]);
	// Local UI state for current guest messages (synced from API responses)
	const [guestMessages, setGuestMessages] = useState<
		Record<string, Message[]>
	>({});

	const [draft, setDraft] = useState<PersonaDraft>({
		name: "",
		gender: "",
		ageRange: "",
		interests: [],
	});

	// Derived: guests for UI (from virtualPersonas + guestMessages)
	const guests: Guest[] = virtualPersonas.map((p, i) => ({
		id: p.id,
		name: p.name,
		image: `https://picsum.photos/200/300?random=${i + 1}`,
		messages: guestMessages[p.id] ?? [
			{
				id: `welcome-${p.id}`,
				role: "ai",
				content:
					i === 0
						? "やあ、今日は来てくれてありがとう。まずはリラックスして、最近の調子はどうだい？"
						: "初めまして！リラックスして、あなたのことを教えてください。",
			},
		],
		vibe: 20 + (i < currentPersonaIndex ? 50 : i === currentPersonaIndex ? 30 : 0),
		status:
			i < currentPersonaIndex
				? "finished"
				: i === currentPersonaIndex
					? "active"
					: "waiting",
	}));

	const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
	const [inputValue, setInputValue] = useState("");
	const [isTyping, setIsTyping] = useState(false);

	const activeGuest =
		guests.find((g) => g.id === activeGuestId) ?? guests[0];
	const currentPersonaId = virtualPersonas[currentPersonaIndex]?.id ?? null;
	const sendMessage = useSendSpeedDatingMessage(currentSessionId);
	const completeSession = useCompleteSpeedDatingSession(currentSessionId);

	// Keep activeGuestId in sync with current persona
	useEffect(() => {
		if (virtualPersonas.length > 0 && currentPersonaIndex < virtualPersonas.length) {
			setActiveGuestId(virtualPersonas[currentPersonaIndex].id);
		}
	}, [virtualPersonas, currentPersonaIndex]);

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

	const startSpeedDate = async () => {
		if (!draft.name || !draft.gender) {
			toast.error(t("create.error_basic_info"));
			return;
		}
		try {
			const personasResult = await generatePersonas.mutateAsync();
			const personas = Array.isArray(personasResult) ? personasResult : [];
			if (personas.length === 0) {
				toast.error("仮想ペルソナの生成に失敗しました");
				return;
			}
			setVirtualPersonas(
				personas.map((p: { id: string; name: string; persona_type: string }) => ({
					id: p.id,
					name: p.name,
					persona_type: p.persona_type,
				})),
			);
			const firstSession = await createSession.mutateAsync(personas[0].id);
			const sessionData = firstSession as {
				session_id: string;
				first_message?: { id: string; role: string; content: string; created_at: string };
			};
			setCurrentSessionId(sessionData.session_id);
			setSessionIds([sessionData.session_id]);
			setCurrentPersonaIndex(0);
			if (sessionData.first_message) {
				setGuestMessages((prev) => ({
					...prev,
					[personas[0].id]: [
						{
							id: sessionData.first_message!.id,
							role: "ai",
							content: sessionData.first_message!.content,
						},
					],
				}));
			}
			setStep("speed-date");
		} catch (e) {
			console.error(e);
			toast.error("Speed Dateの開始に失敗しました");
		}
	};

	const handleSendMessage = async () => {
		if (!inputValue.trim() || isTyping || !currentSessionId || !currentPersonaId) return;

		const userMessage: Message = {
			id: generateId(),
			role: "user",
			content: inputValue,
		};
		setGuestMessages((prev) => ({
			...prev,
			[currentPersonaId]: [
				...(prev[currentPersonaId] ?? []),
				userMessage,
			],
		}));
		setInputValue("");
		setIsTyping(true);

		try {
			const res = await sendMessage.mutateAsync(inputValue) as {
				persona_message?: { id: string; role: string; content: string; created_at: string };
			};
			const personaMsg = res?.persona_message;
			if (personaMsg) {
				setGuestMessages((prev) => ({
					...prev,
					[currentPersonaId]: [
						...(prev[currentPersonaId] ?? []),
						{
							id: personaMsg.id,
							role: "ai",
							content: personaMsg.content,
						},
					],
				}));
			}
		} catch (e) {
			console.error(e);
			toast.error("メッセージの送信に失敗しました");
		} finally {
			setIsTyping(false);
		}
	};

	const wrapCurrentTable = async () => {
		if (!currentSessionId || currentPersonaIndex >= virtualPersonas.length) return;
		try {
			await completeSession.mutateAsync(undefined);
			if (currentPersonaIndex < virtualPersonas.length - 1) {
				const nextIndex = currentPersonaIndex + 1;
				const nextPersona = virtualPersonas[nextIndex];
				const nextSession = await createSession.mutateAsync(nextPersona.id) as {
					session_id: string;
					first_message?: { id: string; role: string; content: string; created_at: string };
				};
				setCurrentSessionId(nextSession.session_id);
				setSessionIds((prev) => [...prev, nextSession.session_id]);
				setCurrentPersonaIndex(nextIndex);
				if (nextSession.first_message) {
					setGuestMessages((prev) => ({
						...prev,
						[nextPersona.id]: [
							{
								id: nextSession.first_message!.id,
								role: "ai",
								content: nextSession.first_message!.content,
							},
						],
					}));
				}
				setActiveGuestId(nextPersona.id);
				toast.info(`${nextPersona.name}との会話を始めます`);
			} else {
				setStep("review");
			}
		} catch (e) {
			console.error(e);
			toast.error("セッションの完了に失敗しました");
		}
	};

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
									{t("create.lounge_title")}
								</h1>
								<p className="text-muted-foreground mt-2">
									{t("create.lounge_subtitle")}
								</p>
							</div>
						</div>

						<div className="grid grid-cols-12 gap-6">
							<div className="col-span-12 md:col-span-8 bg-card border border-border rounded-2xl p-8">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									<div className="space-y-6">
										<label className="space-y-2 block">
											<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
												{t("create.display_name")}
											</span>
											<input
												type="text"
												placeholder={t("create.name_placeholder")}
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
													{t("create.gender")}
												</span>
												<select
													value={draft.gender}
													onChange={(e) =>
														handleDraftChange("gender", e.target.value)
													}
													className="w-full bg-input/50 border border-border rounded-lg p-2 text-sm"
												>
													<option value="">{t("create.gender_select")}</option>
													<option value="男性">
														{t("create.gender_male")}
													</option>
													<option value="女性">
														{t("create.gender_female")}
													</option>
													<option value="その他">
														{t("create.gender_other")}
													</option>
												</select>
											</label>
										</div>
									</div>
									<div className="space-y-4">
										<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
											{t("create.interests")}
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
										disabled={
											!draft.name ||
											!draft.gender ||
											generatePersonas.isPending
										}
										className="px-10 py-4 bg-foreground text-background rounded-full font-black text-xs tracking-widest hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-30 shadow-xl shadow-black/10"
									>
										{t("create.enter_speed_date")}{" "}
										<ArrowRight className="w-4 h-4" />
									</button>
								</div>
							</div>
							<div className="col-span-12 md:col-span-4 bg-secondary/5 rounded-2xl p-6 border border-secondary/10 flex flex-col justify-center space-y-4">
								<Users className="w-10 h-10 text-secondary" />
								<h3 className="font-black text-xs uppercase tracking-tighter italic">
									{t("create.tonights_experience")}
								</h3>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{t("create.tonights_experience_desc")}
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
						<div className="relative h-24 border-b border-border bg-background/50 backdrop-blur-md px-6 flex items-center justify-between">
							<div className="flex items-center gap-6">
								<div className="flex flex-col">
									<span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
										Tonight&apos;s Guests
									</span>
									<div className="flex gap-3 mt-2">
										{guests.map((g) => (
											<button
												type="button"
												key={g.id}
												onClick={() =>
													(g.status === "active" || g.status === "finished") &&
													setActiveGuestId(g.id)
												}
												className={`relative group transition-all ${activeGuestId === g.id ? "scale-110" : "opacity-40 hover:opacity-100"}`}
											>
												<div
													className={`w-10 h-10 rounded-full border-2 overflow-hidden ${activeGuestId === g.id ? "border-secondary" : "border-transparent"}`}
												>
													<img
														src={g.image}
														className="w-full h-full object-cover"
														alt={g.name}
													/>
												</div>
												{g.status === "finished" && (
													<div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-full">
														<CheckCircle2 className="w-4 h-4 text-green-500" />
													</div>
												)}
												<span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase whitespace-nowrap">
													{g.name}
												</span>
											</button>
										))}
									</div>
								</div>
							</div>
						</div>

						<div className="flex-1 flex flex-col min-h-0">
							<div className="w-full max-w-xl min-h-[140px] flex flex-col items-center justify-center py-8">
								<AnimatePresence mode="wait">
									{isTyping ? (
										<motion.div
											key="typing"
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0 }}
											className="bg-white px-6 py-4 rounded-full border border-border shadow-md flex gap-1.5"
										>
											<span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
											<span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.2s]" />
											<span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.4s]" />
										</motion.div>
									) : (
										<motion.div
											key={
												activeGuest.messages[activeGuest.messages.length - 1]?.id ?? "last"
											}
											initial={{ opacity: 0, y: 15 }}
											animate={{ opacity: 1, y: 0 }}
											className={`p-6 rounded-3xl shadow-xl border-2 text-center text-sm sm:text-base font-medium transition-all ${
												activeGuest.messages[activeGuest.messages.length - 1]?.role === "ai"
													? "bg-white border-secondary/20 text-foreground"
													: "bg-zinc-900 border-zinc-800 text-white"
											}`}
										>
											{
												activeGuest.messages[activeGuest.messages.length - 1]?.content ?? ""
											}
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							<div className="w-full max-w-2xl mx-auto py-8 px-4">
								<div className="relative">
									<input
										type="text"
										value={inputValue}
										onChange={(e) => setInputValue(e.target.value)}
										onKeyDown={(e) =>
											e.key === "Enter" && handleSendMessage()
										}
										placeholder="あなたの言葉を聴かせてください..."
										className="w-full bg-white border border-border/80 rounded-full px-8 py-5 text-sm focus:outline-none focus:ring-4 focus:ring-secondary/5 transition-all shadow-inner"
									/>
									<button
										type="button"
										onClick={handleSendMessage}
										disabled={
											!inputValue.trim() ||
											isTyping ||
											activeGuestId !== currentPersonaId
										}
										className="absolute right-2 top-2 p-4 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-all"
									>
										<ChevronRight className="w-4 h-4" />
									</button>
								</div>
								{currentPersonaIndex < virtualPersonas.length - 1 ? (
									<button
										type="button"
										onClick={wrapCurrentTable}
										disabled={completeSession.isPending}
										className="mt-4 w-full py-3 rounded-full border-2 border-secondary/50 bg-secondary/5 text-sm font-bold hover:bg-secondary/10 transition-colors disabled:opacity-50"
									>
										{completeSession.isPending ? "完了中..." : "次のゲストへ"}
									</button>
								) : (
									<button
										type="button"
										onClick={wrapCurrentTable}
										disabled={completeSession.isPending}
										className="mt-4 w-full py-3 rounded-full bg-secondary text-white text-sm font-bold hover:bg-secondary/90 transition-colors disabled:opacity-50"
									>
										{completeSession.isPending ? "完了中..." : "レビューへ"}
									</button>
								)}
							</div>
						</div>
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

						<div className="bg-card border border-border rounded-2xl p-6 space-y-4">
							<div className="flex items-center justify-between">
								<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									{t("create.ready_to_materialize")}
								</span>
							</div>
							<p className="text-sm text-muted-foreground">
								会話を完了しました。以下のボタンからペルソナを確定してください。
							</p>
						</div>

						<div className="bg-zinc-900 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
							<div className="space-y-4 text-center md:text-left">
								<div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary/20 text-secondary rounded-full">
									<Sparkles className="w-4 h-4" />
									<span className="text-[10px] font-black uppercase tracking-widest">
										{t("create.ready_to_materialize")}
									</span>
								</div>
								<h3 className="text-3xl font-black italic tracking-tighter">
									{t("create.sync_complete")}
								</h3>
								<p className="text-zinc-400 text-sm max-w-md">
									{t("create.sync_description")}
								</p>
							</div>
							<button
								type="button"
								onClick={async () => {
									setStep("creating");
									try {
										await generateProfile.mutateAsync();
										await generateWingfox.mutateAsync();
										await confirmProfile.mutateAsync();
										toast.success("ペルソナを確定しました");
										navigate({ to: "/personas/me" });
									} catch (e) {
										console.error(e);
										toast.error("ペルソナの確定に失敗しました");
										setStep("review");
									}
								}}
								className="px-12 py-5 bg-white text-zinc-900 rounded-full font-black text-xs tracking-widest uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
							>
								{t("create.finalize_persona")}{" "}
								<ChevronRight className="w-4 h-4" />
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
								{t("create.embedding_personality")}
							</h3>
							<p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
								{t("create.encoding_patterns")}
							</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
