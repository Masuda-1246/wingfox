import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSpeedDate, type TranscriptEntry } from "@/hooks/use-speed-date";

export const Route = createFileRoute("/speed-dating")({
	component: SpeedDatingPage,
});

const testPersona = {
	name: "さくら",
	age: 27,
	occupation: "カフェオーナー",
	personalitySummary:
		"好奇心旺盛で、新しいことに挑戦するのが好き。温かい雰囲気で人を癒すのが得意。",
	traits: ["好奇心旺盛", "聞き上手", "冒険好き"],
};

function formatTime(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function SpeedDatingPage() {
	const {
		status,
		isSpeaking,
		connectionStatus,
		transcript,
		remainingMs,
		error,
		startDate,
		endDate,
		reset,
	} = useSpeedDate();

	if (status === "idle") {
		return (
			<IdleView
				onStart={startDate}
				error={error}
				isConnecting={connectionStatus === "connecting"}
			/>
		);
	}

	if (status === "talking") {
		return (
			<TalkingView
				isSpeaking={isSpeaking}
				remainingMs={remainingMs}
				transcript={transcript}
				onEnd={endDate}
			/>
		);
	}

	return <DoneView transcript={transcript} onReset={reset} />;
}

function IdleView({
	onStart,
	error,
	isConnecting,
}: {
	onStart: () => void;
	error: string | null;
	isConnecting: boolean;
}) {
	return (
		<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">{testPersona.name}</CardTitle>
					<CardDescription>
						{testPersona.age}歳 / {testPersona.occupation}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<p className="text-sm text-muted-foreground">
						{testPersona.personalitySummary}
					</p>
					<div className="flex flex-wrap gap-2">
						{testPersona.traits.map((trait) => (
							<Badge key={trait} variant="secondary">
								{trait}
							</Badge>
						))}
					</div>
					{error && (
						<p className="text-sm text-destructive">{error}</p>
					)}
					<Button
						size="lg"
						className="mt-4 w-full"
						onClick={onStart}
						disabled={isConnecting}
					>
						{isConnecting ? "接続中..." : "Start Date"}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function TalkingView({
	isSpeaking,
	remainingMs,
	transcript,
	onEnd,
}: {
	isSpeaking: boolean;
	remainingMs: number;
	transcript: TranscriptEntry[];
	onEnd: () => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [transcript]);

	const isLowTime = remainingMs < 30_000;

	return (
		<div className="flex min-h-[calc(100vh-4rem)] flex-col items-center p-4">
			<div className="w-full max-w-md flex flex-col gap-4">
				{/* Header: persona + timer */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
							{testPersona.name[0]}
						</div>
						<div>
							<p className="font-semibold">{testPersona.name}</p>
							<SpeakingIndicator isSpeaking={isSpeaking} />
						</div>
					</div>
					<div
						className={`font-mono text-lg font-bold ${isLowTime ? "text-destructive" : "text-muted-foreground"}`}
					>
						{formatTime(remainingMs)}
					</div>
				</div>

				{/* Transcript */}
				<ScrollArea className="h-[60vh] rounded-lg border">
					<div ref={scrollRef} className="flex flex-col gap-3 p-4">
						{transcript.length === 0 && (
							<p className="text-center text-sm text-muted-foreground">
								会話が始まるのを待っています...
							</p>
						)}
						{transcript.map((entry, i) => (
							<TranscriptBubble key={`${entry.timestamp}-${i}`} entry={entry} />
						))}
					</div>
				</ScrollArea>

				{/* End button */}
				<Button variant="destructive" size="lg" onClick={onEnd}>
					End Date
				</Button>
			</div>
		</div>
	);
}

function SpeakingIndicator({ isSpeaking }: { isSpeaking: boolean }) {
	if (isSpeaking) {
		return (
			<div className="flex items-center gap-1.5">
				<div className="flex items-center gap-0.5">
					<span className="block h-2 w-0.5 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
					<span className="block h-3 w-0.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
					<span className="block h-2 w-0.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
				</div>
				<span className="text-xs text-primary">話しています...</span>
			</div>
		);
	}
	return <span className="text-xs text-muted-foreground">聞いています...</span>;
}

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
	const isAI = entry.source === "ai";
	return (
		<div className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
			<div
				className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
					isAI
						? "bg-secondary text-secondary-foreground"
						: "bg-primary text-primary-foreground"
				}`}
			>
				{entry.message}
			</div>
		</div>
	);
}

function DoneView({
	transcript,
	onReset,
}: {
	transcript: TranscriptEntry[];
	onReset: () => void;
}) {
	return (
		<div className="flex min-h-[calc(100vh-4rem)] flex-col items-center p-4">
			<div className="w-full max-w-md flex flex-col gap-4">
				<Card>
					<CardHeader className="text-center">
						<CardTitle>デート終了</CardTitle>
						<CardDescription>
							{testPersona.name}との会話が終了しました
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<ScrollArea className="h-[50vh] rounded-lg border">
							<div className="flex flex-col gap-3 p-4">
								{transcript.length === 0 && (
									<p className="text-center text-sm text-muted-foreground">
										トランスクリプトはありません
									</p>
								)}
								{transcript.map((entry, i) => (
									<div key={`${entry.timestamp}-${i}`} className="text-sm">
										<span className="font-semibold">
											{entry.source === "ai" ? testPersona.name : "あなた"}:
										</span>{" "}
										{entry.message}
									</div>
								))}
							</div>
						</ScrollArea>
						<Button size="lg" className="w-full" asChild>
							<Link to="/personas/create">ペルソナを生成</Link>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="w-full"
							onClick={onReset}
						>
							もう一度試す
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
