import "server-only";

import { classifyError, describeFailure, type PrefetchFailure } from "@workspace/client/lib/api/server-api";
import { z } from "zod";

// ============================================
// lib/server/server-query-outcome.ts - what a merchant server page does with a failed API call
// ============================================
// A server page or layout awaits its API calls with `Promise.allSettled` and
// hands each settled result to `settleServerQuery`. A failure the page EXPECTS
// and renders deliberately comes back as a value — the page renders the access
// notice, calls `notFound()`, or lets the client query load the data. Every
// other failure (API down, timeout, 5xx, a response that breaks its contract,
// an unexpected status) is logged and rethrown, so the nearest `error.tsx`
// renders it instead of the page silently showing an empty state built from
// missing data (e.g. "you have no organization" during an API outage).
//
// Same contract as apps/web `lib/api/server-query-outcome.ts`; both are
// candidates to move into `@workspace/client/lib/api` (one copy per app today).

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

/**
 * The failures a page may declare as expected:
 * - `unauthenticated` — no access token, or the API rejected it (401) even after the SSR refresh;
 * - `forbidden` — the session may not read this resource (403);
 * - `not-found` — the requested resource does not exist for this user (404).
 */
export type ExpectedServerQueryFailure = "unauthenticated" | "forbidden" | "not-found";

/** A settled server query: its data, or one of the failures the page declared as expected. */
export type ServerQueryOutcome<TData, TExpected extends ExpectedServerQueryFailure> = { readonly kind: "ok"; readonly data: TData } | { readonly kind: TExpected };

export interface ServerQueryPolicy<TExpected extends ExpectedServerQueryFailure> {
	/** Names the request in the server log (e.g. `"organizations.analytics"`). */
	readonly label: string;
	/** The failures this page renders deliberately. Any other failure is unexpected and rethrown. */
	readonly expected: readonly TExpected[];
}

/** Every failure a merchant page may treat as "the client loads it / the guard decides". */
export const EXPECTED_ACCESS_FAILURES: readonly ExpectedServerQueryFailure[] = ["unauthenticated", "forbidden", "not-found"];

/** A server query rejects with an `Error` (or, from a raw promise, a string) — anything else is a bug in the caller. */
const RejectionReasonSchema = z.union([z.instanceof(Error), z.string()]);

/** The rejection as an `Error` (a bare string reason is wrapped, keeping its text). */
function toRejectionError(reason: Error | string): Error {
	return typeof reason === "string" ? new Error(reason) : reason;
}

/** Thrown when a server query failed in a way the page did not declare as expected. */
export class UnexpectedServerQueryError extends Error {
	public readonly failure: PrefetchFailure;

	public constructor(label: string, failure: PrefetchFailure, cause: Error) {
		super(`${label} failed during server render: ${describeFailure(failure)}`, { cause });
		this.name = "UnexpectedServerQueryError";
		this.failure = failure;
	}
}

/** The expected-failure category of a prefetch failure, or `undefined` when it is not one of the three. */
export function expectedFailureKind(failure: PrefetchFailure): ExpectedServerQueryFailure | undefined {
	if (failure.kind === "no-cookie") {
		return "unauthenticated";
	}
	if (failure.kind !== "http") {
		return undefined;
	}
	switch (failure.status) {
		case HTTP_UNAUTHORIZED:
			return "unauthenticated";
		case HTTP_FORBIDDEN:
			return "forbidden";
		case HTTP_NOT_FOUND:
			return "not-found";
		default:
			return undefined;
	}
}

/**
 * The outcome of one `Promise.allSettled` entry. Returns the data or a declared
 * expected failure; logs and throws {@link UnexpectedServerQueryError} for
 * everything else, so the route's `error.tsx` renders it.
 */
export function settleServerQuery<TData, TExpected extends ExpectedServerQueryFailure>(
	result: PromiseSettledResult<TData>,
	policy: ServerQueryPolicy<TExpected>,
): ServerQueryOutcome<TData, TExpected> {
	if (result.status === "fulfilled") {
		return { kind: "ok", data: result.value };
	}

	const reason: Error = toRejectionError(RejectionReasonSchema.parse(result.reason));
	const failure: PrefetchFailure = classifyError(reason);
	const kind: ExpectedServerQueryFailure | undefined = expectedFailureKind(failure);
	const expected: TExpected | undefined = policy.expected.find((candidate: TExpected): boolean => candidate === kind);
	if (expected !== undefined) {
		return { kind: expected };
	}

	const error = new UnexpectedServerQueryError(policy.label, failure, reason);
	console.error(error.message, reason);
	throw error;
}

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
