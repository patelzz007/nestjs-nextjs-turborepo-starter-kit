import { HttpStatus, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessTokenPayload } from "@workspace/shared";

import { accessToken, createHttpContext, testRequest, type TestHttpRequest } from "../../../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { DependencyUnavailableError, ValidationError } from "../../../../../platform/application/errors/app-error";
import type { AccessTokenStatePort, ImpersonationTokenCheckPort } from "../../../../../platform/application/ports/access-token.port";
import { RequestContextService, type RequestPrincipal } from "../../../../../platform/infrastructure/context/request-context";
import { AuthGuard, readAccessTokenCookie, readBearerToken } from "../../../../../platform/presentation/http/security/guards/auth.guard";
import { OptionalRefreshTokenGuard, readPresentedRefreshToken, RefreshTokenGuard } from "../../../../../platform/presentation/http/security/guards/refresh-token.guard";
import { TokenService } from "../token.service";

/** Server-side revocation state the guard reads through its ports (account state + impersonation sessions). */
const revocationState = {
	assertTokenValid: vi.fn<(userId: string, tokenVersion: number, sessionId?: string) => Promise<void>>(),
	assertLiveIfImpersonating: vi.fn<(payload: AccessTokenPayload) => Promise<void>>(),
};

const accessTokenState: AccessTokenStatePort = {
	assertTokenValid: (userId: string, tokenVersion: number, sessionId?: string): Promise<void> => revocationState.assertTokenValid(userId, tokenVersion, sessionId),
	invalidate: (): void => undefined,
};

const impersonationCheck: ImpersonationTokenCheckPort = {
	assertLiveIfImpersonating: (payload: AccessTokenPayload): Promise<void> => revocationState.assertLiveIfImpersonating(payload),
};

const config = createTestTypedConfig();
/** The refresh payload schema requires `exp`, so test tokens carry a short lifetime. */
const REFRESH_TOKEN_TTL_SECONDS = 60;
const jwt = new JwtService();
const tokens = new TokenService(jwt, config);
const requestContext = new RequestContextService();

interface CookieRequest extends TestHttpRequest {
	readonly cookies: Readonly<Record<string, string>>;
}

function requestWith(headers: Record<string, string>, cookies: Record<string, string> = {}, body?: Record<string, string | number | boolean>): CookieRequest {
	return { ...testRequest({ headers, ...(body === undefined ? {} : { body }) }), cookies };
}

/** A mobile request: client type `mobile`, optionally with a refresh-token body. */
function mobileRequest(headers: Record<string, string> = {}, cookies: Record<string, string> = {}, body?: Record<string, string | number | boolean>): CookieRequest {
	return requestWith({ "x-client-type": "mobile", ...headers }, cookies, body);
}

async function signRefreshToken(sub: string): Promise<string> {
	return jwt.signAsync({ sub, email: "u@example.com", jti: "jti-1", tokenType: "refresh" }, { secret: config.auth.jwtRefreshSecret, expiresIn: REFRESH_TOKEN_TTL_SECONDS });
}

/** Runs `activate` inside a fresh request context and returns the principal it left behind. */
async function principalAfter(activate: () => Promise<boolean>): Promise<RequestPrincipal | undefined> {
	return requestContext.run({ correlationId: "corr-auth", ip: undefined, userAgent: undefined, edgeLocation: undefined }, async () => {
		await activate();
		return requestContext.current()?.principal;
	});
}

function createAuthGuard(): AuthGuard {
	return new AuthGuard(tokens, accessTokenState, impersonationCheck, new Reflector(), requestContext);
}

beforeEach(() => {
	revocationState.assertTokenValid.mockReset();
	revocationState.assertTokenValid.mockResolvedValue(undefined);
	revocationState.assertLiveIfImpersonating.mockReset();
	revocationState.assertLiveIfImpersonating.mockResolvedValue(undefined);
});

