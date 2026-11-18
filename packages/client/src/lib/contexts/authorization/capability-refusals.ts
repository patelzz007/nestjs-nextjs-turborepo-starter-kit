"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { isCapabilityRefusal } from "@workspace/api-client";
import * as React from "react";
import { z } from "zod";

/**
 * Keeps the session's capabilities current: when the API refuses a request because of them
 * (`isCapabilityRefusal`: a role was changed, a grant revoked), the app reads them again, so the actions the member
 * may no longer use disappear instead of failing one by one.
 */

const QueryErrorSchema = z.instanceof(Error);

/** Calls `onRefused` whenever a query or a mutation of `queryClient` fails with a capability refusal; returns the unsubscribe. */
export function subscribeToCapabilityRefusals(queryClient: QueryClient, onRefused: () => void): () => void {
	// The caches type errors loosely: each is validated (an Error) before it is read.
	const report = (error: z.ZodSafeParseResult<Error>): void => {
		if (error.success && isCapabilityRefusal(error.data)) {
			onRefused();
		}
	};
	const stopQueries = queryClient.getQueryCache().subscribe((event): void => {
		if (event.type === "updated" && event.action.type === "error") {
			report(QueryErrorSchema.safeParse(event.action.error));
		}
	});
	const stopMutations = queryClient.getMutationCache().subscribe((event): void => {
		if (event.type === "updated" && event.action.type === "error") {
			report(QueryErrorSchema.safeParse(event.action.error));
		}
	});
	return (): void => {
		stopQueries();
		stopMutations();
	};
}

/** Re-reads the session's capabilities (`refresh`) whenever the API refuses an action because of them. */
export function useRefreshOnCapabilityRefusal(refresh: () => void): void {
	const queryClient = useQueryClient();
	React.useEffect((): (() => void) => subscribeToCapabilityRefusals(queryClient, refresh), [queryClient, refresh]);
}
