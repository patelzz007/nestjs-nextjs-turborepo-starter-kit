import type { FastifyRequest } from "fastify";

declare module "fastify" {
	interface FastifyRequest {
		/**
		 * Server-verified tenant context, attached by `AuthorizationGuard` after
		 * checking the caller's active organization membership / location scope.
		 * Absent ids were either not requested or not proven — never raw client input.
		 */
		authorizationContext?: {
			readonly organizationId?: string;
			readonly storeId?: string;
			readonly locationId?: string;
		};
	}
}
