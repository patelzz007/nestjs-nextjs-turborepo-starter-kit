// Test doubles for the SSR query pipeline. The real pipeline's error classes are
// private to `@workspace/client` (its own suite covers how a response becomes a
// `PrefetchFailure`); a page or helper test only needs "the query failed with
// this failure". `failedQuery` builds that rejection and `withTestFailureClassifier`
// makes `classifyError` report it, while every other export stays real.

import type { PrefetchFailure } from "@workspace/client/lib/api/server-api";

type ServerApiModule = typeof import("@workspace/client/lib/api/server-api");

/** A rejection that carries the failure the (test) classifier reports for it. */
export class ClassifiedQueryError extends Error {
	public readonly failure: PrefetchFailure;

	public constructor(failure: PrefetchFailure) {
		super(`test query failure: ${failure.kind}`);
		this.name = "ClassifiedQueryError";
		this.failure = failure;
	}
}

/** A server query (resolving to `TData` on success) that fails with `failure`. */
export function failedQuery<TData>(failure: PrefetchFailure): Promise<TData> {
	return Promise.reject<TData>(new ClassifiedQueryError(failure));
}

/** A server query the API answered with an HTTP error `status`. */
export function httpFailure(status: number): PrefetchFailure {
	return { kind: "http", status };
}

/** `@workspace/client/lib/api/server-api` with `classifyError` reading {@link ClassifiedQueryError}s. */
export function withTestFailureClassifier(actual: ServerApiModule): ServerApiModule {
	return {
		...actual,
		classifyError: (error: Error | undefined): PrefetchFailure => (error instanceof ClassifiedQueryError ? error.failure : actual.classifyError(error)),
	};
}
