import { createFileRoute } from "@tanstack/react-router";
import { ContentPending } from "@/components/route-pending";
import { Chat } from "./-components/Chat";

export const Route = createFileRoute("/_authenticated/chat")({
	pendingComponent: ContentPending,
	component: Chat,
});
