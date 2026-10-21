import { describe, expect, it } from "vitest";

import { resolveAuthErrorMessage } from "../error-messages";
import { ApiError } from "../use-api";

describe("ApiError", () => {
	it("preserves the code, status and message from the server body", () => {
		const err = new ApiError({ message: "Invalid email or password", error: "INVALID_CREDENTIALS", statusCode: 401 });

		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("ApiError");
		expect(err.message).toBe("Invalid email or password");
		expect(err.error).toBe("INVALID_CREDENTIALS");
		expect(err.statusCode).toBe(401);
	});

	it("is usable without optional fields", () => {
		const err = new ApiError({ message: "Invalid email or password" });
		expect(err.error).toBeUndefined();
		expect(err.statusCode).toBeUndefined();
	});
});

describe("resolveAuthErrorMessage", () => {
	it.each([
		["TENANT_SUSPENDED", "This business is suspended. Only its status and appeal pages are available until it is reinstated."],
		["MEMBERSHIP_INACTIVE", "Your membership in this business is not active. Ask its owner to reactivate it, or leave the business."],
		["TENANT_OWNER_CANNOT_LEAVE", "The owner cannot leave the business."],
	])("maps the tenant-access code %s to the app's own message, never the server text", (code, message) => {
		expect(resolveAuthErrorMessage(new ApiError({ message: "Server text", error: code, statusCode: 403 }))).toBe(message);
	});

	it("maps a known auth error code to the friendly catalog string", () => {
		const err = new ApiError({ message: "Invalid email or password", error: "INVALID_CREDENTIALS" });
		expect(resolveAuthErrorMessage(err)).toBe("Incorrect email or password. Please try again.");
	});

	it("has no lockout code: a locked account answers INVALID_CREDENTIALS (no account probing), so ACCOUNT_LOCKED is just an unknown code", () => {
		const err = new ApiError({ message: "Server text", error: "ACCOUNT_LOCKED" });
		expect(resolveAuthErrorMessage(err)).toBe("Server text");
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
