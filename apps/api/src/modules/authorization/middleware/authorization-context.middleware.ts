import { Injectable, NestMiddleware } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Authorization Context Middleware
 *
 * Extracts common authorization context from the request and attaches it
 * to `request.authorizationContext` for use by the AuthorizationGuard.
 *
 * This avoids repetitive context extraction in every @Authorize decorator.
 *
 * ## Context Extraction Strategy:
 * 1. organizationId: body.organizationId → params.organizationId → params.orgId → query.organizationId
 * 2. locationId: body.locationId → params.locationId → query.locationId
 * 3. resourceId: params.id (most common pattern for resource-specific operations)
 *
 * ## Usage:
 * Controllers can now use clean decorators without inline context extraction:
 *
 * ```typescript
 * @Authorize({ action: "CREATE", resource: "ORDER" })
 * // organizationId/locationId/resourceId automatically available from middleware
 * ```
 */
@Injectable()
export class AuthorizationContextMiddleware implements NestMiddleware {
	public use(req: FastifyRequest, _res: FastifyReply, next: () => void): void {
		// Extract organizationId (check multiple sources)
		const organizationId =
			(req.body as Record<string, unknown>)?.organizationId ??
			req.params?.["organizationId"] ??
			req.params?.["orgId"] ??
			req.params?.["orgSlug"] ??
			req.query?.["organizationId"] ??
			null;

		// Extract locationId (check multiple sources)
		const locationId =
			(req.body as Record<string, unknown>)?.locationId ?? req.params?.["locationId"] ?? req.query?.["locationId"] ?? null;

		// Extract resourceId (common pattern for resource-specific operations)
		const resourceId = req.params?.["id"] ?? req.params?.["resourceId"] ?? null;

		// Attach to request for use by AuthorizationGuard
		(req as FastifyRequest & { authorizationContext: Record<string, unknown> }).authorizationContext = {
			organizationId: typeof organizationId === "string" ? organizationId : null,
			locationId: typeof locationId === "string" ? locationId : null,
			resourceId: typeof resourceId === "string" ? resourceId : null,
		};

		next();
	}
}
