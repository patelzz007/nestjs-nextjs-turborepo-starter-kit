import { applyDecorators, SetMetadata, UseInterceptors } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";

import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENT_OPTIONS_METADATA, type IdempotentOptions } from "./idempotency.constants";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

/**
 * Make a non-idempotent endpoint (typically a `POST` create) safe to retry
 * with an `Idempotency-Key` request header. See {@link IdempotencyInterceptor}
 * for the exact semantics and docs/api-routes.md → "Idempotency".
 *
 * The module that owns the controller must import `PlatformResourceModule`
 * (it provides the ledger service). Only apply to authenticated endpoints
 * that return JSON.
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
		UseInterceptors(IdempotencyInterceptor),
		ApiHeader({
			name: IDEMPOTENCY_KEY_HEADER,
			required: resolved.required,
			description:
				"Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID). An identical retry within 24h replays the stored response " +
				"(`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate → " +
				"409 IDEMPOTENCY_REQUEST_IN_PROGRESS.",
		}),
	);
}
