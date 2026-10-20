// API path templates owned by the `reference-data` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

// ── Geo ────────────────────────────────────────────────────────────

/** Path templates composed into `apiRoutes.geo`. */
export const geoRoutes = {
	stats: "/geo/stats",
	autocomplete: "/geo/autocomplete",
	import: "/geo/import",
	importValidate: "/geo/import/validate",
	export: "/geo/export",
	cascadePreview: "/geo/cascade-preview",
	regions: "/geo/regions",
	regionDetail: "/geo/regions/:id",
	subregions: "/geo/subregions",
	subregionDetail: "/geo/subregions/:id",
	countries: "/geo/countries",
	countryDetail: "/geo/countries/:id",
	states: "/geo/states",
	stateDetail: "/geo/states/:id",
	cities: "/geo/cities",
	cityDetail: "/geo/cities/:id",
} satisfies Record<string, RouteTree>;
