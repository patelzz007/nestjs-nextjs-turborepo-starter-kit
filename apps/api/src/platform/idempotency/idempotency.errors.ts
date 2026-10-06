import { HttpStatus } from "@nestjs/common";
import { ApiErrorCodes, IDEMPOTENCY_KEY_HEADER } from "@workspace/shared";

import { AppError, AuthenticationError, ConflictError, ValidationError } from "../../common/errors/app-error";
import { IDEMPOTENCY_IN_PROGRESS_RETRY_AFTER_SECONDS } from "./idempotency.constants";

/** 400 — the endpoint is `@Idempotent({ required: true })` and the header is missing. */
export class IdempotencyKeyRequiredError extends ValidationError {
	public constructor() {
		super({ code: ApiErrorCodes.IDEMPOTENCY_KEY_REQUIRED, message: `An ${IDEMPOTENCY_KEY_HEADER} header is required for this request.` });
	}
}

/** 409 — the key was already used with a different request (method, path, or body). */
export class IdempotencyKeyReusedError extends ConflictError {
	public constructor() {
		super({
			code: ApiErrorCodes.IDEMPOTENCY_KEY_REUSED,
			message: `This ${IDEMPOTENCY_KEY_HEADER} was already used with a different request. Generate a new key for a new request.`,
		});
	}
}

/**
 * 409 — an identical request with this key is still executing (concurrent
 * duplicate, e.g. a double-click or an aggressive client retry). Carries a
 * `Retry-After` hint; retrying after the first request finishes replays its
 * response.
 */
export class IdempotencyRequestInProgressError extends ConflictError {
	public constructor() {
		super({
			code: ApiErrorCodes.IDEMPOTENCY_REQUEST_IN_PROGRESS,
			message: `A request with this ${IDEMPOTENCY_KEY_HEADER} is still being processed. Retry shortly.`,
			details: { retryAfterSeconds: IDEMPOTENCY_IN_PROGRESS_RETRY_AFTER_SECONDS },
		});
	}
}

/**
 * 415 — an `Idempotency-Key` was sent with a non-JSON body (multipart, form,
 * raw bytes). The request fingerprint is the canonical JSON of the body, so a
 * body the server cannot canonicalize cannot be protected — rather than
 * silently fingerprinting every such body as "no body" (which would replay one
 * upload's response for a different upload), the request is refused.
 */
export class IdempotencyUnsupportedContentTypeError extends AppError {
	public constructor() {
		super({
			code: ApiErrorCodes.UNSUPPORTED_MEDIA_TYPE,
			httpStatus: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
			message: `${IDEMPOTENCY_KEY_HEADER} is supported only for requests with a JSON body (or no body).`,
		});
	}
}

/** 401 — an `Idempotency-Key` on a request with no authenticated principal (user or API key). */
export class IdempotencyPrincipalRequiredError extends AuthenticationError {
	public constructor() {
		super({ message: `${IDEMPOTENCY_KEY_HEADER} requires an authenticated request.` });
	}
}

/**
 * Internal — the response of an `@Idempotent()` route has no JSON form, so it
 * cannot be stored for replay (a programming error on that route). Logged by
 * the interceptor; never sent to a client.
 */
export class IdempotencyResponseNotStorableError extends Error {
	public constructor() {
		super("@Idempotent() route returned a value with no JSON form; the response was not stored for replay.");
		this.name = "IdempotencyResponseNotStorableError";
	}
}
