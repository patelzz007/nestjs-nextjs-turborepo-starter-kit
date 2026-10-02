import { ApiErrorCodes } from "@workspace/shared";

import { ConflictError, ValidationError } from "../../common/errors/app-error";
import { IDEMPOTENCY_IN_PROGRESS_RETRY_AFTER_SECONDS, IDEMPOTENCY_KEY_HEADER } from "./idempotency.constants";

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
