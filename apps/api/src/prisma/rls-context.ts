import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request RLS session. Postgres policies read `app.current_user_id` and
 * `app.rls_bypass` (set on every pool checkout). Cron, seed, and boot have no
 * store — `currentRlsContext()` then bypasses so housekeeping still works.
 */
export interface RlsContext {
	readonly userId: string;
	readonly bypass: boolean;
}

export const rlsStorage: AsyncLocalStorage<RlsContext> = new AsyncLocalStorage<RlsContext>();

const BYPASS_WHEN_UNSET: RlsContext = { userId: "", bypass: true };

export function currentRlsContext(): RlsContext {
	return rlsStorage.getStore() ?? BYPASS_WHEN_UNSET;
}
