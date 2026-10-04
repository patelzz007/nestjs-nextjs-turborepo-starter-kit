import "server-only";

import { createServerCaller, type ServerCaller } from "@workspace/client/lib/api/server-api";

export type WebServerCaller = ServerCaller;

/** Read-only server-side API caller for the consumer web app (forwards web auth cookies). */
export function createWebServerCaller(): WebServerCaller {
	return createServerCaller({ clientType: "web" });
}
