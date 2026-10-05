import { HttpStatus, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { accessToken, createHttpContext, testRequest, type TestHttpRequest } from "../../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { RequestContextService, type RequestPrincipal } from "../../../../common/context/request-context";
import { DependencyUnavailableError } from "../../../../common/errors/app-error";
import { PrismaService } from "../../../../prisma/prisma.service";
import { ImpersonationSessionRepository } from "../../repositories/impersonation-session.repository";
import { AccessTokenStateService } from "../../services/access-token-state.service";
import { ImpersonationSessionStateService } from "../../services/impersonation-session-state.service";
import { TokenService } from "../../services/token.service";
import { AuthGuard, readBearerToken } from "../auth.guard";
import { readRefreshTokenCookie, RefreshTokenGuard } from "../refresh-token.guard";

/** Server-side revocation state the guard reads (account state + impersonation sessions). */
const revocationState = vi.hoisted(() => ({
	assertTokenValid: vi.fn<(userId: string, tokenVersion: number) => Promise<void>>(),
	isLive: vi.fn<(claims: { readonly sessionId: string; readonly impersonatorId: string; readonly targetUserId: string }, now: number) => Promise<boolean>>(),
}));

vi.mock("../../services/access-token-state.service", () => ({
	AccessTokenStateService: class {
		public readonly assertTokenValid = revocationState.assertTokenValid;
	},
}));

vi.mock("../../repositories/impersonation-session.repository", () => ({
	ImpersonationSessionRepository: class {
		public readonly isLive = revocationState.isLive;
	},
}));

const config = createTestTypedConfig();
/** The refresh payload schema requires `exp`, so test tokens carry a short lifetime. */
const REFRESH_TOKEN_TTL_SECONDS = 60;
const jwt = new JwtService();
const tokens = new TokenService(jwt, config);
const requestContext = new RequestContextService();

interface CookieRequest extends TestHttpRequest {
	readonly cookies: Readonly<Record<string, string>>;
}

function requestWith(headers: Record<string, string>, cookies: Record<string, string> = {}): CookieRequest {
	return { ...testRequest({ headers }), cookies };
}

/** Runs `activate` inside a fresh request context and returns the principal it left behind. */
async function principalAfter(activate: () => Promise<boolean>): Promise<RequestPrincipal | undefined> {
	return requestContext.run({ correlationId: "corr-auth", ip: undefined, userAgent: undefined }, async () => {
		await activate();
		return requestContext.current()?.principal;
	});
}

function createAuthGuard(): AuthGuard {
	const prisma = new PrismaService(config);
	return new AuthGuard(
		tokens,
		new AccessTokenStateService(prisma, config),
		new ImpersonationSessionStateService(new ImpersonationSessionRepository(prisma)),
		new Reflector(),
		requestContext,
	);
}

beforeEach(() => {
	revocationState.assertTokenValid.mockReset();
	revocationState.assertTokenValid.mockResolvedValue(undefined);
	revocationState.isLive.mockReset();
	revocationState.isLive.mockResolvedValue(true);
});

describe("AuthGuard → request context", () => {
	const guard = createAuthGuard();

	it("binds the authenticated user as the principal", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "user-42", id: "user-42" }), { secret: config.auth.jwtAccessSecret });
		const context = createHttpContext(requestWith({ authorization: `Bearer ${token}` }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({ userId: "user-42", impersonatorId: undefined });
	});

	it("records the real super-admin behind an impersonation session", async () => {
		const token: string = await jwt.signAsync(
			accessToken({ sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1", impersonationSessionId: "session-1" }),
			{
				secret: config.auth.jwtAccessSecret,
			},
		);
		const context = createHttpContext(requestWith({ authorization: `Bearer ${token}` }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({ userId: "target-1", impersonatorId: "admin-1" });
	});

	it("falls back to the session cookie when the bearer header is blank", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "user-7", id: "user-7" }), { secret: config.auth.jwtAccessSecret });
		const context = createHttpContext(requestWith({ authorization: "Bearer " }, { accessToken: token }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({ userId: "user-7", impersonatorId: undefined });
	});

	it("reads the admin cookie when X-Client-Type is admin (what Swagger UI sends by default)", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "admin-3", id: "admin-3" }), { secret: config.auth.jwtAccessSecret });
		const context = createHttpContext(requestWith({ "x-client-type": "admin" }, { adminAccessToken: token }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({ userId: "admin-3", impersonatorId: undefined });
	});

	it("binds nothing when authentication fails", async () => {
		const context = createHttpContext(requestWith({ authorization: "Bearer not-a-jwt" }));

		const principal = await requestContext.run({ correlationId: "corr-auth-fail", ip: undefined, userAgent: undefined }, async () => {
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

	it("answers 503 — not 401 — when the revocation state cannot be read (database / cache outage)", async () => {
		const outage = new Error("connect ECONNREFUSED 127.0.0.1:5432");
		revocationState.assertTokenValid.mockRejectedValue(outage);

		const failure = guard.canActivate(await bearerContext({}));

		await expect(failure).rejects.toBeInstanceOf(DependencyUnavailableError);
		await expect(failure).rejects.toMatchObject({ httpStatus: HttpStatus.SERVICE_UNAVAILABLE, code: "SERVICE_UNAVAILABLE", cause: outage });
	});

	it("answers 503 when the impersonation-session lookup fails", async () => {
		revocationState.isLive.mockRejectedValue(new Error("connection terminated"));

		await expect(
			guard.canActivate(await bearerContext({ sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1", impersonationSessionId: "session-1" })),
		).rejects.toBeInstanceOf(DependencyUnavailableError);
	});

	it("rejects an impersonation token whose server-side session ended (stopped) or is unknown", async () => {
		revocationState.isLive.mockResolvedValue(false);

		await expect(
			guard.canActivate(await bearerContext({ sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1", impersonationSessionId: "session-1" })),
		).rejects.toMatchObject({ response: { error: "IMPERSONATION_SESSION_INVALID" } });
		expect(revocationState.isLive).toHaveBeenCalledWith({ sessionId: "session-1", impersonatorId: "admin-1", targetUserId: "target-1" }, expect.any(Number));
	});

	it("rejects an impersonation token that carries no session id (issued before sessions were tracked)", async () => {
		await expect(guard.canActivate(await bearerContext({ sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1" }))).rejects.toMatchObject({
			response: { error: "IMPERSONATION_SESSION_INVALID" },
		});
		expect(revocationState.isLive).not.toHaveBeenCalled();
	});

	it("does not consult impersonation sessions for a regular token", async () => {
		await expect(guard.canActivate(await bearerContext({}))).resolves.toBe(true);
		expect(revocationState.isLive).not.toHaveBeenCalled();
	});
});

describe("RefreshTokenGuard → request context", () => {
	const guard = new RefreshTokenGuard(tokens, requestContext);

	it("binds the refresh-token subject as the principal", async () => {
		const token: string = await jwt.signAsync(
			{ sub: "user-9", email: "u@example.com", jti: "jti-1", tokenType: "refresh" },
			{ secret: config.auth.jwtRefreshSecret, expiresIn: REFRESH_TOKEN_TTL_SECONDS },
		);
		const context = createHttpContext(requestWith({}, { refreshToken: token }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({ userId: "user-9", impersonatorId: undefined });
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

describe("readRefreshTokenCookie", () => {
	it("reads the refresh cookie of the app selected by X-Client-Type", () => {
		const cookies = { refreshToken: "web-rt", adminRefreshToken: "admin-rt", merchantRefreshToken: "merchant-rt" };

		expect(readRefreshTokenCookie(requestWith({}, cookies))).toBe("web-rt");
		expect(readRefreshTokenCookie(requestWith({ "x-client-type": "admin" }, cookies))).toBe("admin-rt");
		expect(readRefreshTokenCookie(requestWith({ "x-client-type": "merchant" }, cookies))).toBe("merchant-rt");
	});

	it("reports an absent or empty cookie as no token (never an empty string)", () => {
		expect(readRefreshTokenCookie(requestWith({}))).toBeUndefined();
		expect(readRefreshTokenCookie(requestWith({}, { refreshToken: "" }))).toBeUndefined();
		expect(readRefreshTokenCookie(requestWith({ "x-client-type": "admin" }, { refreshToken: "web-rt" }))).toBeUndefined();
	});
});
