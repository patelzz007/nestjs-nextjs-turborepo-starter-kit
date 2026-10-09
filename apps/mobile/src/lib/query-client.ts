// ============================================
// query-client.ts - the app's TanStack Query client
// ============================================
// Server state belongs to TanStack Query (rules/06). Project-wide defaults are
// set once here. Every query and mutation error passes one place first: a 426
// (UpgradeRequiredError, ADR 033) from ANY request switches the app to its
// blocking update screen.

import { ApiError, UpgradeRequiredError } from "@workspace/api-client";
import { AppVersionSchema } from "@workspace/shared";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { z } from "zod";

/** Data counts as fresh for 30 s; screens refetch on focus and pull-to-refresh after that. */
const STALE_TIME_MS = 30_000;

/** Unused cache entries are dropped after 5 minutes. */
const GC_TIME_MS = 300_000;

/** A failed query is retried this many times, unless the API refused it (4xx). */
const MAX_QUERY_RETRIES = 2;

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

/** `details` of a 426 (`APP_VERSION_UNSUPPORTED`): the API's minimum supported version. */
const UpgradeRequiredDetailsSchema = z.object({ minimumVersion: AppVersionSchema });

/** The minimum version a 426 names, or `null` when its details do not say. */
export function minimumVersionOf(error: UpgradeRequiredError): string | null {
	return UpgradeRequiredDetailsSchema.safeParse(error.details).data?.minimumVersion ?? null;
}

/** A 4xx is the API's answer — retrying cannot change it. */
function isClientError(error: Error): boolean {
	const status = error instanceof ApiError ? error.statusCode : undefined;
	return status !== undefined && status >= HTTP_CLIENT_ERROR_MIN && status < HTTP_SERVER_ERROR_MIN;
}

export function shouldRetryQuery(failureCount: number, error: Error): boolean {
	return failureCount < MAX_QUERY_RETRIES && !isClientError(error);
}

export interface MobileQueryClientOptions {
	/** A request was refused with 426: the app must show the update screen. */
	readonly onUpgradeRequired: (minimumVersion: string | null) => void;
}

export function createMobileQueryClient(options: MobileQueryClientOptions): QueryClient {
	const handleError = (error: Error): void => {
		if (error instanceof UpgradeRequiredError) {
			options.onUpgradeRequired(minimumVersionOf(error));
		}
	};
	return new QueryClient({
		queryCache: new QueryCache({ onError: handleError }),
		mutationCache: new MutationCache({ onError: handleError }),
		defaultOptions: {
			queries: { staleTime: STALE_TIME_MS, gcTime: GC_TIME_MS, retry: shouldRetryQuery },
			mutations: { retry: false },
		},
	});
}
