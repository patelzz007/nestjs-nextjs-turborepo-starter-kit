import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
	AppError,
	AuthenticationError,
	AuthorizationError,
	ConflictError,
	DependencyUnavailableError,
	ExternalServiceError,
	NotFoundError,
	RateLimitError,
	ValidationError,
} from "./app-error";
import { STANDARD_ERROR_MESSAGES } from "./error-codes";

describe("AppError", () => {
	it("carries code, status, message, details and cause", () => {
		const cause = new Error("db exploded");
		const error = new AppError({ code: "ORDER_LOCKED", httpStatus: HttpStatus.LOCKED, message: "Order is locked", details: { orderId: "o-1" }, cause });

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("AppError");
		expect(error.code).toBe("ORDER_LOCKED");
		expect(error.httpStatus).toBe(HttpStatus.LOCKED);
		expect(error.message).toBe("Order is locked");
		expect(error.details).toEqual({ orderId: "o-1" });
		expect(error.cause).toBe(cause);
	});

	it("rejects a code that is not SCREAMING_SNAKE_CASE at the throw site", () => {
		expect(() => new AppError({ code: "not a code", httpStatus: HttpStatus.BAD_REQUEST, message: "x" })).toThrow();
	});

	it("leaves details and cause undefined when not given", () => {
		const error = new AppError({ code: "X", httpStatus: HttpStatus.BAD_REQUEST, message: "x" });

		expect(error.details).toBeUndefined();
		expect(error.cause).toBeUndefined();
	});
});

describe("AppError subclasses", () => {
	it.each([
		[new ValidationError(), "VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "ValidationError"],
		[new AuthenticationError(), "UNAUTHORIZED", HttpStatus.UNAUTHORIZED, "AuthenticationError"],
		[new AuthorizationError(), "FORBIDDEN", HttpStatus.FORBIDDEN, "AuthorizationError"],
		[new NotFoundError(), "NOT_FOUND", HttpStatus.NOT_FOUND, "NotFoundError"],
		[new ConflictError(), "CONFLICT", HttpStatus.CONFLICT, "ConflictError"],
		[new RateLimitError(), "RATE_LIMITED", HttpStatus.TOO_MANY_REQUESTS, "RateLimitError"],
		[new ExternalServiceError(), "EXTERNAL_SERVICE_ERROR", HttpStatus.BAD_GATEWAY, "ExternalServiceError"],
		[new DependencyUnavailableError(), "SERVICE_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE, "DependencyUnavailableError"],
	])("%s defaults to its code, status and the standard message", (error: AppError, code: string, status: HttpStatus, name: string) => {
		expect(error).toBeInstanceOf(AppError);
		expect(error.code).toBe(code);
		expect(error.httpStatus).toBe(status);
		expect(error.name).toBe(name);
		expect(error.message.length).toBeGreaterThan(0);
	});

	it("uses the standard message for the default code", () => {
		expect(new NotFoundError().message).toBe(STANDARD_ERROR_MESSAGES.NOT_FOUND);
	});

	it("accepts a domain code, message, details and cause override", () => {
		const cause = new Error("inner");
		const error = new ConflictError({ code: "EMAIL_TAKEN", message: "Email already in use", details: { field: "email" }, cause });

		expect(error.code).toBe("EMAIL_TAKEN");
		expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
		expect(error.message).toBe("Email already in use");
		expect(error.details).toEqual({ field: "email" });
		expect(error.cause).toBe(cause);
	});
});
