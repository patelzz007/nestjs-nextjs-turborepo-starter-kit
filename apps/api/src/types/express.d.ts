import type { AccessTokenPayload, RefreshTokenPayload } from "../modules/auth/services/token.service";
import type { JsonValue } from "./json";

// Extend Express Request to include the authenticated user payload,
// correlation ID (set by middleware), and response data (set by interceptors)
declare global {
	namespace Express {
		interface Request {
			user?: AccessTokenPayload | RefreshTokenPayload;
			/** Correlation ID for request tracing (set by correlation-id middleware) */
			correlationId?: string;
			/** Response data captured by ResponseInterceptor for logging/audit */
			responseData?: JsonValue;
		}
	}
}

export {};
