// API path templates owned by the `files` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.files`. */
export const filesRoutes = {
	uploadUrl: "/files/upload-url",
	complete: "/files/:fileId/complete",
	detail: "/files/:fileId",
	downloadUrl: "/files/:fileId/download-url",
	delete: "/files/:fileId",
	processingCallback: "/files/processing-callback",
} satisfies Record<string, RouteTree>;
