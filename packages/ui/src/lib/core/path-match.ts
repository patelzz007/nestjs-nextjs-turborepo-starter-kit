/** Characters that end a path segment: the end, `/`, or the start of a query / fragment. */
const SEGMENT_BOUNDARIES: ReadonlySet<string> = new Set<string>(["", "/", "?", "#"]);

/**
 * Segment-aware prefix test — the one implementation every app uses
 * (`pathname` first, then the `prefix` it may sit under): `/rewardhub`
 * contains `/rewardhub`, `/rewardhub/wallet` and `/rewardhub?tab=1`, never
 * `/rewardhubs`; `/` contains only `/` itself (and its query / fragment).
 */
export function isPathWithin(pathname: string, prefix: string): boolean {
	if (!pathname.startsWith(prefix)) {
		return false;
	}
	const boundary = pathname.charAt(prefix.length);
	if (prefix === "/") {
		return boundary !== "/" && SEGMENT_BOUNDARIES.has(boundary);
	}
	return SEGMENT_BOUNDARIES.has(boundary);
}
