import { segmentsOfPath } from "@workspace/ui/lib/sidebar/navigation/breadcrumb-tree";

/**
 * Route patterns in the App Router's own notation: `/users/[id]/edit`.
 *
 * A `[name]` segment matches any single path segment; every other segment
 * must match literally. Apps describe their pages (and the access rule of
 * each page) with these patterns, so the same table can drive the route
 * guard, the sidebar filter, the command palette and the breadcrumbs.
 * Catch-all segments (`[...slug]`) are deliberately not supported — a rule
 * that matches "anything below" is what prefix matching is for.
 */

/** How a pattern is compared with a pathname. */
export type RoutePatternMatchMode = "exact" | "prefix";

/**
 * How specifically a pattern matched a pathname. Deeper wins; at equal depth
 * the pattern with more literal segments wins (`/x/new` beats `/x/[id]`).
 */
export interface RoutePatternMatch {
	readonly depth: number;
	readonly staticSegments: number;
}

const DYNAMIC_SEGMENT_PATTERN = /^\[[^.[\]][^[\]]*\]$/;

/** Characters that end the path part of an href (query string / fragment). */
const PATH_TERMINATOR_PATTERN = /[?#]/;

/** True for a single dynamic segment such as `[id]` (not a catch-all). */
export function isDynamicRouteSegment(segment: string): boolean {
	return DYNAMIC_SEGMENT_PATTERN.test(segment);
}

/** The pattern segment for a dynamic parameter: `routeParam("id")` → `[id]`. */
export function routeParam(name: string): string {
	return `[${name}]`;
}

/** The path part of an href, without query string or fragment. */
function pathOf(href: string): string {
	const [path] = href.split(PATH_TERMINATOR_PATTERN);
	return path ?? href;
}

/**
 * Compares `pattern` with `pathname` segment by segment. In `prefix` mode the
 * pattern may stop early (`/users` covers `/users/42`), except the root
 * pattern `/`, which only ever covers `/` — otherwise it would cover every
 * page of the app. Returns `null` when the pattern does not apply.
 */
export function matchRoutePattern(pattern: string, pathname: string, mode: RoutePatternMatchMode): RoutePatternMatch | null {
	const patternSegments = segmentsOfPath(pathOf(pattern));
	const pathSegments = segmentsOfPath(pathOf(pathname));

	if (patternSegments.length === 0) {
		return pathSegments.length === 0 ? { depth: 0, staticSegments: 0 } : null;
	}
	if (mode === "exact" ? patternSegments.length !== pathSegments.length : patternSegments.length > pathSegments.length) {
		return null;
	}

	let staticSegments = 0;
	for (const [index, expected] of patternSegments.entries()) {
		if (isDynamicRouteSegment(expected)) {
			continue;
		}
		if (pathSegments[index] !== expected) {
			return null;
		}
		staticSegments += 1;
	}
	return { depth: patternSegments.length, staticSegments };
}

function isMoreSpecific(candidate: RoutePatternMatch, current: RoutePatternMatch): boolean {
	if (candidate.depth !== current.depth) {
		return candidate.depth > current.depth;
	}
	return candidate.staticSegments > current.staticSegments;
}

/**
 * The entry whose pattern matches `pathname` most specifically, or `null`.
 * O(n · d) for n entries and path depth d. On an exact tie the first entry wins.
 */
export function findMostSpecificRoute<TEntry>(
	entries: readonly TEntry[],
	getPattern: (entry: TEntry) => string,
	pathname: string,
	mode: RoutePatternMatchMode,
): TEntry | null {
	let best: TEntry | null = null;
	let bestMatch: RoutePatternMatch | null = null;
	for (const entry of entries) {
		const match = matchRoutePattern(getPattern(entry), pathname, mode);
		if (match === null) {
			continue;
		}
		if (bestMatch === null || isMoreSpecific(match, bestMatch)) {
			best = entry;
			bestMatch = match;
		}
	}
	return best;
}

/**
 * Fills each dynamic segment of `pattern` with `sample` — turns a page
 * pattern into a concrete pathname for tests and guard checks.
 */
export function samplePathForPattern(pattern: string, sample: string): string {
	const segments = segmentsOfPath(pathOf(pattern)).map((segment) => (isDynamicRouteSegment(segment) ? sample : segment));
	return `/${segments.join("/")}`;
}
