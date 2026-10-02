import { Controller, Get, HttpStatus, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { LogoutAllResponse, LogoutResponse, RefreshResponse, RefreshResponseMessage, SessionListResponse } from "@workspace/shared";
import { LogoutAllResponseSchema, LogoutResponseSchema, RefreshResponseMessageSchema, SessionListResponseSchema, apiPath } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { GetUser } from "../auth/decorators/get-user.decorator";
import { SkipAuthThrottle } from "../auth/decorators/skip-auth-throttle.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { ZodResponse } from "../../common/decorators/zod-response.decorators";
import { OptionalRefreshTokenGuard, RefreshTokenGuard } from "../auth/guards/refresh-token.guard";
import { ClearAuthCookiesInterceptor } from "../auth/interceptors/clear-auth-cookies.interceptor";
import { SetAuthCookiesInterceptor } from "../auth/interceptors/set-auth-cookies.interceptor";
import { extractClientInfo } from "../../common/utils/client-info";
import { readFirstHeader } from "../../common/utils/http-headers";
import type { RefreshTokenPayload } from "../auth/services/token.service";

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
	@ApiOperation({ summary: "Refresh access token using refresh token cookie" })
	@ZodResponse(RefreshResponseMessageSchema, { description: "Tokens refreshed — set as httpOnly cookies, never in the body" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid or expired refresh token" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async refreshToken(@GetUser() user: RefreshTokenPayload, @Req() req: FastifyRequest): Promise<RefreshResponseMessage> {
		const { deviceInfo, ipAddress } = extractClientInfo(req);

		// Extract the raw refresh token JWT from the app-specific cookie.
		const clientType: string | undefined = readFirstHeader(req.headers["x-client-type"]);
		const isAdmin: boolean = clientType === "admin";
		const isMerchant: boolean = clientType === "merchant";
		const rawRefreshToken: string = isAdmin ? (req.cookies.adminRefreshToken ?? "") : isMerchant ? (req.cookies.merchantRefreshToken ?? "") : (req.cookies.refreshToken ?? "");

		// The refresh token's jti (JWT ID) is used for direct DB lookup
		const tokens: RefreshResponse = await this.sessionsService.refreshToken(user.sub, rawRefreshToken, user.jti, deviceInfo, ipAddress);

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
	@ApiOperation({ summary: "Logout from the current device (idempotent — always clears the auth cookies)" })
	@ZodResponse(LogoutResponseSchema, { status: HttpStatus.CREATED, description: "Logged out from current device" })
	@UseInterceptors(ClearAuthCookiesInterceptor)
	public async logout(@GetUser() user: RefreshTokenPayload | undefined): Promise<LogoutResponse> {
		if (user !== undefined) {
			await this.sessionsService.logoutDevice(user.sub, user.jti);
		}

		return { message: "Logged out successfully" };
	}

	@Public()
	@Post("/logout-all")
	@UseGuards(RefreshTokenGuard)
	@ApiOperation({ summary: "Logout from all devices" })
	@ZodResponse(LogoutAllResponseSchema, { status: HttpStatus.CREATED, description: "Logged out from all devices" })
	@UseInterceptors(ClearAuthCookiesInterceptor)
	public async logoutAll(@GetUser() user: RefreshTokenPayload): Promise<LogoutAllResponse> {
		await this.sessionsService.logoutAllDevices(user.sub);

		return { message: "Logged out from all devices" };
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@Get("/sessions")
	@ApiOperation({ summary: "Get all active sessions for the current user" })
	@ZodResponse(SessionListResponseSchema, { description: "List of active sessions" })
	public async getSessions(@GetUser("sub") userId: string): Promise<SessionListResponse> {
		return this.sessionsService.getSessions(userId);
	}
}
