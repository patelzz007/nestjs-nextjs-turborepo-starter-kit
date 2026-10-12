// Every TanStack Query client a test creates is owned here and disposed after
// each test (jest.setup.ts). A cached query or mutation schedules a garbage-
// collection timer (`gcTime`, 5 minutes in the app); left running, those timers
// outlive the test file and Jest has to force-exit its worker.
//
// Disposal is the app's own `clearQueryClient` (src/lib/query-client.ts), which
// also stops the timers of mutations — `QueryClient.clear()` alone does not.

import { QueryClient } from "@tanstack/react-query";

import { clearQueryClient } from "../src/lib/query-client";

const liveQueryClients = new Set<QueryClient>();

/** Registers a client for disposal after the current test; returns it unchanged. */
export function trackQueryClient(queryClient: QueryClient): QueryClient {
	liveQueryClients.add(queryClient);
	return queryClient;
}

/** A plain `QueryClient` (library defaults) that is disposed after the current test. */
export function createTestQueryClient(): QueryClient {
	return trackQueryClient(new QueryClient());
}

/** Stops every timer the registered clients scheduled and forgets them. Called after every test. */
export function disposeTrackedQueryClients(): void {
	for (const queryClient of liveQueryClients) {
		clearQueryClient(queryClient);
	}
	liveQueryClients.clear();
}
