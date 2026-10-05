import "server-only";

import { z } from "zod";

import { classifyError, describeFailure, type PrefetchFailure } from "./server-api";

// ============================================
// lib/api/server-query-outcome.ts - what a server page does with a failed prefetch
// ============================================
// A server page or layout awaits its API calls with `Promise.allSettled` and
// hands each settled result to `settleServerQuery`. A failure the page EXPECTS
// and renders deliberately comes back as a value — the page redirects to
// sign-in, calls `notFound()`, renders the access notice, or lets the client
// query load the data. Every other failure (API down, timeout, 5xx, a response
// that breaks its contract, an unexpected status) is logged and rethrown, so
// the nearest `error.tsx` renders it instead of the page silently showing an
// empty state built from missing data.
//
// Shared by apps/web, apps/merchant (which adds its `prefetchedDataOrUndefined`
// helpers) and apps/admin (which reuses `expectedFailureKind` for its prefetch
// outcome). `classifyError` comes from `./server-api`, the same module the
// apps' tests replace with a test classifier.

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

/** One `{ kind }` member per expected failure, so a check on `kind` narrows the union. */
type ExpectedFailureOutcome<TExpected extends ExpectedServerQueryFailure> = { readonly [K in TExpected]: { readonly kind: K } }[TExpected];

/** A settled server query: its data, or one of the failures the page declared as expected. */
export type ServerQueryOutcome<TData, TExpected extends ExpectedServerQueryFailure> = { readonly kind: "ok"; readonly data: TData } | ExpectedFailureOutcome<TExpected>;

export interface ServerQueryPolicy<TExpected extends ExpectedServerQueryFailure> {
	/** Names the request in the server log (e.g. `"claims.list"`). */
	readonly label: string;
	/** The failures this page renders deliberately. Any other failure is unexpected and rethrown. */
	readonly expected: readonly TExpected[];
}

/** A server query rejects with an `Error`; any other rejection value is classified as an unexplained failure. */
const RejectionReasonSchema = z.instanceof(Error);

/** The cause recorded when a query rejected with something that is not an `Error`. */
const NON_ERROR_REJECTION_MESSAGE = "the request rejected with a non-Error value";

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

function expectedOutcome<TExpected extends ExpectedServerQueryFailure>(kind: TExpected): ExpectedFailureOutcome<TExpected> {
	return { kind };
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

	const parsedReason = RejectionReasonSchema.safeParse(result.reason);
	const reason: Error | undefined = parsedReason.success ? parsedReason.data : undefined;
	const failure: PrefetchFailure = classifyError(reason);
	const kind: ExpectedServerQueryFailure | undefined = expectedFailureKind(failure);
	const expected: TExpected | undefined = policy.expected.find((candidate: TExpected): boolean => candidate === kind);
	if (expected !== undefined) {
		return expectedOutcome(expected);
	}

	const error = new UnexpectedServerQueryError(policy.label, failure, reason ?? new Error(NON_ERROR_REJECTION_MESSAGE));
	console.error(error.message, error.cause);
	throw error;
}
