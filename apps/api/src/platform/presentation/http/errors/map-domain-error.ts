import { ApiErrorDetailsSchema, type ApiErrorCode } from "@workspace/shared";

import type { ExceptionMappingOptions, MappedError } from "../../../infrastructure/errors/exception-mapper";
import { DomainError } from "../../../domain/errors/domain-error";
import { STANDARD_ERROR_MESSAGES } from "../../../domain/errors/error-codes";
import { isServerErrorStatus, standardCodeForStatus } from "../../../application/errors/http-status";
import { httpStatusForDomainError } from "./domain-error-status.map";

function toApiDetails(details: DomainError["details"]): MappedError["details"] {
	if (Object.keys(details).length === 0) {
		return undefined;
	}
	const parsed = ApiErrorDetailsSchema.safeParse(details);
	return parsed.success ? parsed.data : undefined;
}

/**
 * Maps a {@link DomainError} into the client-safe shape the global filter serializes.
 *
 * A domain error that maps to a 5xx (corrupt aggregate state, a missing seed role)
 * describes internals: outside development it keeps its code but answers with
 * the generic message and no details — the same redaction `mapException`
 * applies to every other server error. The full error is logged server-side.
 */
export function mapDomainError(error: DomainError, options: ExceptionMappingOptions): MappedError {
	const httpStatus = httpStatusForDomainError(error.code);
	const code: ApiErrorCode = error.code;
	if (isServerErrorStatus(httpStatus) && !options.exposeInternalErrors) {
		return { httpStatus, code, message: STANDARD_ERROR_MESSAGES[standardCodeForStatus(httpStatus)], details: undefined };
	}
	return {
		httpStatus,
		code,
		message: error.message,
		details: toApiDetails(error.details),
	};
}
