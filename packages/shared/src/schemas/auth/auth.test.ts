import { describe, expect, it } from "vitest";

import { epochMs } from "../api/common";

import { AUTH_COOKIE_NAMES, clientTypeHeader, CLIENT_TYPE_HEADER } from "../../contracts/client-session";
import {
	AuthClientTypeSchema,
	authTokenTransportOf,
	BrowserClientTypeSchema,
	isBrowserClientType,
	LoginClientResponseSchema,
	LoginMobileResponseSchema,
	LoginRestrictedEnrollmentMobileResponseSchema,
	REFRESH_TOKEN_MAX_LENGTH,
	RefreshClientResponseSchema,
	RefreshTokenBodySchema,
	RefreshTokenInputSchema,
	type AuthClientType,
	type BodyTokenFields,
	type LoginClientResponse,
	type RefreshClientResponse,
} from "./auth";
import { UserResponseSchema, type UserResponse } from "./user";

const EPOCH_ORIGIN_MS = 0;

const user: UserResponse = UserResponseSchema.parse({
	id: "user-1",
	email: "user@example.com",
	fullName: "Test User",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	twoFactorEnabled: false,
	hasAdminAccess: false,
	tokenVersion: 0,
	roles: [],
	createdAt: epochMs(EPOCH_ORIGIN_MS),
	updatedAt: epochMs(EPOCH_ORIGIN_MS),
	isDeleted: false,
	deletedAt: null,
});

