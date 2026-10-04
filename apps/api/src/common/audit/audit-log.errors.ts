import { HttpStatus } from "@nestjs/common";
import { ApiErrorCodes } from "@workspace/shared";

import { AppError } from "../errors/app-error";

/**
 * 500 — the state change succeeded but its audit row could not be written.
 * The request is reported as failed rather than as a clean success: an
 * unaudited change is never acknowledged silently (rules/10). The underlying
 * error is logged server-side only.
 */
export class AuditLogWriteError extends AppError {
	public constructor(cause: Error) {
		super({
			code: ApiErrorCodes.INTERNAL_ERROR,
			httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
			message: "The request was processed but could not be recorded in the audit log.",
			cause,
		});
	}
}

/** Thrown when `recordInTransaction` is called outside a request that the audit interceptor opened. */
export class AuditContextMissingError extends Error {
	public constructor() {
		super("AuditTrailService.recordInTransaction() must run inside an audited HTTP request (POST/PUT/PATCH/DELETE).");
		this.name = "AuditContextMissingError";
	}
}
