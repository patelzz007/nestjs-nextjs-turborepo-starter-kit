import { BadRequestException, Controller, HttpStatus, Post, Req, UnauthorizedException, UseInterceptors } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AccessTokenPayload, ImpersonateServiceResponse, RefreshTokenPayload, StopImpersonationServiceResponse } from "@workspace/shared";
import { AccessTokenPayloadSchema, ImpersonateResponseSchema, StopImpersonationResponseSchema, UuidParamSchema, apiPath } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ApiErrorResponseDto } from "../../../../platform/presentation/http/dto/api-response.dto";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Authorize } from "../../../../platform/presentation/http/security/decorators/authorize.decorator";
import { EmailVerified } from "../../../../platform/presentation/http/security/decorators/email-verified.decorator";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RequiresFullSession } from "../../../../platform/presentation/http/security/decorators/requires-full-session.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { SetAuthCookiesInterceptor } from "../../../../platform/presentation/http/security/interceptors/set-auth-cookies.interceptor";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodParam } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { readPresentedRefreshToken } from "../../../../platform/presentation/http/security/guards/refresh-token.guard";
import { clientInfoOf } from "../../../../platform/presentation/http/security/request-client-info";
import { StartImpersonationCommand } from "../../application/commands/start-impersonation/start-impersonation.command";
import { StopImpersonationCommand } from "../../application/commands/stop-impersonation/stop-impersonation.command";
import { IMPERSONATION_START_OPERATION } from "../../application/ports/identity.tokens";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

/** The access token the route was called with; a refresh token (or none) is refused. */
function requireAccessToken(user: AccessTokenPayload | RefreshTokenPayload | undefined): AccessTokenPayload {
	const parsed = AccessTokenPayloadSchema.safeParse(user);
	if (!parsed.success) {
		throw new BadRequestException({ message: "Access token required", error: "ACCESS_TOKEN_REQUIRED" });
	}
	return parsed.data;
}

/** SuperAdmin impersonation: start a time-boxed session as another user, and stop it to restore the admin. */
@ApiTags("Impersonation")
@Controller(apiPath("/auth"))
export class ImpersonationController {
	public constructor(private readonly commandBus: CommandBus) {}

	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequiresFullSession()
	@EmailVerified()
	@RequirePermission("CREATE", "USER")
	@PlatformOperation(IMPERSONATION_START_OPERATION)
	@Authorize({
		action: "CREATE",
		resource: "USER",
		resourceId: "userId",
		description: "SuperAdmin can impersonate any user",
	})
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("/impersonate/:userId")
	@UseInterceptors(SetAuthCookiesInterceptor)
	@ApiOperation({ summary: "SuperAdmin: impersonate another user" })
	@ZodResponse(ImpersonateResponseSchema, { status: HttpStatus.CREATED, description: "Impersonation started — the impersonation token is set as an httpOnly cookie" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async impersonate(
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@ZodParam("userId", UuidParamSchema) targetUserId: string,
		@Req() req: FastifyRequest,
		@CurrentActor() actor: ActorContext,
	): Promise<ImpersonateServiceResponse> {
		const admin: AccessTokenPayload = requireAccessToken(user);
		const { ipAddress, userAgent } = clientInfoOf(req);
		return this.commandBus.execute(new StartImpersonationCommand(actor, { targetUserId, mfaAssuredAt: admin.mfaAssuredAt ?? null, ipAddress, userAgent }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@ApiBearerAuth()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@Post("/stop-impersonation")
	@UseInterceptors(SetAuthCookiesInterceptor)
	@ApiOperation({
		summary: "Stop impersonating and restore the original admin session",
		description:
			"Needs the administrator's own refresh token (the app's refresh cookie; client type mobile: `{ refreshToken }` in the body). The restored access token is bound to that device session (`sid`).",
	})
	@ZodResponse(StopImpersonationResponseSchema, { status: HttpStatus.CREATED, description: "Impersonation ended — the admin token is restored as an httpOnly cookie" })
	public async stopImpersonation(
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@Req() req: FastifyRequest,
		@CurrentActor() actor: ActorContext,
	): Promise<StopImpersonationServiceResponse> {
		const payload: AccessTokenPayload = requireAccessToken(user);
		if (payload.isImpersonating !== true || payload.originalUserId === undefined || payload.impersonationSessionId === undefined) {
			throw new BadRequestException({ message: "Not currently impersonating", error: "NOT_IMPERSONATING" });
		}
		const presentedRefreshToken: string | undefined = readPresentedRefreshToken(req);
		if (presentedRefreshToken === undefined) {
			throw new UnauthorizedException({ message: "The administrator's refresh token is required to restore the session", error: "REFRESH_TOKEN_MISSING" });
		}
		const { ipAddress, userAgent } = clientInfoOf(req);
		return this.commandBus.execute(
			new StopImpersonationCommand(actor, {
				impersonatorId: payload.originalUserId,
				targetUserId: payload.sub,
				impersonationSessionId: payload.impersonationSessionId,
				presentedRefreshToken,
				ipAddress,
				userAgent,
			}),
		);
	}
}
