import { AsyncLocalStorage } from "node:async_hooks";

import { MissingTenantContextError } from "./missing-tenant-context.error";

/**
 * Per-request RLS hint for the legacy pool checkout path.
 * Authoritative isolation is enforced inside `TenantTransactionService` transactions.
 */
export interface RlsContext {
	readonly userId: string;
	readonly bypass: boolean;
	readonly organizationId: string;
	readonly requireExplicitContext: boolean;
}

export const rlsStorage: AsyncLocalStorage<RlsContext> = new AsyncLocalStorage<RlsContext>();

/** Fail closed — callers must use tenant transactions or allowlisted system operations. */
export function currentRlsContext(): RlsContext {
	const store = rlsStorage.getStore();
	if (store === undefined) {
		throw new MissingTenantContextError();
	}
	return store;
}

/** Legacy path for health probes and explicit @RlsBypass handlers only. */
export function currentRlsContextOrBypass(operation: string): RlsContext {
	const store = rlsStorage.getStore();
	if (store !== undefined) {
		return store;
	}
	return {
		userId: "",
		bypass: true,
		organizationId: "",
		requireExplicitContext: false,
	};
}
