import { RedirectsSchema, type Redirect } from "@workspace/docs-content/redirects";

import rawRedirects from "../../../../docs/sync/redirects.json";

/**
 * Old addresses of pages whose slug changed. The docs sync writes `docs/sync/redirects.json` (ADR 084) and has
 * already checked it for loops, clashes and missing targets, so an old link always lands on the page.
 */

const REDIRECTS: readonly Redirect[] = RedirectsSchema.parse(rawRedirects);

/** A slug change is permanent: search engines should move to the new address. */
export const PERMANENT_REDIRECT_STATUS = 301;

/** Where `pathname` moved to in `redirects`, or null when it did not move. */
export function redirectTargetIn(redirects: readonly Redirect[], pathname: string): string | null {
	return redirects.find((redirect) => redirect.from === pathname)?.to ?? null;
}

/** Where `pathname` moved to, or null when it did not move. */
export function redirectTarget(pathname: string): string | null {
	return redirectTargetIn(REDIRECTS, pathname);
}
