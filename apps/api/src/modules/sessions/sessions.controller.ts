import { Controller, Get, HttpStatus, Post, Req, UnauthorizedException, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type {
	LogoutAllResponse,
	LogoutResponse,
	RefreshResponse,
	RefreshResponseMessage,
	RefreshTokenInput,
	RevokeSessionResponse,
	SessionListResponse,
} from "@workspace/shared";
import {
	apiContract,
	apiPath,
	LogoutAllResponseSchema,
	LogoutResponseSchema,
	RefreshClientResponseSchema,
	RevokeSessionResponseSchema,
	SessionListResponseSchema,
	UuidParamSchema,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { GetUser } from "../auth/decorators/get-user.decorator";
import { SkipAuthThrottle } from "../auth/decorators/skip-auth-throttle.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { ZodBody, ZodParam } from "../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../common/decorators/zod-response.decorators";
import { OptionalRefreshTokenGuard, readPresentedRefreshToken, RefreshTokenGuard } from "../auth/guards/refresh-token.guard";
import { ClearAuthCookiesInterceptor, ClearAuthCookiesOnSessionEndInterceptor } from "../auth/interceptors/clear-auth-cookies.interceptor";
import { TOKEN_DELIVERY_DESCRIPTION } from "../auth/constants/token-delivery.constants";
import { SetAuthCookiesInterceptor } from "../auth/interceptors/set-auth-cookies.interceptor";
import type { AccessTokenPayload, RefreshTokenPayload } from "../auth/services/token.service";
import { Authorize, self } from "../authorization/decorators/authorize.decorator";

import { readSessionDeviceContext } from "./device/session-device";
import { SessionRevokeDuringImpersonationError } from "./session.errors";
import { SessionsService } from "./sessions.service";

/**
 * Session lifecycle endpoints (token refresh, logout, active sessions).
 *
 * NOTE: URL paths are intentionally IDENTICAL to the pre-split layout
 * (`/auth/refresh`, `/auth/logout`, …) so the web/admin clients and any
 * bookmarked URLs keep working unchanged. Only the Swagger tag changed.
 */
@ApiTags("Sessions")
@Controller(apiPath("/auth"))
export class SessionsController {
	public constructor(private readonly sessionsService: SessionsService) {}

	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@Public()
	@UseGuards(RefreshTokenGuard)
	@Post("/refresh")
	@ApiOperation({
		summary: "Rotate the session tokens (refresh token: the httpOnly cookie for browser client types, the { refreshToken } body for client type mobile)",
	})
	@ZodResponse(RefreshClientResponseSchema, { description: "Tokens rotated" + TOKEN_DELIVERY_DESCRIPTION })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing, invalid, expired, reused or wrong-source refresh token" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async refreshToken(
		@GetUser() user: RefreshTokenPayload,
		@ZodBody(apiContract.auth.refresh.input, { engine: "zod" }) _body: RefreshTokenInput,
		@Req() req: FastifyRequest,
	): Promise<RefreshResponse & RefreshResponseMessage> {
		// The raw refresh token JWT from the source the client type may use (the
		// app's cookie, or the mobile body). RefreshTokenGuard already required
		// it; an absent token here is still rejected explicitly rather than
		// compared as an empty string.
		const rawRefreshToken: string | undefined = readPresentedRefreshToken(req);
		if (rawRefreshToken === undefined) {
			throw new UnauthorizedException({
				message: "Refresh token not found",
				error: "REFRESH_TOKEN_MISSING",
			});
		}

		// The refresh token's jti (JWT ID) is used for direct DB lookup
		const tokens: RefreshResponse = await this.sessionsService.refreshToken(user.sub, rawRefreshToken, user.jti, readSessionDeviceContext(req));

		return {
			...tokens,
			message: "Tokens refreshed successfully",
		};
	}

	/**
	 * Idempotent: always clears the auth cookies. The device session is revoked
	 * when a valid refresh token identifies it; without one (expired, or never
	 * signed in) there is nothing to revoke and the call still succeeds.
	 */
	@Public()
	@UseGuards(OptionalRefreshTokenGuard)
	@Post("/logout")
	@ApiOperation({
		summary: "Logout from the current device (idempotent — always clears a browser client's auth cookies; client type mobile presents its refresh token as { refreshToken })",
	})
	@ZodResponse(LogoutResponseSchema, { status: HttpStatus.CREATED, description: "Logged out from current device" })
	@UseInterceptors(ClearAuthCookiesInterceptor)
	public async logout(
		@GetUser() user: RefreshTokenPayload | undefined,
		@ZodBody(apiContract.auth.logout.input, { engine: "zod" }) _body: RefreshTokenInput,
	): Promise<LogoutResponse> {
		if (user !== undefined) {
			await this.sessionsService.logoutDevice(user.sub, user.jti);
		}

		return { message: "Logged out successfully" };
	}

	@Public()
	@Post("/logout-all")
	@UseGuards(RefreshTokenGuard)
	@ApiOperation({
		summary: "Logout from all devices, on every client type (refresh token: the httpOnly cookie for browser client types, { refreshToken } for client type mobile)",
	})
	@ZodResponse(LogoutAllResponseSchema, { status: HttpStatus.CREATED, description: "Logged out from all devices" })
	@UseInterceptors(ClearAuthCookiesInterceptor)
	public async logoutAll(
		@GetUser() user: RefreshTokenPayload,
		@ZodBody(apiContract.auth.logoutAll.input, { engine: "zod" }) _body: RefreshTokenInput,
	): Promise<LogoutAllResponse> {
		await this.sessionsService.logoutAllDevices(user.sub);

		return { message: "Logged out from all devices" };
	}

	/**
	 * The caller's device sessions on every client type (ADR 034). `isCurrent`
	 * comes from the access token's `sid`, so it is right on both transports.
	 *
	 * Permission mapping (rules/10): READ USER on self (an implicit self grant);
	 * ownership by the `userId` scope of the query; RLS `refresh_tokens` own rows.
	 */
	@SkipAuthThrottle()
	@ApiBearerAuth()
	@Get("/sessions")
	@Authorize({ action: "READ", resource: "USER", resourceId: self(), description: "A user lists their own device sessions" })
	@ApiOperation({ summary: "List the caller's signed-in devices (every client type): the current one first, then by last activity" })
	@ZodResponse(SessionListResponseSchema, { description: "The caller's active device sessions" })
	public async getSessions(@GetUser() user: AccessTokenPayload): Promise<SessionListResponse> {
		return this.sessionsService.getSessions(user.sub, user.sid);
	}

	/**
	 * Sign out one of the caller's devices (ADR 034): its refresh token stops
	 * working at once and its access tokens on their next request, on every
	 * API instance. Revoking the request's own session signs it out (a browser's
	 * auth cookies are cleared). Idempotent; audited by the global HTTP audit
	 * log and the `session.action` (`revoke-device`) outbox event.
	 *
	 * Permission mapping (rules/10): UPDATE USER on self (an implicit self
	 * grant); ownership by the query (`userId` = caller) — any other id is 404,
	 * never 403; refused (403) during impersonation; RLS `refresh_tokens` own rows.
	 */
	@ApiBearerAuth()
	@Post("/sessions/:sessionId/revoke")
	@Authorize({ action: "UPDATE", resource: "USER", resourceId: self(), description: "A user signs out one of their own devices (never during impersonation)" })
	@ApiOperation({
		summary: "Sign out one of the caller's devices",
		description:
			"Revokes one of the caller's device sessions: its refresh token stops working at once and its access tokens on their next request. Revoking the current session signs this device out (a browser's auth cookies are cleared; the mobile app drops its tokens). Idempotent. 404 SESSION_NOT_FOUND for any id that is not one of the caller's sessions; 403 SESSION_REVOKE_DURING_IMPERSONATION during impersonation.",
	})
	@ZodResponse(RevokeSessionResponseSchema, { status: HttpStatus.CREATED, description: "The session is revoked (or already was)" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SESSION_REVOKE_DURING_IMPERSONATION — an impersonation session cannot sign out the user's devices" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "SESSION_NOT_FOUND — no session with that id belongs to the caller" })
	@UseInterceptors(ClearAuthCookiesOnSessionEndInterceptor)
	public async revokeSession(@GetUser() user: AccessTokenPayload, @ZodParam("sessionId", UuidParamSchema) sessionId: string): Promise<RevokeSessionResponse> {
		if (user.isImpersonating === true) {
			throw new SessionRevokeDuringImpersonationError();
		}
		const { revokedCurrentSession } = await this.sessionsService.revokeSession(user.sub, sessionId, user.sid);
		return { message: revokedCurrentSession ? "Signed out of this device" : "Device signed out", revokedCurrentSession };
	}
}
