import { redirect } from "next/navigation";

/**
 * Legacy `/docs/search` route — search now lives **inline** on `/docs` (the
 * index filters the guide grid as you type, no separate page). A direct hit
 * here is redirected to the index instead of 404ing. Server-side `redirect()`
 * throws during render, so there is no client-side flash.
 */
export default function DocsSearchRedirect(): never {
	redirect("/docs");
}
