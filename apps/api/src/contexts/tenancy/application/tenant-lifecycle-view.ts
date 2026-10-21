import type { TenantLifecycleResponse } from "@workspace/shared";

import type { TenantLifecycleReadPort } from "./ports/tenant-lifecycle-read.port";
import { notFound } from "./tenant-actor";

/** The tenant's lifecycle view after a change committed; a tenant that vanished meanwhile is a 404. */
export async function readLifecycleOrNotFound(reads: TenantLifecycleReadPort, tenantId: string): Promise<TenantLifecycleResponse> {
	const view = await reads.findLifecycle(tenantId);
	if (view === null) {
		throw notFound();
	}
	return view;
}
