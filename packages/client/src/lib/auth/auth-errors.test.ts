import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveAuthErrorMessage, isAccountLockedError } from "./auth-errors";
import { ApiError } from "../api/use-api";

describe("ApiError", () => {
	it("preserves the code and lockout payload from the server body", () => {
		const err = new ApiError({
			message: "Account temporarily locked. Try again in 5 minute(s).",
			error: "ACCOUNT_LOCKED",
			statusCode: 401,
			lockedUntil: epochMs(Date.parse("2026-08-04T12:49:00.000Z")),
			remainingSeconds: 299,
		});

		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("ApiError");
		expect(err.message).toBe("Account temporarily locked. Try again in 5 minute(s).");
		expect(err.error).toBe("ACCOUNT_LOCKED");
		expect(err.statusCode).toBe(401);
		expect(err.lockedUntil).toBe(epochMs(Date.parse("2026-08-04T12:49:00.000Z")));
		expect(err.remainingSeconds).toBe(299);
	});

	it("is usable without optional fields", () => {
		const err = new ApiError({ message: "Invalid email or password" });
		expect(err.error).toBeUndefined();
		expect(err.remainingSeconds).toBeUndefined();
	});
});

describe("resolveAuthErrorMessage", () => {
	it("maps a known auth error code to the friendly catalog string", () => {
		const err = new ApiError({ message: "Invalid email or password", error: "INVALID_CREDENTIALS" });
		expect(resolveAuthErrorMessage(err)).toBe("Incorrect email or password. Please try again.");
	});

	it("maps ACCOUNT_LOCKED to the friendly lockout message", () => {
		const err = new ApiError({ message: "Account temporarily locked", error: "ACCOUNT_LOCKED" });
		expect(resolveAuthErrorMessage(err)).toContain("Account temporarily locked");
	});

	it("maps EMAIL_NOT_VERIFIED to its friendly message", () => {
		const err = new ApiError({ message: "Email not verified", error: "EMAIL_NOT_VERIFIED" });
		expect(resolveAuthErrorMessage(err)).toBe("Please verify your email address before continuing.");
	});

	it("maps ADMIN_ACCESS_REQUIRED to its friendly message", () => {
		const err = new ApiError({ message: "Admin access required", error: "ADMIN_ACCESS_REQUIRED" });
		expect(resolveAuthErrorMessage(err)).toBe("This account doesn't have admin panel access.");
	});

	it("falls back to the server message for an unknown code", () => {
		const err = new ApiError({ message: "Something unusual happened", error: "UNKNOWN_CODE" });
		expect(resolveAuthErrorMessage(err)).toBe("Something unusual happened");
	});

	it("falls back to the server message when the code is missing", () => {
		const err = new ApiError({ message: "Plain server message" });
		expect(resolveAuthErrorMessage(err)).toBe("Plain server message");
	});

	it("falls back to a generic message for non-Error values", () => {
		expect(resolveAuthErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
		expect(resolveAuthErrorMessage(null)).toBe("Something went wrong. Please try again.");
		expect(resolveAuthErrorMessage(42)).toBe("Something went wrong. Please try again.");
	});

	it("accepts a plain string error", () => {
		expect(resolveAuthErrorMessage("network down")).toBe("network down");
	});
});

describe("isAccountLockedError", () => {
	it("returns true only for ACCOUNT_LOCKED with a full lockout payload", () => {
		const locked = new ApiError({ message: "locked", error: "ACCOUNT_LOCKED", lockedUntil: epochMs(Date.parse("2026-08-04T12:49:00.000Z")), remainingSeconds: 299 });
		expect(isAccountLockedError(locked)).toBe(true);
	});

	it("returns false for other codes", () => {
		const invalid = new ApiError({ message: "bad", error: "INVALID_CREDENTIALS" });
		expect(isAccountLockedError(invalid)).toBe(false);
	});

	it("returns false when the lockout payload is missing", () => {
		const partial = new ApiError({ message: "locked", error: "ACCOUNT_LOCKED" });
		expect(isAccountLockedError(partial)).toBe(false);
	});

	it("returns false for non-ApiError values", () => {
		expect(isAccountLockedError(new Error("boom"))).toBe(false);
		expect(isAccountLockedError("ACCOUNT_LOCKED")).toBe(false);
	});
});
