import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";

import { accessToken, createHttpContext, testRequest, type TestHttpRequest } from "../../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { RequestContextService, type RequestPrincipal } from "../../../../common/context/request-context";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AccessTokenStateService } from "../../services/access-token-state.service";
import { TokenService } from "../../services/token.service";
import { AuthGuard, readBearerToken } from "../auth.guard";
import { RefreshTokenGuard } from "../refresh-token.guard";

vi.mock("../../services/access-token-state.service", () => ({
	AccessTokenStateService: class {
		public readonly assertTokenValid = vi.fn((): Promise<void> => Promise.resolve());
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

describe("AuthGuard → request context", () => {
	const guard = new AuthGuard(tokens, new AccessTokenStateService(new PrismaService(config), config), new Reflector(), requestContext);

	it("binds the authenticated user as the principal", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "user-42", id: "user-42" }), { secret: config.jwtAccessSecret });
		const context = createHttpContext(requestWith({ authorization: `Bearer ${token}` }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({ userId: "user-42", impersonatorId: undefined });
	});

	it("records the real super-admin behind an impersonation session", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1" }), {
			secret: config.jwtAccessSecret,
		});
		const context = createHttpContext(requestWith({ authorization: `Bearer ${token}` }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({ userId: "target-1", impersonatorId: "admin-1" });
	});

	it("falls back to the session cookie when the bearer header is blank", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "user-7", id: "user-7" }), { secret: config.jwtAccessSecret });
		const context = createHttpContext(requestWith({ authorization: "Bearer " }, { accessToken: token }));

		expect(await principalAfter(() => guard.canActivate(context))).toEqual({ userId: "user-7", impersonatorId: undefined });
	});

	it("reads the admin cookie when X-Client-Type is admin (what Swagger UI sends by default)", async () => {
		const token: string = await jwt.signAsync(accessToken({ sub: "admin-3", id: "admin-3" }), { secret: config.jwtAccessSecret });
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

describe("RefreshTokenGuard → request context", () => {
	const guard = new RefreshTokenGuard(tokens, requestContext);

	it("binds the refresh-token subject as the principal", async () => {
		const token: string = await jwt.signAsync(
			{ sub: "user-9", email: "u@example.com", jti: "jti-1", tokenType: "refresh" },
			{ secret: config.jwtRefreshSecret, expiresIn: REFRESH_TOKEN_TTL_SECONDS },
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
