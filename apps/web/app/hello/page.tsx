import { settleServerQuery } from "@/lib/api/server-query-outcome";
import { guardWebPage } from "@/lib/auth/page-guard";
import { loginPath, ROUTES } from "@/lib/routes";
import { createWebServerCaller } from "@/lib/web-server-api";
import { redirect } from "next/navigation";

import HelloView from "./hello-view";

export const dynamic = "force-dynamic";

/**
 * `/hello` — server component. Fetches `/auth/me` through the web cookie set
 * and passes it as initial data to the client view, so the profile renders on
 * first paint with no client round-trip. A visitor without a usable session is
 * sent to sign-in (and back here afterwards); any other failure reaches the
 * app's `error.tsx`.
 */
export default async function HelloPage(): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.hello);

	const [result] = await Promise.allSettled([createWebServerCaller().auth.me.query(undefined)]);
	const me = settleServerQuery(result, { label: "auth.me", expected: ["unauthenticated"] });
	if (me.kind === "unauthenticated") {
		redirect(loginPath(ROUTES.hello));
	}

	return <HelloView initialEnvelope={me.data} />;
}
