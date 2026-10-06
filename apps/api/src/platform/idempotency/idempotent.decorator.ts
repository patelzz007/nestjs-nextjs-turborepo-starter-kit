import { applyDecorators, SetMetadata } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";
import { IDEMPOTENCY_KEY_HEADER } from "@workspace/shared";

import { IDEMPOTENT_OPTIONS_METADATA, type IdempotentOptions } from "./idempotency.constants";

/**
 * Make a non-idempotent endpoint (typically a `POST` create) safe to retry
 * with an `Idempotency-Key` request header. The global
 * `IdempotencyInterceptor` (registered in `AppModule`) reads this
 * metadata; see it for the exact semantics, and docs/technical/api/routes.md →
 * "Idempotency".
 *
 * Works for user-authenticated AND API-key-authenticated (POS) endpoints;
 * the request body must be JSON (or absent).
 *
 * @example
 * ```ts
 * @RequirePermission("CREATE", "PRODUCT")
 * @Idempotent()
 * @Post()
 * public create(@Body(...) body: CreateProductInput): Promise<Product> { … }
 * ```
 */
export function Idempotent(options: Partial<IdempotentOptions> = {}): MethodDecorator & ClassDecorator {
	const resolved: IdempotentOptions = { required: options.required ?? false };
	return applyDecorators(
		SetMetadata(IDEMPOTENT_OPTIONS_METADATA, resolved),
		ApiHeader({
			name: IDEMPOTENCY_KEY_HEADER,
			required: resolved.required,
			description:
				"Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h " +
				"replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent " +
				"duplicate → 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE.",
		}),
	);
}
