import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { CLIENT_TYPE_HEADER, IDEMPOTENCY_KEY_HEADER, MUTATION_INTENT_HEADER } from "@workspace/shared";

import type { ApiConfig } from "../config/api-config.schema";

/** The options `NestFastifyApplication.enableCors` accepts (Fastify's own CORS options). */
export type ApiCorsOptions = NonNullable<Parameters<NestFastifyApplication["enableCors"]>[0]>;

/** HTTP methods the browser apps call. */
const CORS_METHODS: readonly string[] = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

/**
 * Request headers a browser may send cross-origin — exactly the ones the API reads.
 * Each entry must have a reader; remove it when the header is retired.
 *
 * - `Content-Type`, `Accept`: JSON bodies and responses.
 * - `X-Client-Type`: which app is calling (cookie vs bearer session handling).
 * - the mutation-intent header: CSRF defence on state-changing requests.
 * - `Idempotency-Key`: opt-in safe retries on @Idempotent() endpoints (not CORS-safelisted).
 */
export const CORS_ALLOWED_HEADERS: readonly string[] = ["Content-Type", "Accept", CLIENT_TYPE_HEADER, MUTATION_INTENT_HEADER, IDEMPOTENCY_KEY_HEADER];

/** The API's CORS policy: the configured browser origins, with credentials (session cookies). */
export function buildCorsOptions(config: ApiConfig): ApiCorsOptions {
	return {
		origin: [...config.http.corsOrigins],
		credentials: true,
		methods: [...CORS_METHODS],
		allowedHeaders: [...CORS_ALLOWED_HEADERS],
	};
}
