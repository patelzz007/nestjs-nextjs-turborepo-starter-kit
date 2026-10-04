import "reflect-metadata";
import { type CallHandler, type CanActivate, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import {
	API_VERSION_PREFIX,
	epochMs,
	LoginClientResponseSchema,
	UserResponseSchema,
	type JsonValue,
	type LoginRestrictedEnrollmentResponse,
	type LoginServiceResponse,
	type LoginTwoFactorPendingResponse,
	type UserResponse,
} from "@workspace/shared";
import { tap, type Observable } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getResponseContract, type RouteResponseContract } from "../../common/decorators/zod-response.decorators";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./guards/auth.guard";
import { EmailVerifiedGuard } from "./guards/email-verified.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import type { AccessTokenPayload } from "./services/token.service";

/**
 * AuthController inside a real Nest testing module on Fastify. Every
 * route-level guard and interceptor is overridden with a typed double (the
 * real ones need the whole auth/token/cookie graph) and AuthService is a typed
 * double, so these tests pin the controller's own contract: routing, input
 * validation, header/query precedence, guard wiring, and delegation.
 * App-level (global) guards — authentication, throttling, the authorization
 * kernel — are not part of this module; their own specs and the e2e suites
 * cover them.
 */

const AUTH_PREFIX = `${API_VERSION_PREFIX}/auth`;
const USER_ID = "3f1c2b7a-9d4e-4f6a-8b2c-1d0e9f8a7b6c";
const STRONG_PASSWORD = "Str0ng!Passw0rd";
const USER_AGENT = "auth-controller-spec";
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;

const CORRELATION_ID = "auth-controller-spec-correlation";
const EPOCH_ORIGIN_MS = 0;

/** Every AuthController route handler — asserted complete below, so a new route cannot dodge the wiring checks. */
const ROUTE_HANDLERS: readonly (keyof AuthController)[] = [
	"signup",
	"login",
	"resendVerification",
	"forgotPassword",
	"resetPassword",
	"validateResetToken",
	"verifyLogin",
	"changePassword",
	"getMe",
	"getSessionPermissions",
	"verifyEmail",
	"getAdminUsersList",
	"getAdminUserDetail",
	"unlockUser",
];

type AuthServiceMethod =
	| "signup"
	| "login"
	| "resendVerificationEmail"
	| "forgotPassword"
	| "resetPassword"
	| "validateResetToken"
	| "verifyLogin"
	| "changePassword"
	| "getMe"
	| "getSessionPermissions"
	| "verifyEmail"
	| "getAdminUsersList"
	| "getAdminUserDetail"
	| "unlockUser";

/** Typed stand-in for AuthService: one mock per method the controller calls. */
class AuthServiceDouble implements Pick<AuthService, AuthServiceMethod> {
	public readonly signup = vi.fn<AuthService["signup"]>();
	public readonly login = vi.fn<AuthService["login"]>();
	public readonly resendVerificationEmail = vi.fn<AuthService["resendVerificationEmail"]>();
	public readonly forgotPassword = vi.fn<AuthService["forgotPassword"]>();
	public readonly resetPassword = vi.fn<AuthService["resetPassword"]>();
	public readonly validateResetToken = vi.fn<AuthService["validateResetToken"]>();
	public readonly verifyLogin = vi.fn<AuthService["verifyLogin"]>();
	public readonly changePassword = vi.fn<AuthService["changePassword"]>();
	public readonly getMe = vi.fn<AuthService["getMe"]>();
	public readonly getSessionPermissions = vi.fn<AuthService["getSessionPermissions"]>();
	public readonly verifyEmail = vi.fn<AuthService["verifyEmail"]>();
	public readonly getAdminUsersList = vi.fn<AuthService["getAdminUsersList"]>();
	public readonly getAdminUserDetail = vi.fn<AuthService["getAdminUserDetail"]>();
	public readonly unlockUser = vi.fn<AuthService["unlockUser"]>();
}

/** Route-guard double: counts calls and allows or denies on demand. */
class GuardDouble implements CanActivate {
	public allow = true;
	public calls = 0;

	public canActivate(): boolean {
		this.calls += 1;
		return this.allow;
	}
}

/** SetAuthCookiesInterceptor double: passes the handler result through unchanged and counts calls. */
class PassThroughInterceptor implements NestInterceptor<JsonValue, JsonValue> {
	public calls = 0;

	public intercept(_context: ExecutionContext, next: CallHandler<JsonValue>): Observable<JsonValue> {
		return next.handle().pipe(
			tap((): void => {
				this.calls += 1;
			}),
		);
	}
}

