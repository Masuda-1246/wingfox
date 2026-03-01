import { app } from './app'
import { handleScheduled } from './services/daily-batch'

export { FoxConversationDO } from './durable-objects/fox-conversation-do'

export default {
	fetch: app.fetch,
	scheduled: async (event: { cron: string; scheduledTime: number }, env: any, ctx: { waitUntil: (p: Promise<void>) => void }) => {
		ctx.waitUntil(handleScheduled(event, env));
	},
}
