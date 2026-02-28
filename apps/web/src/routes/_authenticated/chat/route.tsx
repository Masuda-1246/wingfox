import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "./-components/Chat";

export const Route = createFileRoute("/_authenticated/chat")({
	component: Chat,
});
