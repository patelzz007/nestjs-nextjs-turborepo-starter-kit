// ============================================
// lib/server/prefetch.ts - server-side prefetch with classified, logged failures
// ============================================
// Server components prefetch API data so the first paint has it. A failed
// prefetch must never be swallowed: it is classified (unauthenticated,
// forbidden, not found, or failed), logged with the page and the call, and
// handed back as a discriminated union so the page decides what to do —
// usually `resolvePrefetchedData`, which redirects a dead session to login,
// renders the 404 page for a missing resource, and otherwise lets the client
// query (which owns the error UI and the retry) take over.

import "server-only";

import { classifyError, describeFailure, type PrefetchFailure } from "@workspace/client/lib/api/server-api";
import { expectedFailureKind } from "@workspace/client/lib/api/server-query-outcome";
import type { PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { notFound, redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/** Outcome of one server prefetch. */
export type PrefetchResult<TData> =
	| { readonly status: "ok"; readonly data: TData }
	| { readonly status: "unauthenticated" }
	| { readonly status: "forbidden" }
	| { readonly status: "not-found" }
	| { readonly status: "failed"; readonly failure: PrefetchFailure };

/** Where a prefetch ran — both appear in the log line. */
export interface PrefetchSite {
	/** The page route pattern (`/users/[id]`). */
	readonly page: string;
	/** What was fetched (`user detail`). */
	readonly resource: string;
}

/** Writes the failure to the server log: auth outcomes as warnings, everything else as errors. */
export type PrefetchFailureLogger = (level: "warn" | "error", message: string) => void;

function logToConsole(level: "warn" | "error", message: string): void {
	if (level === "warn") {
		console.warn(message);
		return;
	}
	console.error(message);
}

/**
 * Maps a classified failure onto the outcome the page acts on: the shared
 * expected-failure categories (no cookie / 401, 403, 404), else `failed`.
 */
export function prefetchResultFromFailure<TData>(failure: PrefetchFailure): PrefetchResult<TData> {
	const kind = expectedFailureKind(failure);
	return kind === undefined ? { status: "failed", failure } : { status: kind };
}

/** Runs `load`, classifying and logging a rejection instead of swallowing it. */
export async function prefetch<TData>(site: PrefetchSite, load: () => Promise<TData>, log: PrefetchFailureLogger = logToConsole): Promise<PrefetchResult<TData>> {
	try {
		return { status: "ok", data: await load() };
	} catch (error) {
		const failure: PrefetchFailure = classifyError(error instanceof Error ? error : undefined);
		const result: PrefetchResult<TData> = prefetchResultFromFailure(failure);
		log(result.status === "failed" ? "error" : "warn", `[admin] prefetch of ${site.resource} for ${site.page} ${result.status} (${describeFailure(failure)})`);
		return result;
	}
}

/**
 * The prefetched data for the page's initial render, or `undefined` when the
 * client query should load it (forbidden: the client guard renders the
 * access-denied state; failed: the client query shows its error state and
 * retries). A dead session redirects to login and a missing resource renders
 * the 404 page — both throw, so nothing after this call runs.
 */
export function resolvePrefetchedData<TData>(result: PrefetchResult<TData>): TData | undefined {
	switch (result.status) {
		case "ok":
			return result.data;
		case "unauthenticated":
			return redirect(ROUTES.auth.login);
		case "not-found":
			return notFound();
		case "forbidden":
		case "failed":
			return undefined;
	}
}

/**
 * {@link resolvePrefetchedData} for a list page bound to its URL state: the
 * `PrefetchedQuery` the client view may use while it renders `stateKey`, or
 * `undefined` when the client should fetch.
 */
export function resolvePrefetchedQuery<TData>(stateKey: string, result: PrefetchResult<TData>): PrefetchedQuery<TData> | undefined {
	const data: TData | undefined = resolvePrefetchedData(result);
	return data === undefined ? undefined : { stateKey, data };
}
