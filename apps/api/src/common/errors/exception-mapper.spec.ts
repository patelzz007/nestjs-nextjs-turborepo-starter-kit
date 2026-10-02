import {
	BadRequestException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	InternalServerErrorException,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ThrottlerException } from "@nestjs/throttler";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { AuthorizationException } from "../../modules/authorization/exceptions/authorization.exception";
import { ConflictError, NotFoundError } from "./app-error";
import { isServerErrorStatus, STANDARD_ERROR_MESSAGES, standardCodeForStatus } from "./error-codes";
import { mapException, type ExceptionMappingOptions, type MappedError } from "./exception-mapper";

const PRODUCTION: ExceptionMappingOptions = { exposeInternalErrors: false };
const DEVELOPMENT: ExceptionMappingOptions = { exposeInternalErrors: true };

function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("SELECT * FROM secret_table -- raw provider message", { code, clientVersion: "7.0.0" });
}

/** Run the real validation pipe and capture what it throws. */
function validationPipeError(): HttpException {
	const pipe = new ZodValidationPipe(z.object({ email: z.email(), age: z.number().int() }).strict());
	try {
		pipe.transform({ email: "not-an-email", age: "x" });
	} catch (error) {
		if (error instanceof HttpException) {
			return error;
		}
	}
	throw new Error("ZodValidationPipe did not throw an HttpException");
}

