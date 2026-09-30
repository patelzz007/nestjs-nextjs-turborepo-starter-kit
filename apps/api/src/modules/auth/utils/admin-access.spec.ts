import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AccessTokenPayload, RefreshTokenPayload } from "../services/token.service";

import { ADMIN_ACCESS_ERROR, requireAdminAccessToken, userHasAdminAccess, userHasElevatedAdminAccess } from "./admin-access";

const adminAccessToken: AccessTokenPayload = {
	sub: "admin-1",
	id: "admin-1",
	email: "admin@example.com",
	fullName: "Admin User",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	hasAdminAccess: true,
	tokenVersion: 1,
};

const plainUserToken: AccessTokenPayload = {
	...adminAccessToken,
	sub: "user-1",
	id: "user-1",
	hasAdminAccess: false,
};

const refreshToken: RefreshTokenPayload = {
	sub: "user-1",
	email: "user@example.com",
	jti: "refresh-jti",
	tokenType: "refresh",
	iat: 1_700_000_000,
	exp: 1_700_604_800,
};

describe("userHasAdminAccess", () => {
	it("returns false for undefined", () => {
		expect(userHasAdminAccess(undefined)).toBe(false);
	});

	it("returns false for refresh tokens", () => {
		expect(userHasAdminAccess(refreshToken)).toBe(false);
	});

	it("returns false when hasAdminAccess is false", () => {
		expect(userHasAdminAccess(plainUserToken)).toBe(false);
	});

	it("returns true for access tokens with hasAdminAccess", () => {
		expect(userHasAdminAccess(adminAccessToken)).toBe(true);
	});
});

describe("userHasElevatedAdminAccess", () => {
	it("returns true for super admins even without hasAdminAccess", () => {
		const superAdmin: AccessTokenPayload = { ...plainUserToken, isSuperAdmin: true, hasAdminAccess: false };
		expect(userHasElevatedAdminAccess(superAdmin)).toBe(true);
	});

	it("returns true when hasAdminAccess is set", () => {
		expect(userHasElevatedAdminAccess(adminAccessToken)).toBe(true);
	});

	it("returns false for plain users", () => {
		expect(userHasElevatedAdminAccess(plainUserToken)).toBe(false);
	});
});

describe("requireAdminAccessToken", () => {
	it("returns the access token when admin access is present", () => {
		expect(requireAdminAccessToken(adminAccessToken)).toBe(adminAccessToken);
	});

	it("throws ForbiddenException with the configured message", () => {
		try {
			requireAdminAccessToken(plainUserToken, "Custom admin message");
			throw new Error("Expected requireAdminAccessToken to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(ForbiddenException);
			if (!(error instanceof ForbiddenException)) {
				throw error;
			}
			const response = z.object({ message: z.string(), error: z.string() }).parse(error.getResponse());
			expect(response.message).toBe("Custom admin message");
			expect(response.error).toBe(ADMIN_ACCESS_ERROR);
		}
	});
});
