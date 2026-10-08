import { HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
	ApiErrorCodes,
	ApiErrorCodeSchema,
	ApiValidationIssueSchema,
	isArrayValue,
	isStringPrimitive,
	JsonValueSchema,
	type ApiErrorCode,
	type ApiErrorDetails,
	type ApiValidationIssue,
	type CaughtValue,
	type JsonValue,
} from "@workspace/shared";
import { z } from "zod";

import { AppError } from "./app-error";
import { HTTP_CLIENT_ERROR_MIN_STATUS, isServerErrorStatus, STANDARD_ERROR_MESSAGES, standardCodeForStatus } from "./error-codes";

/** The normalized, client-safe view of any thrown value. */
export interface MappedError {
	readonly httpStatus: number;
	readonly code: ApiErrorCode;
	readonly message: string;
	readonly details: ApiErrorDetails | undefined;
}

export interface ExceptionMappingOptions {
	/**
	 * When true (development only) the original message of an UNEXPECTED
	 * error is echoed in `details.debug` to speed up local debugging. Stack
	 * traces are never included — they only go to the server log.
	 */
	readonly exposeInternalErrors: boolean;
}

/** Prisma: unique constraint violated. */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";
/** Prisma: record required by the operation was not found. */
const PRISMA_RECORD_NOT_FOUND = "P2025";

/** Message for Prisma unique-constraint violations (no column/constraint names leak). */
const DUPLICATE_RESOURCE_MESSAGE = "A resource with the same unique value already exists.";

/** Keys of an HttpException body that are mapped explicitly; everything else is forwarded as details. */
const RESERVED_HTTP_BODY_KEYS: ReadonlySet<string> = new Set<string>(["message", "error", "statusCode", "errors"]);

/**
 * Body of a Nest `HttpException` (`getResponse()` when it is an object):
 * - `new UnauthorizedException({ message, error: "ACCESS_TOKEN_EXPIRED" })`
 * - the ZodValidationPipe's `{ message, errors: [{ path, message, code }], statusCode }`
 * - Nest defaults `{ statusCode, message, error: "Bad Request" }` (message may be a string[])
 */
const HttpExceptionBodySchema = z.looseObject({
	message: z.union([z.string(), z.array(z.string())]).optional(),
	error: z.string().optional(),
	errors: z.array(ApiValidationIssueSchema).optional(),
});

/** A plain `Error` that a framework layer (e.g. the JSON body parser) tagged with a 4xx status. */
const ClientStatusErrorSchema = z.object({
	statusCode: z
		.number()
		.int()
		.min(HTTP_CLIENT_ERROR_MIN_STATUS)
		.max(HttpStatus.INTERNAL_SERVER_ERROR - 1),
});

type HttpExceptionBody = z.output<typeof HttpExceptionBodySchema>;

/** Keep only JSON-serializable extra fields — anything else is dropped rather than guessed at. */
function collectExtraDetails(body: HttpExceptionBody): Record<string, JsonValue> {
	const extras: Record<string, JsonValue> = {};
	for (const [key, value] of Object.entries(body)) {
		if (RESERVED_HTTP_BODY_KEYS.has(key)) {
			continue;
		}
		const parsed = JsonValueSchema.safeParse(value);
		if (parsed.success) {
			extras[key] = parsed.data;
		}
	}
	return extras;
}

function toIssueDetails(issues: readonly ApiValidationIssue[]): JsonValue {
	return issues.map((issue: ApiValidationIssue): JsonValue => ({ path: issue.path, message: issue.message, code: issue.code }));
}

function nonEmptyDetails(details: Record<string, JsonValue>): ApiErrorDetails | undefined {
	return Object.keys(details).length === 0 ? undefined : details;
}

function mapHttpException(exception: HttpException, options: ExceptionMappingOptions): MappedError {
	const httpStatus: number = exception.getStatus();
	const fallbackCode: ApiErrorCode = standardCodeForStatus(httpStatus);
	const response: string | object = exception.getResponse();

	if (isStringPrimitive(response)) {
		return finalizeHttpMessage(httpStatus, fallbackCode, response, undefined, options);
	}

	const body = HttpExceptionBodySchema.safeParse(response);
	if (!body.success) {
		return finalizeHttpMessage(httpStatus, fallbackCode, exception.message, undefined, options);
	}

	const details: Record<string, JsonValue> = collectExtraDetails(body.data);
	const domainCode = ApiErrorCodeSchema.safeParse(body.data.error);
	let code: ApiErrorCode = domainCode.success ? domainCode.data : fallbackCode;
	let message: string = isStringPrimitive(body.data.message) ? body.data.message : exception.message;

	if (body.data.errors !== undefined) {
		details.issues = toIssueDetails(body.data.errors);
		code = domainCode.success ? domainCode.data : ApiErrorCodes.VALIDATION_ERROR;
	} else if (isArrayValue(body.data.message)) {
		// Nest's built-in pipes report a list of messages without paths.
		details.issues = toIssueDetails(body.data.message.map((issueMessage: string): ApiValidationIssue => ({ path: "root", message: issueMessage, code: "invalid" })));
		code = domainCode.success ? domainCode.data : ApiErrorCodes.VALIDATION_ERROR;
		message = STANDARD_ERROR_MESSAGES.VALIDATION_ERROR;
	}

	return finalizeHttpMessage(httpStatus, code, message, nonEmptyDetails(details), options);
}

