import type { RefreshTokenPayload } from "@workspace/shared";

// Re-export for convenience — consumers can import from either path.
export type { AuthenticatedUser, isAuthenticatedUser } from "./authenticated-user";

// Extend the FastifyRequest type with the authenticated user payload. Guards/interceptors receive the
// FastifyRequest on this adapter, so these fields are typed directly on it.
//
// Request-scoped identifiers (correlation id, trace id, principal, tenant)
// are NOT stored on the request object: they live in the one request context
// (`platform/infrastructure/context/request-context.ts`, ADR 017). `request.id` is the
// correlation id (genReqId → `platform/infrastructure/context/correlation-id.ts`).
declare module "fastify" {
	interface FastifyRequest {
		user?: import("./authenticated-user").AuthenticatedUser | RefreshTokenPayload;
	}
}

export {};
