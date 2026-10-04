import "server-only";

import { createServerCaller, type ServerCaller } from "@workspace/client/lib/api/server-api";

export type AdminServerCaller = ServerCaller;

/** Read-only server-side API caller for the admin app (forwards admin auth cookies). */
export function createAdminServerCaller(): AdminServerCaller {
	return createServerCaller({ clientType: "admin" });
}
