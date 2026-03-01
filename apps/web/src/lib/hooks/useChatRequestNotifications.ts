import { useAuth } from "@/lib/auth";
import { useAuthMe } from "@/lib/hooks/useAuthMe";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const CHANNEL_NAME = "chat_requests_notifications";
const DM_MESSAGES_CHANNEL_NAME = "direct_chat_messages_notifications";

interface ChatRequestRow {
	id?: string;
	responder_id?: string;
	requester_id?: string;
	status?: string;
}

interface DirectChatMessageRow {
	id?: string;
	room_id?: string;
	sender_id?: string;
	content?: string;
}

/**
 * Subscribes to chat_requests INSERT/UPDATE and direct_chat_messages INSERT via Supabase Realtime.
 * - chat_requests INSERT + responder_id === me: invalidate, toast "DMリクエストが届きました"
 * - chat_requests UPDATE: always invalidate (badge). accepted + requester_id === me → toast "承認されました". declined + requester_id === me → toast "拒否されました"
 * - direct_chat_messages INSERT + sender_id !== me: toast "新しいメッセージが届きました", invalidate direct-chats
 */
export function useChatRequestNotifications() {
	const { user } = useAuth();
	const { data: authMe } = useAuthMe({ enabled: Boolean(user) });
	const profileId = authMe?.id ?? null;
	const { t } = useTranslation("notification");
	const lastToastIdRef = useRef<string | null>(null);
	const lastDmToastKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (!profileId) return;

		const channel = supabase
			.channel(CHANNEL_NAME)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "chat_requests",
				},
				(payload: { new?: ChatRequestRow }) => {
					const row = payload.new;
					if (!row || row.responder_id !== profileId) return;

					void queryClient.refetchQueries({ queryKey: ["chat-requests"] });

					const requestId = row.id ?? "";
					if (lastToastIdRef.current === requestId) return;
					lastToastIdRef.current = requestId;
					setTimeout(() => {
						lastToastIdRef.current = null;
					}, 3000);

					toast.success(t("dm_request_received"));
				},
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "chat_requests",
				},
				(payload: { new?: ChatRequestRow }) => {
					const row = payload.new;
					if (!row) return;

					void queryClient.refetchQueries({ queryKey: ["chat-requests"] });

					// Requester: notify when accepted
					if (row.status === "accepted" && row.requester_id === profileId) {
						const requestId = row.id ?? "";
						if (lastToastIdRef.current === requestId) return;
						lastToastIdRef.current = requestId;
						setTimeout(() => {
							lastToastIdRef.current = null;
						}, 3000);
						toast.success(t("dm_request_accepted"));
						queryClient.invalidateQueries({
							queryKey: ["matching", "results"],
						});
						void queryClient.refetchQueries({ queryKey: ["direct-chats"] });
					}

					// Requester: notify when declined
					if (row.status === "declined" && row.requester_id === profileId) {
						const requestId = row.id ?? "";
						if (lastToastIdRef.current === requestId) return;
						lastToastIdRef.current = requestId;
						setTimeout(() => {
							lastToastIdRef.current = null;
						}, 3000);
						toast.info(t("dm_request_declined"));
						queryClient.invalidateQueries({
							queryKey: ["matching", "results"],
						});
					}
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [profileId, t]);

	// DM (direct messages): notify when someone sends a message in a room I'm in
	useEffect(() => {
		if (!profileId) return;

		const channel = supabase
			.channel(DM_MESSAGES_CHANNEL_NAME)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "direct_chat_messages",
				},
				(payload: { new?: DirectChatMessageRow }) => {
					const row = payload.new;
					if (!row || row.sender_id === profileId) return;

					void queryClient.refetchQueries({ queryKey: ["direct-chats"] });
					queryClient.invalidateQueries({ queryKey: ["matching", "results"] });

					const toastKey = `dm-${row.room_id}-${row.id ?? ""}`;
					if (lastDmToastKeyRef.current === toastKey) return;
					lastDmToastKeyRef.current = toastKey;
					setTimeout(() => {
						lastDmToastKeyRef.current = null;
					}, 2000);

					// Resolve sender name from cached direct-chats (partner in that room = sender)
					const rooms = queryClient.getQueryData<
						Array<{ id: string; partner?: { nickname?: string } }>
					>(["direct-chats"]);
					const room = Array.isArray(rooms)
						? rooms.find((r) => r.id === row.room_id)
						: undefined;
					const senderName = room?.partner?.nickname ?? undefined;
					const message = senderName
						? t("dm_message_from", { name: senderName })
						: t("dm_new_message");

					toast.success(message);
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [profileId, t]);
}