describe("AuthGuard → request context", () => {
	const guard = createAuthGuard();

	it("binds the authenticated user as the principal, authenticated by a bearer token", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "user-42", id: "user-42" }), { secret: config.auth.jwtAccessSecret });
		const context = createHttpContext(requestWith({ authorization: `Bearer ${token}` }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({
			userId: "user-42",
			impersonatorId: undefined,
			impersonationSessionId: undefined,
			authMethod: "BEARER_TOKEN",
			sessionId: "session-1",
			identity: { email: "user@example.com", fullName: "Test User" },
		});
	});

	it("records the real super-admin and the impersonation session behind an impersonation token", async () => {
		const token: string = await jwt.signAsync(
			accessToken({ sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1", impersonationSessionId: "session-1" }),
			{
				secret: config.auth.jwtAccessSecret,
			},
		);
		const context = createHttpContext(requestWith({ authorization: `Bearer ${token}` }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({
			userId: "target-1",
			impersonatorId: "admin-1",
			impersonationSessionId: "session-1",
			authMethod: "BEARER_TOKEN",
			sessionId: "session-1",
			identity: { email: "user@example.com", fullName: "Test User" },
		});
	});

	it("falls back to the session cookie when the bearer header is blank", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "user-7", id: "user-7" }), { secret: config.auth.jwtAccessSecret });
		const context = createHttpContext(requestWith({ authorization: "Bearer " }, { accessToken: token }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({
			userId: "user-7",
			impersonatorId: undefined,
			impersonationSessionId: undefined,
			authMethod: "SESSION_COOKIE",
			sessionId: "session-1",
			identity: { email: "user@example.com", fullName: "Test User" },
		});
	});

	it("reads the admin cookie when X-Client-Type is admin (what Swagger UI sends by default)", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "admin-3", id: "admin-3" }), { secret: config.auth.jwtAccessSecret });
		const context = createHttpContext(requestWith({ "x-client-type": "admin" }, { adminAccessToken: token }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({
			userId: "admin-3",
			impersonatorId: undefined,
			impersonationSessionId: undefined,
			authMethod: "SESSION_COOKIE",
			sessionId: "session-1",
			identity: { email: "user@example.com", fullName: "Test User" },
		});
	});

	it("authenticates client type mobile by its bearer token", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "mobile-1", id: "mobile-1" }), { secret: config.auth.jwtAccessSecret });
		const context = createHttpContext(mobileRequest({ authorization: `Bearer ${token}` }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({
			userId: "mobile-1",
			impersonatorId: undefined,
			impersonationSessionId: undefined,
			authMethod: "BEARER_TOKEN",
			sessionId: "session-1",
			identity: { email: "user@example.com", fullName: "Test User" },
		});
	});

	it("never authenticates client type mobile by a cookie (bearer only, ADR 029)", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "user-8", id: "user-8" }), { secret: config.auth.jwtAccessSecret });
		const context = createHttpContext(mobileRequest({}, { accessToken: token, adminAccessToken: token, merchantAccessToken: token }));

		await expect(guard.canActivate(context)).rejects.toMatchObject({ response: { error: "ACCESS_TOKEN_MISSING" } });
	});

	it("binds nothing when authentication fails", async () => {
		const context = createHttpContext(requestWith({ authorization: "Bearer not-a-jwt" }));

		const principal = await requestContext.run({ correlationId: "corr-auth-fail", ip: undefined, userAgent: undefined, edgeLocation: undefined }, async () => {
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
			return requestContext.current()?.principal;
		});

		expect(principal).toBeUndefined();
	});
});

