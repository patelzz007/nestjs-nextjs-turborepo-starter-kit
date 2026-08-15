import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";
import { prefetchWebPage } from "@workspace/client/lib/api/server-api";

import HelloView from "./hello-view";

export const dynamic = "force-dynamic";

/**
 * `/hello` — server component. The `/auth/me` payload is prefetched through the
 * browser auth cookies (web cookie set via `prefetchWebPage`) and
 * dehydrated into the client's Query cache, so the profile renders on first
 * paint with no client round-trip. Unauthenticated visitors degrade gracefully:
 * the failed prefetch is dropped from the dehydrated state and the client's own
 * `useQuery` (with its 401 → silent-refresh pipeline) takes over.
 */
export default async function HelloPage(): Promise<React.JSX.Element> {
	const { state, report } = await prefetchWebPage((server) => [server.auth.me(undefined)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<HelloView />
		</PrefetchBoundary>
	);
}
