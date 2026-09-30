import { AsyncLocalStorage } from "node:async_hooks";

import { MissingTenantContextError } from "./missing-tenant-context.error";
import { isAllowlistedSystemOperation } from "./system-operation.registry";

/**
 * Per-request / per-job RLS context for the pool checkout path.
 * Authoritative isolation is enforced inside `TenantTransactionService` transactions.
 */
export interface RlsContext {
	readonly userId: string;
	readonly bypass: boolean;
	readonly organizationId: string;
	readonly requireExplicitContext: boolean;
	/** Allowlisted system operation that justified `bypass` (empty for user contexts). */
	readonly systemOperation: string;
}

export const rlsStorage: AsyncLocalStorage<RlsContext> = new AsyncLocalStorage<RlsContext>();

/** Context used when no scope was opened — sees only rows visible without a user. */
const UNSCOPED_CONTEXT: RlsContext = {
	userId: "",
	bypass: false,
	organizationId: "",
	requireExplicitContext: false,
	systemOperation: "",
};

/** Fail closed — callers must use tenant transactions or allowlisted system operations. */
export function currentRlsContext(): RlsContext {
	const store = rlsStorage.getStore();
	if (store === undefined) {
		throw new MissingTenantContextError();
	}
	return store;
}

/**
 * Pool checkout context. Without an open scope the connection is **not**
 * bypassed: it runs as an anonymous, non-bypass session so a query issued
 * outside any request/job scope can only see rows RLS exposes publicly.
 */
export function currentRlsContextOrUnscoped(): RlsContext {
	return rlsStorage.getStore() ?? UNSCOPED_CONTEXT;
}

/** Build the bypass context for an allowlisted system operation. */
export function systemRlsContext(operation: string, actorUserId = ""): RlsContext {
	if (!isAllowlistedSystemOperation(operation)) {
		throw new Error(`System operation not allowlisted: ${operation}`);
	}
	return { userId: actorUserId, bypass: true, organizationId: "", requireExplicitContext: false, systemOperation: operation };
}

/**
 * Run background work (queue jobs, cron maintenance) under an explicit,
 * allowlisted system operation. This is the only way non-request code
 * obtains an RLS bypass on the shared pool.
 */
export function runWithSystemRlsContext<T>(operation: string, handler: () => T): T {
	return rlsStorage.run(systemRlsContext(operation), handler);
}
