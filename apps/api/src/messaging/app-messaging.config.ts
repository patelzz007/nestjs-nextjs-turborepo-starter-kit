import { QUEUE_NAMES } from "@workspace/shared";

import type { MessagingModuleOptions } from "@workspace/messaging/nest";

/** App-specific messaging wiring — copy this file to a new project and edit queue names only. */
export const APP_MESSAGING_CONFIG: MessagingModuleOptions = {
	clientId: process.env.MESSAGING_CLIENT_ID ?? "hello-world-api",
	connectionName: process.env.MESSAGING_CONNECTION_NAME ?? "hello-world-api",
	queueNames: QUEUE_NAMES,
	bullPrefix: "bull",
	healthQueueName: QUEUE_NAMES[0],
};