/**
 * 4xx messages are authored for the client and pass through. 5xx messages
 * pass through only outside production-like environments: an
 * `InternalServerErrorException` message is written by a developer but may
 * still describe internals, so production gets the generic message instead.
 */
function finalizeHttpMessage(httpStatus: number, code: ApiErrorCode, message: string, details: ApiErrorDetails | undefined, options: ExceptionMappingOptions): MappedError {
	const standardCode = standardCodeForStatus(httpStatus);
	if (isServerErrorStatus(httpStatus) && !options.exposeInternalErrors) {
		return { httpStatus, code, message: STANDARD_ERROR_MESSAGES[standardCode], details: undefined };
	}
	return { httpStatus, code, message: message.length > 0 ? message : STANDARD_ERROR_MESSAGES[standardCode], details };
}

function mapPrismaKnownError(exception: Prisma.PrismaClientKnownRequestError): MappedError | undefined {
	if (exception.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION) {
		return { httpStatus: HttpStatus.CONFLICT, code: ApiErrorCodes.CONFLICT, message: DUPLICATE_RESOURCE_MESSAGE, details: undefined };
	}
	if (exception.code === PRISMA_RECORD_NOT_FOUND) {
		return { httpStatus: HttpStatus.NOT_FOUND, code: ApiErrorCodes.NOT_FOUND, message: STANDARD_ERROR_MESSAGES.NOT_FOUND, details: undefined };
	}
	return undefined;
}

function unexpectedError(exception: CaughtValue, options: ExceptionMappingOptions): MappedError {
	const details: ApiErrorDetails | undefined =
		options.exposeInternalErrors && exception instanceof Error ? { debug: { name: exception.name, message: exception.message } } : undefined;
	return {
		httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
		code: ApiErrorCodes.INTERNAL_ERROR,
		message: STANDARD_ERROR_MESSAGES.INTERNAL_ERROR,
		details,
	};
}

/**
 * Normalize ANY thrown value into the client-safe shape the global exception
 * filter serializes. Mapping order:
 *
 * 1. `AppError` — already client-safe by contract.
 * 2. Nest `HttpException` (incl. `AuthorizationException`, the validation pipe, Fastify errors Nest re-wraps).
 * 3. Prisma known errors — P2002 → 409 CONFLICT, P2025 → 404 NOT_FOUND.
 * 4. Prisma initialization errors (database unreachable) → 503.
 * 5. Framework errors tagged with a 4xx `statusCode` (malformed JSON body, …).
 * 6. Everything else → 500 INTERNAL_ERROR with a generic message.
 */
export function mapException(exception: CaughtValue, options: ExceptionMappingOptions): MappedError {
	if (exception instanceof AppError) {
		return { httpStatus: exception.httpStatus, code: exception.code, message: exception.message, details: exception.details };
	}
	if (exception instanceof HttpException) {
		return mapHttpException(exception, options);
	}
	if (exception instanceof Prisma.PrismaClientKnownRequestError) {
		return mapPrismaKnownError(exception) ?? unexpectedError(exception, options);
	}
	if (exception instanceof Prisma.PrismaClientInitializationError) {
		return {
			httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
			code: ApiErrorCodes.SERVICE_UNAVAILABLE,
			message: STANDARD_ERROR_MESSAGES.SERVICE_UNAVAILABLE,
			details: undefined,
		};
	}
	if (exception instanceof Error) {
		const tagged = ClientStatusErrorSchema.safeParse(exception);
		if (tagged.success) {
			const code = standardCodeForStatus(tagged.data.statusCode);
			return { httpStatus: tagged.data.statusCode, code, message: STANDARD_ERROR_MESSAGES[code], details: undefined };
		}
	}
	return unexpectedError(exception, options);
}
