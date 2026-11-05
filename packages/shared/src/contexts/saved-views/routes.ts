// API path templates owned by the `saved-views` context (enhancement 5.10). Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

export const savedViewsRoutes = {
	/** A list's saved views: the signed-in person's own and the ones other staff shared (GET); saving one (POST). */
	list: "/me/saved-views",
	/** Removing one of your own. */
	view: "/me/saved-views/:viewId",
} satisfies Record<string, RouteTree>;
