import type { AccessTokenPayload, RefreshTokenPayload } from "../modules/auth/services/token.service";

import type { JsonValue } from "./json";

// Re-export for convenience — consumers can import from either path.
export type { AuthenticatedUser, isAuthenticatedUser } from "./authenticated-user";

// Extend the FastifyRequest type to include the authenticated user payload,
// correlation ID (set by the correlation-id middleware and mirrored onto the
// FastifyRequest by the preHandler hook in main.ts), and response data (set
// by interceptors). Guards/interceptors receive the FastifyRequest on this
// adapter, so these fields are typed directly on it.
declare module "fastify" {
	interface FastifyRequest {
		user?: import("./authenticated-user").AuthenticatedUser | RefreshTokenPayload;
		/** Correlation ID for request tracing (set by correlation-id middleware) */
		correlationId?: string;
		/** Trace ID — alias of correlationId, used for request grouping */
		traceId?: string;
		/** Response data captured by ResponseInterceptor for logging/audit */
		responseData?: JsonValue;
	}
}

// @fastify/request-context — the per-request AsyncLocalStorage store. The
// correlation/trace ids are mirrored here by the preHandler hook in main.ts so
// any code spawned during a request can read them without a request reference.
declare module "@fastify/request-context" {
	interface RequestContextData {
		/** Correlation ID for request tracing. */
		correlationId?: string;
		/** Trace ID — alias of correlationId, used for request grouping. */
		traceId?: string;
	}
}

export {};
