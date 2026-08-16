import { Controller, Get, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { LogoutAllResponse, LogoutResponse, RefreshResponse, RefreshResponseMessage, Session } from "@workspace/shared";
import { LogoutAllResponseSchema, LogoutResponseSchema, RefreshResponseMessageSchema, SessionSchema } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { GetUser } from "../auth/decorators/get-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { createWrappedArrayDto, createWrappedDto } from "../../common/dto/response-wrapper";
import { RefreshTokenGuard } from "../auth/guards/refresh-token.guard";
import { ClearAuthCookiesInterceptor } from "../auth/interceptors/clear-auth-cookies.interceptor";
import { SetAuthCookiesInterceptor } from "../auth/interceptors/set-auth-cookies.interceptor";
import { extractClientInfo } from "../../common/utils/client-info";
import type { RefreshTokenPayload } from "../auth/services/token.service";

import { SessionsService } from "./sessions.service";

// ── Wrapped Response DTOs (envelope + data) ─────────────────────────────

const WrappedRefreshResponse = createWrappedDto(RefreshResponseMessageSchema, "WrappedRefreshResponse");
const WrappedLogoutResponse = createWrappedDto(LogoutResponseSchema, "WrappedLogoutResponse");
const WrappedLogoutAllResponse = createWrappedDto(LogoutAllResponseSchema, "WrappedLogoutAllResponse");
const WrappedSessionList = createWrappedArrayDto(SessionSchema, "WrappedSessionList");

/**
 * Session lifecycle endpoints (token refresh, logout, active sessions).
 *
 * NOTE: URL paths are intentionally IDENTICAL to the pre-split layout
 * (`/auth/refresh`, `/auth/logout`, …) so the web/admin clients and any
 * bookmarked URLs keep working unchanged. Only the Swagger tag changed.
 */
@ApiTags("Sessions")
@Controller("auth")
export class SessionsController {
	constructor(private readonly sessionsService: SessionsService) {}

	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@Public()
	@UseGuards(RefreshTokenGuard)
	@Post("/refresh")
	@ApiOperation({ summary: "Refresh access token using refresh token cookie" })
	@ApiOkResponse({ type: WrappedRefreshResponse, description: "Tokens refreshed" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid or expired refresh token" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async refreshToken(@GetUser() user: RefreshTokenPayload, @Req() req: FastifyRequest): Promise<RefreshResponseMessage> {
		const { deviceInfo, ipAddress } = extractClientInfo(req);

		// Extract the raw refresh token JWT from cookies for reuse detection.
		// RefreshTokenGuard already verified the cookie exists (it checks both
		// `refreshToken` and `adminRefreshToken`), so one of these is always a string.
		// The service will bcrypt-compare it against the stored hash before rotating.
		// RefreshTokenGuard already verified one of the two cookies exists, so the
		// `?? ""` fallback is unreachable in practice; it only keeps the type
		// honest (an empty token fails the bcrypt compare → 401, never a 500).
		const rawRefreshToken: string = req.cookies.refreshToken ?? req.cookies.adminRefreshToken ?? "";

		// The refresh token's jti (JWT ID) is used for direct DB lookup
		const tokens: RefreshResponse = await this.sessionsService.refreshToken(user.sub, rawRefreshToken, user.jti, deviceInfo, ipAddress);

		return {
			...tokens,
			message: "Tokens refreshed successfully",
		};
	}

	@Public()
	@UseGuards(RefreshTokenGuard)
	@Post("/logout")
	@ApiOperation({ summary: "Logout from the current device" })
	@ApiOkResponse({ type: WrappedLogoutResponse, description: "Logged out from current device" })
	@UseInterceptors(ClearAuthCookiesInterceptor)
	public async logout(@GetUser() user: RefreshTokenPayload): Promise<LogoutResponse> {
		await this.sessionsService.logoutDevice(user.sub, user.jti);

		return { message: "Logged out successfully" };
	}

	@Public()
	@Post("/logout-all")
	@UseGuards(RefreshTokenGuard)
	@ApiOperation({ summary: "Logout from all devices" })
	@ApiOkResponse({ type: WrappedLogoutAllResponse, description: "Logged out from all devices" })
	@UseInterceptors(ClearAuthCookiesInterceptor)
	public async logoutAll(@GetUser() user: RefreshTokenPayload): Promise<LogoutAllResponse> {
		await this.sessionsService.logoutAllDevices(user.sub);

		return { message: "Logged out from all devices" };
	}

	@SkipThrottle()
	@ApiBearerAuth()
	@Get("/sessions")
	@ApiOperation({ summary: "Get all active sessions for the current user" })
	@ApiOkResponse({ type: WrappedSessionList, description: "List of active sessions" })
	public async getSessions(@GetUser("sub") userId: string): Promise<Session[]> {
		return this.sessionsService.getSessions(userId);
	}
}