describe("standardCodeForStatus", () => {
	it.each([
		[HttpStatus.BAD_REQUEST, "BAD_REQUEST"],
		[HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"],
		[HttpStatus.FORBIDDEN, "FORBIDDEN"],
		[HttpStatus.NOT_FOUND, "NOT_FOUND"],
		[HttpStatus.CONFLICT, "CONFLICT"],
		[HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE"],
		[HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE"],
		[HttpStatus.UNPROCESSABLE_ENTITY, "UNPROCESSABLE_ENTITY"],
		[HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED"],
		[HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"],
		[HttpStatus.BAD_GATEWAY, "EXTERNAL_SERVICE_ERROR"],
		[HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE"],
		[HttpStatus.GATEWAY_TIMEOUT, "GATEWAY_TIMEOUT"],
		[HttpStatus.I_AM_A_TEAPOT, "BAD_REQUEST"],
		[HttpStatus.NOT_IMPLEMENTED, "INTERNAL_ERROR"],
	])("maps %i to %s", (status: number, code: string) => {
		expect(standardCodeForStatus(status)).toBe(code);
	});

	it("classifies 5xx as server errors only", () => {
		expect(isServerErrorStatus(HttpStatus.INTERNAL_SERVER_ERROR)).toBe(true);
		expect(isServerErrorStatus(HttpStatus.SERVICE_UNAVAILABLE)).toBe(true);
		expect(isServerErrorStatus(HttpStatus.NOT_FOUND)).toBe(false);
	});
});

describe("mapException", () => {
	describe("AppError", () => {
		it("passes code, status, message and details through unchanged", () => {
			const mapped: MappedError = mapException(new ConflictError({ code: "EMAIL_TAKEN", message: "Email already in use", details: { field: "email" } }), PRODUCTION);

			expect(mapped).toEqual({ httpStatus: HttpStatus.CONFLICT, code: "EMAIL_TAKEN", message: "Email already in use", details: { field: "email" } });
		});
	});

	describe("HttpException", () => {
		it("keeps a domain code from the `error` field (auth errors)", () => {
			const mapped = mapException(new UnauthorizedException({ message: "Access token has expired", error: "ACCESS_TOKEN_EXPIRED" }), PRODUCTION);

			expect(mapped).toEqual({ httpStatus: HttpStatus.UNAUTHORIZED, code: "ACCESS_TOKEN_EXPIRED", message: "Access token has expired", details: undefined });
		});

		it("maps AuthorizationException to 403 PERMISSION_DENIED", () => {
			const mapped = mapException(new AuthorizationException(), PRODUCTION);

			expect(mapped.httpStatus).toBe(HttpStatus.FORBIDDEN);
			expect(mapped.code).toBe("PERMISSION_DENIED");
			expect(mapped.message).toBe("You do not have permission to perform this action.");
		});

		it("falls back to the status code when `error` is Nest's human label", () => {
			const mapped = mapException(new NotFoundException("Product not found"), PRODUCTION);

			expect(mapped).toEqual({ httpStatus: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Product not found", details: undefined });
		});

		it("maps a plain-string response body", () => {
			const mapped = mapException(new HttpException("Gone for good", HttpStatus.GONE), PRODUCTION);

			expect(mapped).toEqual({ httpStatus: HttpStatus.GONE, code: "BAD_REQUEST", message: "Gone for good", details: undefined });
		});

		it("maps the ZodValidationPipe output to VALIDATION_ERROR with field issues", () => {
			const mapped = mapException(validationPipeError(), PRODUCTION);

			expect(mapped.httpStatus).toBe(HttpStatus.BAD_REQUEST);
			expect(mapped.code).toBe("VALIDATION_ERROR");
			expect(mapped.message).toBe("Validation failed");
			expect(mapped.details?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: "email" }), expect.objectContaining({ path: "age" })]));
		});

		it("maps Nest's array-of-messages validation body to issues", () => {
			const mapped = mapException(new BadRequestException(["name must be a string", "age must be a number"]), PRODUCTION);

			expect(mapped.code).toBe("VALIDATION_ERROR");
			expect(mapped.message).toBe(STANDARD_ERROR_MESSAGES.VALIDATION_ERROR);
			expect(mapped.details).toEqual({
				issues: [
					{ path: "root", message: "name must be a string", code: "invalid" },
					{ path: "root", message: "age must be a number", code: "invalid" },
				],
			});
		});

		it("forwards extra client-facing fields (lockout timing) as details", () => {
			const mapped = mapException(
				new UnauthorizedException({ message: "Account locked", error: "ACCOUNT_LOCKED", lockedUntil: 1790812800000, remainingSeconds: 299 }),
				PRODUCTION,
			);

			expect(mapped.code).toBe("ACCOUNT_LOCKED");
			expect(mapped.details).toEqual({ lockedUntil: 1790812800000, remainingSeconds: 299 });
		});

		it("maps the throttler's exception to RATE_LIMITED", () => {
			const mapped = mapException(new ThrottlerException(), PRODUCTION);

			expect(mapped.httpStatus).toBe(HttpStatus.TOO_MANY_REQUESTS);
			expect(mapped.code).toBe("RATE_LIMITED");
		});

		it("hides 5xx messages and details in production", () => {
			const mapped = mapException(
				new InternalServerErrorException({ message: "Failed to decrypt MFA secret at /etc/keys", error: "MFA_DECRYPT_FAILED", keyPath: "/etc/keys" }),
				PRODUCTION,
			);

			expect(mapped).toEqual({
				httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
				code: "MFA_DECRYPT_FAILED",
				message: STANDARD_ERROR_MESSAGES.INTERNAL_ERROR,
				details: undefined,
			});
		});

		it("shows authored 5xx messages outside production", () => {
			const mapped = mapException(new ServiceUnavailableException("API is starting up"), DEVELOPMENT);

			expect(mapped.message).toBe("API is starting up");
			expect(mapped.code).toBe("SERVICE_UNAVAILABLE");
		});

		it("uses the standard message when the authored message is empty", () => {
			const mapped = mapException(new ForbiddenException({ message: "" }), PRODUCTION);

			expect(mapped.message).toBe(STANDARD_ERROR_MESSAGES.FORBIDDEN);
		});
	});

	describe("Prisma errors", () => {
		it("maps P2002 (unique violation) to 409 CONFLICT without leaking the provider message", () => {
			const mapped = mapException(prismaKnownError("P2002"), PRODUCTION);

			expect(mapped.httpStatus).toBe(HttpStatus.CONFLICT);
			expect(mapped.code).toBe("CONFLICT");
			expect(mapped.message).not.toContain("secret_table");
			expect(mapped.details).toBeUndefined();
		});

		it("maps P2025 (record not found) to 404 NOT_FOUND", () => {
			const mapped = mapException(prismaKnownError("P2025"), PRODUCTION);

			expect(mapped).toEqual({ httpStatus: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: STANDARD_ERROR_MESSAGES.NOT_FOUND, details: undefined });
		});

		it("maps any other known Prisma error to a generic 500", () => {
			const mapped = mapException(prismaKnownError("P2003"), PRODUCTION);

			expect(mapped).toEqual({ httpStatus: HttpStatus.INTERNAL_SERVER_ERROR, code: "INTERNAL_ERROR", message: STANDARD_ERROR_MESSAGES.INTERNAL_ERROR, details: undefined });
		});

		it("maps an initialization error (database unreachable) to 503", () => {
			const mapped = mapException(new Prisma.PrismaClientInitializationError("Can't reach database server at db:5432", "7.0.0"), PRODUCTION);

			expect(mapped.httpStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
			expect(mapped.code).toBe("SERVICE_UNAVAILABLE");
			expect(mapped.message).not.toContain("db:5432");
		});
	});

	describe("framework errors tagged with a 4xx status", () => {
		it("maps a malformed-JSON body error to 400 with a generic message", () => {
			const parseError = Object.assign(new SyntaxError("Unexpected token } in JSON at position 10"), { statusCode: HttpStatus.BAD_REQUEST });

			expect(mapException(parseError, PRODUCTION)).toEqual({
				httpStatus: HttpStatus.BAD_REQUEST,
				code: "BAD_REQUEST",
				message: STANDARD_ERROR_MESSAGES.BAD_REQUEST,
				details: undefined,
			});
		});

		it("ignores a 5xx statusCode tag (treated as unexpected)", () => {
			const tagged = Object.assign(new Error("boom"), { statusCode: HttpStatus.BAD_GATEWAY });

			expect(mapException(tagged, PRODUCTION).httpStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		});
	});

	describe("unexpected errors", () => {
		it("maps a plain Error to a generic 500 in production", () => {
			expect(mapException(new TypeError("Cannot read properties of undefined (reading 'id')"), PRODUCTION)).toEqual({
				httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
				code: "INTERNAL_ERROR",
				message: STANDARD_ERROR_MESSAGES.INTERNAL_ERROR,
				details: undefined,
			});
		});

		it("adds a debug name/message (never a stack) in development", () => {
			const mapped = mapException(new TypeError("x is undefined"), DEVELOPMENT);

			expect(mapped.details).toEqual({ debug: { name: "TypeError", message: "x is undefined" } });
			expect(JSON.stringify(mapped)).not.toContain("at ");
		});

		it("treats a ZodError from server-side parsing as a 500, not a client error", () => {
			const parsed = z.object({ id: z.uuid() }).safeParse({ id: "nope" });
			const mapped = mapException(parsed.success ? new Error("unreachable") : parsed.error, PRODUCTION);

			expect(mapped.httpStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		});

		it("maps thrown non-Error values (strings, undefined, objects)", () => {
			expect(mapException("boom", DEVELOPMENT).code).toBe("INTERNAL_ERROR");
			expect(mapException(undefined, DEVELOPMENT).details).toBeUndefined();
			expect(mapException({ weird: true }, PRODUCTION).httpStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		});

		it("does not confuse a NotFoundError subclass with an unexpected error", () => {
			expect(mapException(new NotFoundError(), PRODUCTION).httpStatus).toBe(HttpStatus.NOT_FOUND);
		});
	});
});
