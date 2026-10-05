import "server-only";

import { settleServerQuery, type ExpectedServerQueryFailure } from "@workspace/client/lib/api/server-query-outcome";

// ============================================
// lib/server/server-query-outcome.ts - the merchant's prefetch helpers over `settleServerQuery`
// ============================================
// `settleServerQuery` (`@workspace/client/lib/api/server-query-outcome`) returns
// the data or a failure the page declared as expected, and logs + rethrows every
// other failure so the nearest `error.tsx` renders it instead of the page
// silently showing an empty state built from missing data (e.g. "you have no
// organization" during an API outage). Merchant pages treat every access
// failure as "the client query loads it / the guard decides", so these helpers
// declare all three as expected.

/** Every failure a merchant page may treat as "the client loads it / the guard decides". */
export const EXPECTED_ACCESS_FAILURES: readonly ExpectedServerQueryFailure[] = ["unauthenticated", "forbidden", "not-found"];

/**
 * The settled result as `toPrefetchedQuery` / `initialData` input: the result
 * itself when it succeeded or failed in an expected way (the client query then
 * loads the data and renders the access state), after rethrowing every
 * unexpected failure. Lets a page keep the `Promise.allSettled` +
 * `toPrefetchedQuery` shape without swallowing an outage.
 */
export function rethrowUnexpectedFailure<TData>(result: PromiseSettledResult<TData>, label: string): PromiseSettledResult<TData> {
	settleServerQuery(result, { label, expected: EXPECTED_ACCESS_FAILURES });
	return result;
}

/** The data of a settled query, `undefined` for an expected failure; unexpected failures are logged and rethrown. */
export function prefetchedDataOrUndefined<TData>(result: PromiseSettledResult<TData>, label: string): TData | undefined {
	const outcome = settleServerQuery(result, { label, expected: EXPECTED_ACCESS_FAILURES });
	return outcome.kind === "ok" ? outcome.data : undefined;
}
