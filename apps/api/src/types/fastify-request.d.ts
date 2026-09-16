import type { FastifyRequest } from "fastify";

declare module "fastify" {
	interface FastifyRequest {
		/**
		 * Authorization context extracted by AuthorizationContextMiddleware.
		 * Contains common context like organizationId, locationId, resourceId.
		 */
		authorizationContext?: {
			organizationId: string | null;
			locationId: string | null;
			resourceId: string | null;
		};
	}
}
