import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";

import { NotFoundPage } from "./components/not-found-page";
import { routeTree } from "./routeTree.gen";

/** The router's context: the query client every route and component shares. */
export interface RouterContext {
	readonly queryClient: QueryClient;
}

/**
 * The docs' router (TanStack Start calls this once per request on the server and once in the browser).
 * Paths never end in a slash (`/docs/README`, the URLs the Astro site published); hovering a link
 * preloads its page's data; TanStack Query owns client-fetched data (the search and endpoint indexes).
 * In-page jumps (the "On this page" timeline, `#` anchors) scroll smoothly through the CSS
 * `scroll-behavior`; a page change restores its position instantly instead of gliding there.
 */
export function getRouter(): ReturnType<typeof createRouter<typeof routeTree, "never">> {
	const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: 1 } } });
	return createRouter({
		routeTree,
		context: { queryClient } satisfies RouterContext,
		trailingSlash: "never",
		scrollRestoration: true,
		scrollRestorationBehavior: "instant",
		defaultPreload: "intent",
		defaultNotFoundComponent: NotFoundPage,
		Wrap: ({ children }: { readonly children: ReactNode }): ReactElement => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