describe("AuthController", () => {
	let app: NestFastifyApplication;
	let controller: AuthController;
	let authService: AuthServiceDouble;
	let authGuard: GuardDouble;
	let superAdminGuard: GuardDouble;
	let emailVerifiedGuard: GuardDouble;
	let authCookies: PassThroughInterceptor;

	beforeEach(async () => {
		authService = new AuthServiceDouble();
		authGuard = new GuardDouble();
		superAdminGuard = new GuardDouble();
		emailVerifiedGuard = new GuardDouble();
		authCookies = new PassThroughInterceptor();

		const moduleRef = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [{ provide: AuthService, useValue: authService }],
		})
			.overrideGuard(AuthGuard)
			.useValue(authGuard)
			.overrideGuard(SuperAdminGuard)
			.useValue(superAdminGuard)
			.overrideGuard(EmailVerifiedGuard)
			.useValue(emailVerifiedGuard)
			.overrideInterceptor(SetAuthCookiesInterceptor)
			.useValue(authCookies)
			.compile();

		controller = moduleRef.get(AuthController);
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	afterEach(async () => {
		await app.close();
	});

	describe("route wiring", () => {
		it("compiles with every route guard and interceptor overridden, and serves every handler", () => {
			const declared: string[] = Object.getOwnPropertyNames(AuthController.prototype).filter((name: string): boolean => name !== "constructor");

			expect([...declared].sort()).toEqual([...ROUTE_HANDLERS].sort());
			expect(controller).toBeInstanceOf(AuthController);
		});

		it("lists admin users behind the authentication and super-admin guards only", async () => {
			authService.getAdminUsersList.mockResolvedValue({ items: [], limit: 20, total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false });

			const response = await app.inject({ method: "GET", url: `${AUTH_PREFIX}/admin/users?search=alex` });

			expect(response.statusCode).toBe(HTTP_OK);
			expect(authService.getAdminUsersList).toHaveBeenCalledWith(expect.objectContaining({ search: "alex", page: 1, limit: 20 }));
			expect([authGuard.calls, superAdminGuard.calls, emailVerifiedGuard.calls]).toEqual([1, 1, 0]);
		});

		it("answers 403 for the admin user list when the super-admin guard denies", async () => {
			superAdminGuard.allow = false;

			const response = await app.inject({ method: "GET", url: `${AUTH_PREFIX}/admin/users` });

			expect(response.statusCode).toBe(HTTP_FORBIDDEN);
			expect(authService.getAdminUsersList).not.toHaveBeenCalled();
		});

		it("runs the auth-cookie interceptor on the token-issuing routes and nowhere else", async () => {
			authService.verifyLogin.mockResolvedValue({
				requiresEnrollment: true,
				enrollmentReason: "mfa_enrollment",
				message: "Set up two-factor authentication",
				accessToken: "restricted-access-token",
				refreshToken: "restricted-refresh-token",
			});
			authService.signup.mockResolvedValue({ message: "Check your inbox" });

			const verified = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/verify-login`, payload: { verificationId: "verification-1", code: "123456" } });
			expect(verified.statusCode).toBe(HTTP_OK);
			expect(authCookies.calls).toBe(1);

			await app.inject({ method: "POST", url: `${AUTH_PREFIX}/signup`, payload: { email: "new.user@example.com", password: STRONG_PASSWORD, fullName: "New User" } });
			expect(authCookies.calls).toBe(1);
		});
	});

	describe("HTTP", () => {
		it("signs up with a validated body and prefers the X-Client-Type header over the query parameter", async () => {
			authService.signup.mockResolvedValue({ message: "Check your inbox" });
			const body = { email: "new.user@example.com", password: STRONG_PASSWORD, fullName: "New User" };

			const response = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/signup?client_type=web`, headers: { "x-client-type": "merchant" }, payload: body });

			expect(response.statusCode).toBe(HTTP_CREATED);
			expect(response.json()).toEqual({ message: "Check your inbox" });
			expect(authService.signup).toHaveBeenCalledWith(body, "merchant");
		});

		it("falls back to the client_type query parameter (Swagger UI) when no header is sent", async () => {
			authService.forgotPassword.mockResolvedValue({ message: "If the account exists, an email was sent" });

			const response = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/forgot-password?client_type=admin`, payload: { email: "admin@example.com" } });

			expect(response.statusCode).toBe(HTTP_OK);
			expect(authService.forgotPassword).toHaveBeenCalledWith({ email: "admin@example.com" }, "admin");
		});

		it("rejects an invalid body with 400 before the service runs", async () => {
			const response = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/signup`, payload: { email: "not-an-email", password: "weak", fullName: "N" } });

			expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
			expect(authService.signup).not.toHaveBeenCalled();
		});

		it("rejects unknown body keys (strict contract schemas)", async () => {
			const response = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/forgot-password`, payload: { email: "admin@example.com", isSuperAdmin: true } });

			expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
			expect(authService.forgotPassword).not.toHaveBeenCalled();
		});

		it("logs in with the client type, user agent and the TCP peer's IP — a spoofed X-Forwarded-For from an untrusted client is ignored", async () => {
			const pending: LoginTwoFactorPendingResponse = { requiresTwoFactor: true, tempToken: "temp-token", message: "Enter your 2FA code" };
			authService.login.mockResolvedValue(pending);
			const body = { email: "admin@example.com", password: STRONG_PASSWORD };

			const response = await app.inject({
				method: "POST",
				url: `${AUTH_PREFIX}/login`,
				remoteAddress: "198.51.100.23",
				headers: { "x-client-type": "admin", "user-agent": USER_AGENT, "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
				payload: body,
			});

			expect(response.statusCode).toBe(HTTP_CREATED);
			expect(response.json()).toEqual(pending);
			expect(authService.login).toHaveBeenCalledWith(body, "admin", USER_AGENT, "198.51.100.23");
			expect(authCookies.calls).toBe(1);
		});

		it("answers 200 (not 201) for the password-reset and verification POSTs", async () => {
			authService.resetPassword.mockResolvedValue({ message: "Password reset" });
			authService.resendVerificationEmail.mockResolvedValue({ message: "Sent" });

			const reset = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/reset-password`, payload: { token: "reset-token", password: STRONG_PASSWORD } });
			const resend = await app.inject({
				method: "POST",
				url: `${AUTH_PREFIX}/resend-verification`,
				headers: { "x-client-type": "merchant" },
				payload: { email: "m@example.com" },
			});

			expect([reset.statusCode, resend.statusCode]).toEqual([HTTP_OK, HTTP_OK]);
			expect(authService.resetPassword).toHaveBeenCalledWith({ token: "reset-token", password: STRONG_PASSWORD });
			expect(authService.resendVerificationEmail).toHaveBeenCalledWith({ email: "m@example.com" }, "merchant");
		});

		it("verifies an email by passing only the token to the service", async () => {
			authService.verifyEmail.mockResolvedValue({ message: "Email verified", alreadyVerified: false });

			const response = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/verify-email`, payload: { token: "verify-token" } });

			expect(response.statusCode).toBe(HTTP_CREATED);
			expect(authService.verifyEmail).toHaveBeenCalledWith("verify-token");
		});

		it("unlocks a user only after all three route guards pass", async () => {
			authService.unlockUser.mockResolvedValue({ message: "Account unlocked" });

			const response = await app.inject({ method: "PATCH", url: `${AUTH_PREFIX}/admin/users/${USER_ID}/unlock` });

			expect(response.statusCode).toBe(HTTP_OK);
			expect(response.json()).toEqual({ message: "Account unlocked" });
			expect(authService.unlockUser).toHaveBeenCalledWith(USER_ID);
			expect([authGuard.calls, superAdminGuard.calls, emailVerifiedGuard.calls]).toEqual([1, 1, 1]);
		});

		it("answers 403 and never unlocks when the super-admin guard denies", async () => {
			superAdminGuard.allow = false;

			const response = await app.inject({ method: "PATCH", url: `${AUTH_PREFIX}/admin/users/${USER_ID}/unlock` });

			expect(response.statusCode).toBe(HTTP_FORBIDDEN);
			expect(authService.unlockUser).not.toHaveBeenCalled();
			expect([emailVerifiedGuard.calls, authGuard.calls, superAdminGuard.calls]).toEqual([1, 1, 1]);
		});

		it("answers 403 and stops at the first guard when the email is not verified", async () => {
			emailVerifiedGuard.allow = false;

			const response = await app.inject({ method: "PATCH", url: `${AUTH_PREFIX}/admin/users/${USER_ID}/unlock` });

			expect(response.statusCode).toBe(HTTP_FORBIDDEN);
			expect(authService.unlockUser).not.toHaveBeenCalled();
			expect([authGuard.calls, superAdminGuard.calls]).toEqual([0, 0]);
		});

		it("rejects a non-UUID user id with 400", async () => {
			const response = await app.inject({ method: "GET", url: `${AUTH_PREFIX}/admin/users/not-a-uuid` });

			expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
			expect(authService.getAdminUserDetail).not.toHaveBeenCalled();
		});
	});

	describe("handlers", () => {
		const accessPayload: AccessTokenPayload = {
			sub: USER_ID,
			id: USER_ID,
			email: "user@example.com",
			fullName: "Test User",
			isActive: true,
			isSuperAdmin: false,
			isEmailVerified: true,
			hasAdminAccess: false,
			tokenVersion: 1,
		};

		it("changes the password of the authenticated user only (id from the token, never the body)", async () => {
			authService.changePassword.mockResolvedValue({ message: "Password changed" });
			const body = { currentPassword: STRONG_PASSWORD, newPassword: `${STRONG_PASSWORD}2`, confirmPassword: `${STRONG_PASSWORD}2` };

			await expect(controller.changePassword(USER_ID, body)).resolves.toEqual({ message: "Password changed" });
			expect(authService.changePassword).toHaveBeenCalledWith(USER_ID, body);
		});

		it("forwards the verified token payload for the session permissions view", async () => {
			authService.getSessionPermissions.mockResolvedValue({ roles: [], permissions: [], tokenVersion: 1, hasAdminAccess: false, capabilities: [], sessionScope: "full" });

			await controller.getSessionPermissions(USER_ID, accessPayload);

			expect(authService.getSessionPermissions).toHaveBeenCalledWith(USER_ID, accessPayload);
		});

		it("validates a reset token without consuming it", async () => {
			authService.validateResetToken.mockResolvedValue({ valid: true });

			await expect(controller.validateResetToken({ token: "reset-token" })).resolves.toEqual({ valid: true });
			expect(authService.validateResetToken).toHaveBeenCalledWith({ token: "reset-token" });
		});
	});

	describe("response contracts (ADR 022)", () => {
		const user: UserResponse = UserResponseSchema.parse({
			id: USER_ID,
			email: "user@example.com",
			fullName: "Test User",
			isActive: true,
			isSuperAdmin: false,
			isEmailVerified: true,
			twoFactorEnabled: false,
			hasAdminAccess: false,
			tokenVersion: 1,
			roles: [],
			createdAt: epochMs(EPOCH_ORIGIN_MS),
			updatedAt: epochMs(EPOCH_ORIGIN_MS),
			isDeleted: false,
			deletedAt: null,
		});

		/** The handler function itself — the key `ExecutionContext.getHandler()` returns and contracts are registered under. */
		function handlerOf<TKey extends keyof AuthController>(key: TKey): AuthController[TKey] {
			const descriptor: TypedPropertyDescriptor<AuthController[TKey]> | undefined = Object.getOwnPropertyDescriptor(AuthController.prototype, key);
			const handler: AuthController[TKey] | undefined = descriptor?.value;
			if (handler === undefined) {
				throw new Error(`AuthController.${key} missing`);
			}
			return handler;
		}

		function contractOf(handler: keyof AuthController): RouteResponseContract {
			const contract: RouteResponseContract | undefined = getResponseContract(handlerOf(handler));
			if (contract === undefined) {
				throw new Error(`AuthController.${handler} has no response contract`);
			}
			return contract;
		}

		it("registers a response contract on every route handler", () => {
			const missing: string[] = ROUTE_HANDLERS.filter((handler: keyof AuthController): boolean => getResponseContract(handlerOf(handler)) === undefined);

			expect(missing).toEqual([]);
		});

		it("documents the token-issuing routes with the client body schema and keeps their wire status", () => {
			expect([contractOf("login").schema, contractOf("verifyLogin").schema]).toEqual([LoginClientResponseSchema, LoginClientResponseSchema]);
			expect([contractOf("login").status, contractOf("verifyLogin").status]).toEqual([HTTP_CREATED, HTTP_OK]);
		});

		it("never lets a token reach the JSON body of a full login, even if the cookie interceptor left it there", () => {
			const result: LoginServiceResponse = { user, accessToken: "access-jwt", refreshToken: "refresh-jwt" };

			const body = ResponseInterceptor.toBody(contractOf("login"), result, "AuthController.login", CORRELATION_ID);

			expect(body).toMatchObject({ success: true, data: { user } });
			expect(JSON.stringify(body)).not.toContain("access-jwt");
			expect(JSON.stringify(body)).not.toContain("refresh-jwt");
		});

		it("keeps every field of a restricted-enrollment login that carries a user, and strips its tokens", () => {
			const result: LoginRestrictedEnrollmentResponse = {
				requiresEnrollment: true,
				enrollmentReason: "mfa_enrollment",
				message: "Set up two-factor authentication",
				user,
				organizationSlug: "acme-coffee",
				accessToken: "restricted-access-jwt",
				refreshToken: "restricted-refresh-jwt",
			};

			const body = ResponseInterceptor.toBody(contractOf("verifyLogin"), result, "AuthController.verifyLogin", CORRELATION_ID);

			expect(body).toMatchObject({ success: true, meta: { correlationId: CORRELATION_ID } });
			expect(body).toHaveProperty("data", {
				requiresEnrollment: true,
				enrollmentReason: "mfa_enrollment",
				message: "Set up two-factor authentication",
				user,
				organizationSlug: "acme-coffee",
			});
		});
	});
});
