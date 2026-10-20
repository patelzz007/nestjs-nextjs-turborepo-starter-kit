// API path templates owned by the `catalog` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.sampleCategory`. */
export const sampleCategoryRoutes = {
	list: "/sample-category",
	detail: "/sample-category/:id",
	create: "/sample-category",
	bulkCreate: "/sample-category/bulk",
	bulkDelete: "/sample-category/bulk-delete",
	update: "/sample-category/:id",
	delete: "/sample-category/:id",
	restore: "/sample-category/:id/restore",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.product`. */
export const productRoutes = {
	list: "/product",
	detail: "/product/:id",
	create: "/product",
	bulkCreate: "/product/bulk",
	bulkDelete: "/product/bulk-delete",
	update: "/product/:id",
	delete: "/product/:id",
	restore: "/product/:id/restore",
} satisfies Record<string, RouteTree>;
