import { Hono } from "hono";
import type { Env } from "./env";
import { errorHandler } from "./middleware/error";
import auth from "./routes/auth";
import quiz from "./routes/quiz";
import speedDating from "./routes/speed-dating";
import profiles from "./routes/profiles";
import personas from "./routes/personas";
import matching from "./routes/matching";
import internal from "./routes/internal";
import foxConversations from "./routes/fox-conversations";
import partnerFoxChats from "./routes/partner-fox-chats";
import chatRequests from "./routes/chat-requests";
import directChats from "./routes/direct-chats";
import moderation from "./routes/moderation";
import foxSearch from "./routes/fox-search";
import foxSearchWs from "./routes/fox-search-ws";

const app = new Hono<Env>();

app.onError(errorHandler);

app.get("/api/hello", (c) => {
	return c.json({ data: { message: "Hello Hono!" } });
});

app.route("/api/auth", auth);
app.route("/api/quiz", quiz);
app.route("/api/speed-dating", speedDating);
app.route("/api/profiles", profiles);
app.route("/api/personas", personas);
app.route("/api/matching", matching);
app.route("/api/internal", internal);
app.route("/api/fox-conversations", foxConversations);
app.route("/api/partner-fox-chats", partnerFoxChats);
app.route("/api/chat-requests", chatRequests);
app.route("/api/direct-chats", directChats);
app.route("/api/moderation", moderation);
app.route("/api/fox-search", foxSearch);
app.route("/api/fox-search", foxSearchWs);

export type AppType = typeof app;

export { app };