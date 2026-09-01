// ============================================
// common/api-docs.ts - Swagger / docs wiring
// ============================================
// Swagger lives here so `main.ts` doesn't hand-roll a path. The docs URL is
// DERIVED from the shared version constant (`apiDocsPath()` → `/v1/docs`), so
// a version bump touches exactly one place.

import type { INestApplication } from "@nestjs/common";
import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { apiDocsPath } from "@workspace/shared";

/** Mount Swagger at the version-derived docs path (`apiDocsPath()` → `/v1/docs`). */
export function setupApiDocs(app: INestApplication, document: OpenAPIObject): void {
	SwaggerModule.setup(apiDocsPath().replace(/^\//, ""), app, document, {
		customSiteTitle: "Freebuff API",
		swaggerOptions: {
			withCredentials: true,
		},
	});
}
