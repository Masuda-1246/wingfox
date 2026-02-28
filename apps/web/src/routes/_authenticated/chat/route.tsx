import { ContentPending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "./-components/Chat";

export const Route = createFileRoute("/_authenticated/chat")({
	pendingComponent: ContentPending,
	component: Chat,
});
