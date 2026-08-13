import { AsyncLocalStorage } from "node:async_hooks";

import type { TelescopeCacheOp, TelescopeJsonValue, TelescopeLogEntry, TelescopeSpan } from "@workspace/shared";

/**
 * Per-request capture state, carried through the async chain via
 * AsyncLocalStorage. Any code that runs inside a captured request (guards,
 * interceptors, services, Prisma query events) can read the current store and
 * append spans — no manual timer passing.
 */
export interface SpanStore {
	readonly correlationId: string;
	/** `performance.now()` at request start. */
	readonly startedAt: number;
	readonly spans: TelescopeSpan[];
	/** Sampling decision — false means record nothing for this request. */
	readonly captured: boolean;
	/** User id from the JWT payload, attached once AuthGuard has run. */
	userId: string | null;
	/** Captured request-body JSON (set by the capture middleware when allowed). */
	requestBody: TelescopeJsonValue | null;
	/** Console output that ran inside this request (improvement 16). */
	logs: TelescopeLogEntry[];
	/** Cache ops recorded by `TelescopeCacheTracer` inside this request (feature 5). */
	cacheOps: TelescopeCacheOp[];
}

/**
 * Tiny AsyncLocalStorage wrapper. `run()` opens a scope; `span()` measures an
 * operation and appends to the active store's span list. When no store is
 * active (request outside the captured flow, or Telescope disabled) `span()`
 * is a zero-cost pass-through.
 */
export class RequestSpanContext {
	public static readonly storage: AsyncLocalStorage<SpanStore> = new AsyncLocalStorage<SpanStore>();

	/** Opens a request scope. Callers (the capture middleware) must `await` or keep `next()` inside `fn`. */
	public static run<T>(store: SpanStore, fn: () => T): T {
		return this.storage.run(store, fn);
	}

	/** Returns the active store for the current async context, if any. */
	public static getStore(): SpanStore | undefined {
		return this.storage.getStore();
	}

	/**
	 * Measures `fn` and appends a span to the active request. Sampled-out
	 * requests (or requests outside a captured flow) run `fn` untouched.
	 */
	public static async span<T>(name: string, kind: TelescopeSpan["kind"], fn: () => Promise<T>): Promise<T> {
		const store = this.storage.getStore();
		// Sampled-out requests (or no active scope) run `fn` untouched.
		if (store?.captured !== true) {
			return fn();
		}
		const start: number = performance.now();
		try {
			return await fn();
		} finally {
			store.spans.push({
				name,
				kind,
				startOffsetMs: Math.round(start - store.startedAt),
				durationMs: Math.round(performance.now() - start),
			});
		}
	}
}
