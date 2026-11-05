import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { IDEMPOTENCY_KEY_HEADER } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { parseIdempotencyKeyHeader, type IdempotencyKey } from "../../../infrastructure/idempotency/idempotency-request";
import { IdempotencyKeyRequiredError } from "../../../infrastructure/idempotency/idempotency.errors";

/**
 * The request's `Idempotency-Key`, validated by the same rule as `@Idempotent()` (8–128 characters of
 * `[A-Za-z0-9._:-]`). Missing → 400 `IDEMPOTENCY_KEY_REQUIRED`; malformed → 400 `VALIDATION_ERROR`.
 */
export function requiredIdempotencyKey(raw: string | readonly string[] | undefined): IdempotencyKey {
	const key = parseIdempotencyKeyHeader(raw);
	if (key === undefined) {
		throw new IdempotencyKeyRequiredError();
	}
	return key;
}

/**
 * Hands a route the key itself, for a use case that also stores it (a payment remembers its key so the
 * same key can never take a second payment, even after the interceptor's replay window). Pair it with
 * `@Idempotent({ required: true })`, which replays retries and holds back concurrent duplicates.
 */
export const IdempotencyKeyHeader = createParamDecorator((_data: undefined, ctx: ExecutionContext): IdempotencyKey => {
	const request = ctx.switchToHttp().getRequest<FastifyRequest>();
	return requiredIdempotencyKey(request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]);
});
