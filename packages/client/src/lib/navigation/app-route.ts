import type { Route } from "next";

function isRoute(path: string): path is Route {
	return path.length > 0;
}

/**
 * A path known only at runtime (menu data, a `returnTo`, a path built from shared constants) as a typed
 * route. Next.js checks literal links against the real pages at compile time; a runtime string can't be
 * checked that way, so this is the one door it goes through. The apps' route-coverage tests hold these
 * paths to real pages.
 */
export function appRoute(path: string): Route {
	if (!isRoute(path)) {
		throw new Error("A route cannot be empty");
	}
	return path;
}