describe("LoginClientResponseSchema (every variant round-trips intact)", () => {
	it("keeps a full login success", () => {
		const payload: LoginClientResponse = { user };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("keeps every field of a restricted-enrollment result that carries a user (not swallowed by the { user } variant)", () => {
		const payload: LoginClientResponse = {
			requiresEnrollment: true,
			enrollmentReason: "mfa_enrollment",
			message: "Complete MFA enrollment to continue.",
			user,
			organizationSlug: "acme-coffee",
		};

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("keeps a restricted-enrollment result without a user", () => {
		const payload: LoginClientResponse = { requiresEnrollment: true, enrollmentReason: "email_verification", message: "Verify your email." };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("keeps a 2FA-pending result", () => {
		const payload: LoginClientResponse = { requiresTwoFactor: true, tempToken: "pending-token", message: "Enter your 2FA code." };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("keeps a verification-pending result", () => {
		const payload: LoginClientResponse = { requiresVerification: true, verificationId: "verification-1", message: "Check your email." };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("strips tokens that are still in the body (they belong in httpOnly cookies only)", () => {
		const parsed: LoginClientResponse = LoginClientResponseSchema.parse({ user, accessToken: "access-jwt", refreshToken: "refresh-jwt" });

		expect(parsed).toEqual({ user });
		expect(parsed).not.toHaveProperty("accessToken");
		expect(parsed).not.toHaveProperty("refreshToken");
	});

	it("strips tokens from a restricted-enrollment result and keeps the rest", () => {
		const parsed: LoginClientResponse = LoginClientResponseSchema.parse({
			requiresEnrollment: true,
			enrollmentReason: "mfa_enrollment",
			message: "Complete MFA enrollment to continue.",
			user,
			accessToken: "access-jwt",
			refreshToken: "refresh-jwt",
		});

		expect(parsed).toEqual({ requiresEnrollment: true, enrollmentReason: "mfa_enrollment", message: "Complete MFA enrollment to continue.", user });
	});

	it("rejects a payload that matches no variant", () => {
		expect(LoginClientResponseSchema.safeParse({ message: "nothing else" }).success).toBe(false);
	});
});

describe("LoginClientResponseSchema (token-bearing variants for client type mobile)", () => {
	const bodyTokens: BodyTokenFields = { tokenTransport: "body", accessToken: "access-jwt", refreshToken: "refresh-jwt" };

	it("keeps the tokens of a full mobile login (marked tokenTransport: body)", () => {
		const payload: LoginClientResponse = { user, ...bodyTokens };

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
		expect(LoginMobileResponseSchema.safeParse(payload).success).toBe(true);
	});

	it("keeps every field and the tokens of a mobile restricted-enrollment result", () => {
		const payload: LoginClientResponse = {
			requiresEnrollment: true,
			enrollmentReason: "mfa_enrollment",
			message: "Complete MFA enrollment to continue.",
			user,
			...bodyTokens,
		};

		expect(LoginClientResponseSchema.parse(payload)).toEqual(payload);
		expect(LoginRestrictedEnrollmentMobileResponseSchema.safeParse(payload).success).toBe(true);
	});

	it("never matches a token-bearing variant without the body-transport marker, so a browser body cannot leak tokens", () => {
		expect(LoginMobileResponseSchema.safeParse({ user, accessToken: "access-jwt", refreshToken: "refresh-jwt" }).success).toBe(false);
		expect(LoginClientResponseSchema.parse({ user, accessToken: "access-jwt", refreshToken: "refresh-jwt", tokenTransport: "cookie" })).toEqual({ user });
	});

	it("requires both tokens on a token-bearing variant (one token alone falls back to the stripped browser variant)", () => {
		expect(LoginClientResponseSchema.parse({ user, tokenTransport: "body", accessToken: "access-jwt" })).toEqual({ user });
		expect(LoginMobileResponseSchema.safeParse({ user, tokenTransport: "body", accessToken: "", refreshToken: "refresh-jwt" }).success).toBe(false);
	});
});

describe("RefreshClientResponseSchema", () => {
	it("keeps the rotated tokens of a mobile refresh", () => {
		const payload: RefreshClientResponse = { message: "Tokens refreshed successfully", tokenTransport: "body", accessToken: "access-jwt", refreshToken: "refresh-jwt" };

		expect(RefreshClientResponseSchema.parse(payload)).toEqual(payload);
	});

	it("strips tokens from a browser refresh body that has no body-transport marker", () => {
		expect(RefreshClientResponseSchema.parse({ message: "Tokens refreshed successfully", accessToken: "access-jwt", refreshToken: "refresh-jwt" })).toEqual({
			message: "Tokens refreshed successfully",
		});
	});
});

describe("RefreshTokenInputSchema / RefreshTokenBodySchema", () => {
	it("accepts a missing body (the edge proxy refresh sends none) and an empty one as no body token", () => {
		expect(RefreshTokenInputSchema.parse(undefined)).toEqual({});
		expect(RefreshTokenInputSchema.parse({})).toEqual({});
	});

	it("accepts a refresh token up to the bound and rejects an empty, oversized or non-string one", () => {
		expect(RefreshTokenInputSchema.parse({ refreshToken: "r".repeat(REFRESH_TOKEN_MAX_LENGTH) })).toEqual({ refreshToken: "r".repeat(REFRESH_TOKEN_MAX_LENGTH) });
		expect(RefreshTokenInputSchema.safeParse({ refreshToken: "" }).success).toBe(false);
		expect(RefreshTokenInputSchema.safeParse({ refreshToken: "r".repeat(REFRESH_TOKEN_MAX_LENGTH + 1) }).success).toBe(false);
		expect(RefreshTokenInputSchema.safeParse({ refreshToken: 42 }).success).toBe(false);
	});

	it("rejects unknown keys", () => {
		expect(RefreshTokenInputSchema.safeParse({ refreshToken: "r", accessToken: "a" }).success).toBe(false);
		expect(RefreshTokenBodySchema.safeParse({ refreshToken: "r", extra: true }).success).toBe(false);
	});

	it("requires the token in the mobile body schema", () => {
		expect(RefreshTokenBodySchema.parse({ refreshToken: "r" })).toEqual({ refreshToken: "r" });
		expect(RefreshTokenBodySchema.safeParse({}).success).toBe(false);
	});
});

describe("client types", () => {
	it("knows the three browser apps and the mobile app", () => {
		expect(AuthClientTypeSchema.options).toEqual(["web", "admin", "merchant", "mobile"]);
		expect(BrowserClientTypeSchema.options).toEqual(["web", "admin", "merchant"]);
	});

	it.each<[AuthClientType, boolean]>([
		["web", true],
		["admin", true],
		["merchant", true],
		["mobile", false],
	])("isBrowserClientType(%s) is %s", (clientType: AuthClientType, expected: boolean) => {
		expect(isBrowserClientType(clientType)).toBe(expected);
	});

	it("delivers tokens by cookie to browsers and by body to mobile", () => {
		expect(authTokenTransportOf("web")).toBe("cookie");
		expect(authTokenTransportOf("admin")).toBe("cookie");
		expect(authTokenTransportOf("merchant")).toBe("cookie");
		expect(authTokenTransportOf("mobile")).toBe("body");
	});

	it("has a cookie pair for every browser client type and none for mobile", () => {
		expect(Object.keys(AUTH_COOKIE_NAMES).sort()).toEqual([...BrowserClientTypeSchema.options].sort());
		expect(Object.keys(AUTH_COOKIE_NAMES)).not.toContain("mobile");
	});

	it("builds the X-Client-Type header for every client type, mobile included", () => {
		expect(clientTypeHeader("mobile")).toEqual({ [CLIENT_TYPE_HEADER]: "mobile" });
	});
});
