import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

/** A fresh TanStack Query client per render: no retries, nothing shared between tests. */
export function createTestQueryClient(): QueryClient {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Wraps a tree in its own test query client (the tenant context subscribes to the cache). */
export function TestQueryClientProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	const [client] = React.useState(createTestQueryClient);
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
