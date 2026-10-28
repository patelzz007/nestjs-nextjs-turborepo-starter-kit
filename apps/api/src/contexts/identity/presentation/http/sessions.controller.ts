import { Controller, Get, HttpStatus, Post, Req, UnauthorizedException, UseGuards, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type {
	AccessTokenPayload,
	LogoutAllResponse,
	LogoutResponse,
	RefreshResponse,
	RefreshResponseMessage,
	RefreshTokenInput,
	RefreshTokenPayload,
	PaginatedServiceResult,
	RevokeSessionResponse,
	Session,
	SessionListQuery,
} from "@workspace/shared";
import {
	apiContract,
	apiPath,
	LogoutAllResponseSchema,
	LogoutResponseSchema,
	RefreshClientResponseSchema,
	RevokeSessionResponseSchema,
	SessionListQuerySchema,
	SessionSchema,
	UuidParamSchema,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ApiErrorResponseDto } from "../../../../platform/presentation/http/dto/api-response.dto";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { self } from "../../../../platform/presentation/http/security/decorators/permission-target";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { OptionalRefreshTokenGuard, readPresentedRefreshToken, RefreshTokenGuard } from "../../../../platform/presentation/http/security/guards/refresh-token.guard";
import {
	ClearAuthCookiesInterceptor,
	ClearAuthCookiesOnSessionEndInterceptor,
} from "../../../../platform/presentation/http/security/interceptors/clear-auth-cookies.interceptor";
import { SetAuthCookiesInterceptor } from "../../../../platform/presentation/http/security/interceptors/set-auth-cookies.interceptor";
import { readSessionDeviceContext } from "../../../../platform/presentation/http/security/session-device-context";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParam } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { LogOutAllDevicesCommand } from "../../application/commands/log-out-all-devices/log-out-all-devices.command";
import { LogOutDeviceCommand } from "../../application/commands/log-out-device/log-out-device.command";
import { RefreshSessionCommand } from "../../application/commands/refresh-session/refresh-session.command";
import { RevokeMySessionCommand } from "../../application/commands/revoke-my-session/revoke-my-session.command";
import { ListMySessionsQuery } from "../../application/queries/list-my-sessions/list-my-sessions.query";
import { TOKEN_DELIVERY_DESCRIPTION } from "./token-delivery.constants";

const PUBLIC_ACTOR = { allowAnonymous: true };

/** Device sessions: refresh-token rotation, sign-out (one device, every device), and the caller's own session list. */
@ApiTags("Sessions")
@Controller(apiPath("/auth"))
export class SessionsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.sessionRefresh)
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
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<RefreshResponse & RefreshResponseMessage> {
		// RefreshTokenGuard already required the token from the source the client type may use (the
		// app's cookie, or the mobile body); an absent one here is still rejected explicitly rather
		// than compared as an empty string.
		const rawRefreshToken: string | undefined = readPresentedRefreshToken(req);
		if (rawRefreshToken === undefined) {
			throw new UnauthorizedException({ message: "Refresh token not found", error: "REFRESH_TOKEN_MISSING" });
		}
		const tokens: RefreshResponse = await this.commandBus.execute(
			new RefreshSessionCommand(actor, { userId: user.sub, sessionId: user.jti, rawRefreshToken, device: readSessionDeviceContext(req) }),
		);
		return { ...tokens, message: "Tokens refreshed successfully" };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
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
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<LogoutResponse> {
		if (user !== undefined) {
			await this.commandBus.execute(new LogOutDeviceCommand(actor, { userId: user.sub, sessionId: user.jti }));
		}
		return { message: "Logged out successfully" };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
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
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<LogoutAllResponse> {
		await this.commandBus.execute(new LogOutAllDevicesCommand(actor, { userId: user.sub }));
		return { message: "Logged out from all devices" };
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@Get("/sessions")
	@RequirePermission("READ", "USER", { resourceId: self(), description: "A user lists their own device sessions" })
	@ApiOperation({ summary: "List the caller's signed-in devices (every client type), most recently active first; `isCurrent` marks this one" })
	@ZodPaginatedResponse(SessionSchema, { description: "One page of the caller's active device sessions; pagination is in `meta`" })
	public async getSessions(
		@GetUser() user: AccessTokenPayload,
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(SessionListQuerySchema) query: SessionListQuery,
	): Promise<PaginatedServiceResult<Session>> {
		return this.queryBus.execute(new ListMySessionsQuery(actor, { userId: user.sub, currentSessionId: user.sid ?? null, query }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiBearerAuth()
	@Post("/sessions/:sessionId/revoke")
	@RequirePermission("UPDATE", "USER", { resourceId: self(), description: "A user signs out one of their own devices (never during impersonation)" })
	@ApiOperation({
		summary: "Sign out one of the caller's devices",
		description:
			"Revokes one of the caller's device sessions: its refresh token stops working at once and its access tokens on their next request. Revoking the current session signs this device out (a browser's auth cookies are cleared; the mobile app drops its tokens). Idempotent. 404 SESSION_NOT_FOUND for any id that is not one of the caller's sessions; 403 SESSION_REVOKE_DURING_IMPERSONATION during impersonation.",
	})
	@ZodResponse(RevokeSessionResponseSchema, { status: HttpStatus.CREATED, description: "The session is revoked (or already was)" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SESSION_REVOKE_DURING_IMPERSONATION — an impersonation session cannot sign out the user's devices" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "SESSION_NOT_FOUND — no session with that id belongs to the caller" })
	@UseInterceptors(ClearAuthCookiesOnSessionEndInterceptor)
	public async revokeSession(@ZodParam("sessionId", UuidParamSchema) sessionId: string, @CurrentActor() actor: ActorContext): Promise<RevokeSessionResponse> {
		return this.commandBus.execute(new RevokeMySessionCommand(actor, { sessionId }));
	}
}
