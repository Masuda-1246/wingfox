import { ContentPending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "./-components/Chat";

export const Route = createFileRoute("/_authenticated/chat")({
	validateSearch: (search: Record<string, unknown>): { match_id?: string } => {
		const matchId = search?.match_id;
		return {
			match_id:
				typeof matchId === "string" && matchId.length > 0 ? matchId : undefined,
		};
	},
	pendingComponent: ContentPending,
	component: Chat,
});