describe("AuthGuard → revocation state", () => {
	const guard = createAuthGuard();

	async function bearerContext(overrides: Parameters<typeof accessToken>[0]): Promise<ReturnType<typeof createHttpContext>> {
		const token: string = await jwt.signAsync(accessToken(overrides), { secret: config.auth.jwtAccessSecret });
		return createHttpContext(requestWith({ authorization: `Bearer ${token}` }));
	}

	it("answers 401 when the account state revokes the token (stale tokenVersion, inactive, deleted)", async () => {
		revocationState.assertTokenValid.mockRejectedValue(new UnauthorizedException({ message: "Token revoked", error: "TOKEN_VERSION_MISMATCH" }));

		await expect(guard.canActivate(await bearerContext({}))).rejects.toMatchObject({ response: { error: "TOKEN_VERSION_MISMATCH" } });
	});

	it("checks the token's device session (sid) together with its version — a revoked session answers 401 SESSION_REVOKED (ADR 034)", async () => {
		revocationState.assertTokenValid.mockRejectedValue(new UnauthorizedException({ message: "This device was signed out", error: "SESSION_REVOKED" }));

		await expect(guard.canActivate(await bearerContext({ sub: "user-5", id: "user-5", tokenVersion: 4, sid: "session-5" }))).rejects.toMatchObject({
			response: { error: "SESSION_REVOKED" },
		});
		expect(revocationState.assertTokenValid).toHaveBeenCalledWith("user-5", 4, "session-5");
	});

	it("checks a token without sid by its version only (minted before the claim existed)", async () => {
		await guard.canActivate(await bearerContext({ sub: "user-6", id: "user-6", tokenVersion: 2, sid: undefined }));

		expect(revocationState.assertTokenValid).toHaveBeenCalledWith("user-6", 2, undefined);
	});

	it("answers 503 — not 401 — when the revocation state cannot be read (database / cache outage)", async () => {
		const outage = new Error("connect ECONNREFUSED 127.0.0.1:5432");
		revocationState.assertTokenValid.mockRejectedValue(outage);

		const failure = guard.canActivate(await bearerContext({}));

		await expect(failure).rejects.toBeInstanceOf(DependencyUnavailableError);
		await expect(failure).rejects.toMatchObject({ httpStatus: HttpStatus.SERVICE_UNAVAILABLE, code: "SERVICE_UNAVAILABLE", cause: outage });
	});

	it("answers 503 when the impersonation-session lookup fails", async () => {
		revocationState.assertLiveIfImpersonating.mockRejectedValue(new Error("connection terminated"));

		await expect(
			guard.canActivate(await bearerContext({ sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1", impersonationSessionId: "session-1" })),
		).rejects.toBeInstanceOf(DependencyUnavailableError);
	});

	it("rejects an impersonation token whose server-side session ended (stopped) or is unknown", async () => {
		revocationState.assertLiveIfImpersonating.mockRejectedValue(new UnauthorizedException({ message: "ended", error: "IMPERSONATION_SESSION_INVALID" }));

		await expect(
			guard.canActivate(await bearerContext({ sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1", impersonationSessionId: "session-1" })),
		).rejects.toMatchObject({ response: { error: "IMPERSONATION_SESSION_INVALID" } });
		expect(revocationState.assertLiveIfImpersonating).toHaveBeenCalledWith(
			expect.objectContaining({ sub: "target-1", originalUserId: "admin-1", impersonationSessionId: "session-1" }),
		);
	});
});

describe("RefreshTokenGuard → request context", () => {
	const guard = new RefreshTokenGuard(tokens, requestContext);

	it("binds the refresh-token subject as the principal, authenticated by the refresh cookie", async () => {
		const token: string = await jwt.signAsync(
			{ sub: "user-9", email: "u@example.com", jti: "jti-1", tokenType: "refresh" },
			{ secret: config.auth.jwtRefreshSecret, expiresIn: REFRESH_TOKEN_TTL_SECONDS },
		);
		const context = createHttpContext(requestWith({}, { refreshToken: token }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({
			userId: "user-9",
			impersonatorId: undefined,
			impersonationSessionId: undefined,
			authMethod: "REFRESH_COOKIE",
			sessionId: "jti-1",
			identity: { email: "u@example.com", fullName: undefined },
		});
	});

	it("records a refresh token presented in the body (client type mobile) as REFRESH_BODY", async () => {
		const token: string = await signRefreshToken("user-10");
		const context = createHttpContext(mobileRequest({}, {}, { refreshToken: token }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({
			userId: "user-10",
			impersonatorId: undefined,
			impersonationSessionId: undefined,
			authMethod: "REFRESH_BODY",
			sessionId: "jti-1",
			identity: { email: "u@example.com", fullName: undefined },
		});
	});
});

describe("readBearerToken", () => {
	it("returns the token of a Bearer header", () => {
		expect(readBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
	});

	it("treats a missing, non-bearer or blank header as no bearer", () => {
		expect(readBearerToken(undefined)).toBeUndefined();
		expect(readBearerToken("Basic dXNlcjpwYXNz")).toBeUndefined();
		expect(readBearerToken("Bearer ")).toBeUndefined();
		expect(readBearerToken("Bearer    ")).toBeUndefined();
	});
});

describe("readPresentedRefreshToken", () => {
	it("reads the refresh cookie of the app selected by X-Client-Type", () => {
		const cookies = { refreshToken: "web-rt", adminRefreshToken: "admin-rt", merchantRefreshToken: "merchant-rt" };

		expect(readPresentedRefreshToken(requestWith({}, cookies))).toBe("web-rt");
		expect(readPresentedRefreshToken(requestWith({ "x-client-type": "admin" }, cookies))).toBe("admin-rt");
		expect(readPresentedRefreshToken(requestWith({ "x-client-type": "merchant" }, cookies))).toBe("merchant-rt");
	});

	it("reports an absent or empty cookie as no token (never an empty string)", () => {
		expect(readPresentedRefreshToken(requestWith({}))).toBeUndefined();
		expect(readPresentedRefreshToken(requestWith({}, { refreshToken: "" }))).toBeUndefined();
		expect(readPresentedRefreshToken(requestWith({ "x-client-type": "admin" }, { refreshToken: "web-rt" }))).toBeUndefined();
	});

	it("reads client type mobile's refresh token from the body and never from a cookie", () => {
		const cookies = { refreshToken: "web-rt", adminRefreshToken: "admin-rt", merchantRefreshToken: "merchant-rt" };

		expect(readPresentedRefreshToken(mobileRequest({}, {}, { refreshToken: "mobile-rt" }))).toBe("mobile-rt");
		expect(readPresentedRefreshToken(mobileRequest({}, cookies, { refreshToken: "mobile-rt" }))).toBe("mobile-rt");
		expect(readPresentedRefreshToken(mobileRequest({}, cookies))).toBeUndefined();
		expect(readPresentedRefreshToken(mobileRequest({}, cookies, {}))).toBeUndefined();
	});

	it.each(["web", "admin", "merchant"])("rejects a body refresh token from browser client type %s with 401, even next to a valid cookie", (clientType: string) => {
		const cookies = { refreshToken: "web-rt", adminRefreshToken: "admin-rt", merchantRefreshToken: "merchant-rt" };

		const read = (): string | undefined => readPresentedRefreshToken(requestWith({ "x-client-type": clientType }, cookies, { refreshToken: "from-body" }));

		expect(read).toThrow(UnauthorizedException);
		expect(read).toThrow("never in the request body");
	});

	it("treats an unknown client type as web: a body token is rejected", () => {
		expect(() => readPresentedRefreshToken(requestWith({ "x-client-type": "Mobile" }, {}, { refreshToken: "from-body" }))).toThrow(UnauthorizedException);
	});

	it("accepts the ?client_type= fallback like every other client-type reader", () => {
		expect(readPresentedRefreshToken({ ...mobileRequest({}, {}, { refreshToken: "mobile-rt" }), headers: {}, query: { client_type: "mobile" } })).toBe("mobile-rt");
	});

	it("rejects a malformed body with a 400 validation error (not a missing token)", () => {
		expect(() => readPresentedRefreshToken(mobileRequest({}, {}, { refreshToken: 42 }))).toThrow(ValidationError);
		expect(() => readPresentedRefreshToken(mobileRequest({}, {}, { refreshToken: "" }))).toThrow(ValidationError);
		expect(() => readPresentedRefreshToken(mobileRequest({}, {}, { refreshToken: "rt", extra: true }))).toThrow(ValidationError);
	});
});

describe("readAccessTokenCookie", () => {
	const cookies = { accessToken: "web-at", adminAccessToken: "admin-at", merchantAccessToken: "merchant-at" };

	it("reads the access cookie of the browser app selected by X-Client-Type", () => {
		expect(readAccessTokenCookie(requestWith({}, cookies))).toBe("web-at");
		expect(readAccessTokenCookie(requestWith({ "x-client-type": "admin" }, cookies))).toBe("admin-at");
		expect(readAccessTokenCookie(requestWith({ "x-client-type": "merchant" }, cookies))).toBe("merchant-at");
	});

	it("never reads a cookie for client type mobile", () => {
		expect(readAccessTokenCookie(mobileRequest({}, cookies))).toBeUndefined();
	});
});

describe("RefreshTokenGuard → token source per client type", () => {
	const guard = new RefreshTokenGuard(tokens, requestContext);

	it("verifies a mobile body refresh token and binds its subject", async () => {
		const token: string = await signRefreshToken("mobile-9");
		const request = mobileRequest({}, {}, { refreshToken: token });

		expect(await principalAfter(() => guard.canActivate(createHttpContext(request)))).toMatchObject({ userId: "mobile-9" });
		expect(request.user).toMatchObject({ sub: "mobile-9", tokenType: "refresh" });
	});

	it("rejects a mobile request that only carries a refresh cookie (401 REFRESH_TOKEN_MISSING)", async () => {
		const token: string = await signRefreshToken("user-9");

		await expect(guard.canActivate(createHttpContext(mobileRequest({}, { refreshToken: token })))).rejects.toMatchObject({ response: { error: "REFRESH_TOKEN_MISSING" } });
	});

	it("rejects a browser request that presents its refresh token in the body (401 REFRESH_TOKEN_TRANSPORT_MISMATCH)", async () => {
		const token: string = await signRefreshToken("user-9");

		await expect(guard.canActivate(createHttpContext(requestWith({}, { refreshToken: token }, { refreshToken: token })))).rejects.toMatchObject({
			response: { error: "REFRESH_TOKEN_TRANSPORT_MISMATCH" },
		});
	});

	it("rejects an invalid mobile body token (401 REFRESH_TOKEN_INVALID)", async () => {
		await expect(guard.canActivate(createHttpContext(mobileRequest({}, {}, { refreshToken: "not-a-jwt" })))).rejects.toMatchObject({
			response: { error: "REFRESH_TOKEN_INVALID" },
		});
	});
});

describe("OptionalRefreshTokenGuard (logout)", () => {
	const guard = new OptionalRefreshTokenGuard(tokens, requestContext);

	it("proceeds anonymously when a mobile request has no or an invalid body token (idempotent logout)", async () => {
		const missing = mobileRequest();
		const invalid = mobileRequest({}, {}, { refreshToken: "not-a-jwt" });

		await expect(guard.canActivate(createHttpContext(missing))).resolves.toBe(true);
		await expect(guard.canActivate(createHttpContext(invalid))).resolves.toBe(true);
		expect(missing.user).toBeUndefined();
		expect(invalid.user).toBeUndefined();
	});

	it("attaches the payload of a valid mobile body token", async () => {
		const request = mobileRequest({}, {}, { refreshToken: await signRefreshToken("mobile-5") });

		await expect(guard.canActivate(createHttpContext(request))).resolves.toBe(true);
		expect(request.user).toMatchObject({ sub: "mobile-5" });
	});

	it("still rejects a body token from a browser client type (a client error, not an absent session)", async () => {
		await expect(guard.canActivate(createHttpContext(requestWith({ "x-client-type": "web" }, {}, { refreshToken: "from-body" })))).rejects.toMatchObject({
			response: { error: "REFRESH_TOKEN_TRANSPORT_MISMATCH" },
		});
	});

	it("still rejects a malformed body with 400", async () => {
		await expect(guard.canActivate(createHttpContext(mobileRequest({}, {}, { refreshToken: 7 })))).rejects.toBeInstanceOf(ValidationError);
	});
});
