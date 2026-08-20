import { createServerCaller, DEFAULT_WEB_SERVER_API_CONFIG } from "@workspace/client/lib/api/server-api";

import HelloView from "./hello-view";

export const dynamic = "force-dynamic";

/**
 * `/hello` — server component. Fetches `/auth/me` through the web cookie set
 * and passes it as initial data to the client view, so the profile renders on
 * first paint with no client round-trip. Unauthenticated visitors degrade
 * gracefully: the failed fetch returns null and the client's own `useQuery`
 * (with its 401 → silent-refresh pipeline) takes over.
 */
export default async function HelloPage(): Promise<React.JSX.Element> {
	const server = createServerCaller(DEFAULT_WEB_SERVER_API_CONFIG);
	const data = await server.auth.me.query(undefined);

	return <HelloView initialEnvelope={data} />;
}
