import "server-only";

import { redirect } from "next/navigation";

import { hasServerAccessSession } from "@/lib/auth/server";
import { loginPath } from "@/lib/routes";

/**
 * Server-side guard every signed-in page (everything under `/rewardhub` and
 * `/hello`) calls FIRST, before it fetches or renders anything:
 *
 * ```tsx
 * await guardWebPage(ROUTES.rewardHub.wallet);
 * ```
 *
 * Without a usable session it redirects to sign-in with `returnPath` as the
 * `redirect` parameter, so the user comes back to the page after signing in.
 * It runs per page, not in the `/rewardhub` layout: layouts do not re-render
 * on client-side navigation, so a layout check would be skipped when a user
 * moves between pages. The proxy gates the same routes first; this guard keeps
 * a page safe if the proxy's matcher or route list ever stops covering it.
 * UX only — the API authorizes every request.
 */
export async function guardWebPage(returnPath: string): Promise<void> {
	if (!(await hasServerAccessSession())) {
		redirect(loginPath(returnPath));
	}
}
