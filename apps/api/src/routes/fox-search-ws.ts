import { Hono } from "hono";
import type { Env } from "../env";

const foxSearchWs = new Hono<Env>();

/** GET /api/fox-search/ws/:conversationId — WebSocket upgrade, proxied to DO */
foxSearchWs.get("/ws/:conversationId", async (c) => {
	const upgradeHeader = c.req.header("Upgrade");
	if (upgradeHeader?.toLowerCase() !== "websocket") {
		return c.text("Expected WebSocket Upgrade", 426);
	}

	const doNs = c.env.FOX_CONVERSATION;
	if (!doNs) {
		return c.text("Durable Objects not available", 503);
	}

	const conversationId = c.req.param("conversationId");
	const doId = doNs.idFromName(conversationId);
	const stub = doNs.get(doId);

	// Forward the WebSocket upgrade request to the DO
	return stub.fetch(new Request("https://do/ws", {
		headers: c.req.raw.headers,
	}));
});

export default foxSearchWs;
