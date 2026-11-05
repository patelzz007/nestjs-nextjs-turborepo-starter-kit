import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider, type AnyRouter } from "@tanstack/react-router";
import { act, render, type RenderResult } from "@testing-library/react";
import { UiKitLabelsProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import type { ReactElement, ReactNode } from "react";

import { IconSprite } from "../icon-sprite";
import { SearchProvider } from "../search-provider";

export interface RenderedWithRouter extends RenderResult {
	readonly router: AnyRouter;
	readonly queryClient: QueryClient;
}

/**
 * Renders `ui` inside a real TanStack router (memory history at `path`), the query client, the kit's
 * labels and the search provider — the context every docs component runs in. Any other path renders an
 * empty page, so links can be followed and the resulting location asserted.
 */
export async function renderWithRouter(ui: ReactNode, path = "/"): Promise<RenderedWithRouter> {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	function Shell(): ReactElement {
		return (
			<UiKitLabelsProvider labels={UI_KIT_LABELS_EN}>
				<QueryClientProvider client={queryClient}>
					<SearchProvider>
						<IconSprite names={["shieldCheck", "server"]} />
						<Outlet />
					</SearchProvider>
				</QueryClientProvider>
			</UiKitLabelsProvider>
		);
	}
	function Page(): ReactElement {
		return <>{ui}</>;
	}
	const root = createRootRoute({ component: Shell });
	const page = createRoute({ getParentRoute: () => root, path: new URL(path, "http://test").pathname, component: Page });
	const elsewhere = createRoute({ getParentRoute: () => root, path: "$", component: (): ReactElement => <p>Elsewhere</p> });
	const router = createRouter({ routeTree: root.addChildren([page, elsewhere]), history: createMemoryHistory({ initialEntries: [path] }) });
	let result: RenderResult | undefined;
	await act(async () => {
		result = render(<RouterProvider router={router} />);
		await router.load();
	});
	if (result === undefined) {
		throw new Error("render did not run");
	}
	return { ...result, router, queryClient };
}
