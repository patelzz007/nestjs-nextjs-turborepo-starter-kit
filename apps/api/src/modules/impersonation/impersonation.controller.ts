import { BadRequestException, Controller, ForbiddenException, HttpStatus, Post, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { ImpersonateServiceResponse, StopImpersonationServiceResponse } from "@workspace/shared";
import { ImpersonateResponseSchema, StopImpersonationResponseSchema, UuidParamSchema, apiPath } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { ZodParam } from "../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../common/decorators/zod-response.decorators";
import { TypedConfigService } from "../../config/typed-config.service";
import { EmailVerified } from "../auth/decorators/email-verified.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { RequiresFullSession } from "../auth/decorators/requires-full-session.decorator";
import { SuperAdminOnly } from "../auth/decorators/super-admin.decorator";
import type { AccessTokenPayload, RefreshTokenPayload } from "../auth/services/token.service";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { extractClientInfo } from "../../common/utils/client-info";
import { RlsBypass } from "../auth/decorators/rls-bypass.decorator";
import { SetAuthCookiesInterceptor } from "../auth/interceptors/set-auth-cookies.interceptor";
import { Authorize } from "../authorization/decorators/authorize.decorator";

import { ImpersonationService } from "./impersonation.service";

/**
 * SuperAdmin impersonation endpoints.
 *
 * URL paths are intentionally IDENTICAL to the pre-split layout
 * (`/auth/impersonate/:userId`, `/auth/stop-impersonation`) — only the
 * Swagger tag changed.
 */
@ApiTags("Impersonation")
@Controller(apiPath("/auth"))
export class ImpersonationController {
	public constructor(
		private readonly impersonationService: ImpersonationService,
		private readonly config: TypedConfigService,
	) {}

	/**
	 * POST /auth/impersonate/:userId
	 * SuperAdmin starts impersonating another user.
	 * Returns a short-lived access token that the frontend can use to act as
	 * the target user. The original SuperAdmin session is NOT invalidated.
	 */
	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequiresFullSession()
	@EmailVerified()
	@RequirePermission("CREATE", "USER")
	@Authorize({
		action: "CREATE",
		resource: "USER",
		resourceId: "userId",
		description: "SuperAdmin can impersonate any user",
	})
	@Post("/impersonate/:userId")
	@UseInterceptors(SetAuthCookiesInterceptor)
	@ApiOperation({ summary: "SuperAdmin: impersonate another user" })
	@ZodResponse(ImpersonateResponseSchema, { status: HttpStatus.CREATED, description: "Impersonation started — the impersonation token is set as an httpOnly cookie" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async impersonate(
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@ZodParam("userId", UuidParamSchema) targetUserId: string,
		@Req() req: FastifyRequest,
	): Promise<ImpersonateServiceResponse> {
		const admin = requireAccessToken(user);
		assertFreshMfaAssurance(admin, this.config.mfaStepUpTtlMs);
		if (admin.isImpersonating === true) {
			throw new BadRequestException({
				message: "Already impersonating; stop the current session first",
				error: "ALREADY_IMPERSONATING",
			});
		}

		const { ipAddress } = extractClientInfo(req);
		const userAgent: string | null = req.headers["user-agent"] ?? null;
		return this.impersonationService.impersonateUser(admin.sub, targetUserId, ipAddress, userAgent);
	}

	/**
	 * POST /auth/stop-impersonation
	 * Stop impersonating — returns a confirmation message.
	 * The frontend should discard the impersonation token and restore
	 * the original SuperAdmin session.
	 */
	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@RlsBypass()
	@Post("/stop-impersonation")
	@UseInterceptors(SetAuthCookiesInterceptor)
	@ApiOperation({ summary: "Stop impersonating and restore the original admin session" })
	@ZodResponse(StopImpersonationResponseSchema, { status: HttpStatus.CREATED, description: "Impersonation ended — the admin token is restored as an httpOnly cookie" })
	public async stopImpersonation(
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@Req() req: FastifyRequest,
	): Promise<StopImpersonationServiceResponse> {
		const payload = requireAccessToken(user);
		if (payload.isImpersonating !== true || payload.originalUserId === undefined) {
			throw new BadRequestException({
				message: "Not currently impersonating",
				error: "NOT_IMPERSONATING",
			});
		}

		const { ipAddress } = extractClientInfo(req);
		const userAgent: string | null = req.headers["user-agent"] ?? null;
		return this.impersonationService.stopImpersonation(payload.originalUserId, payload.sub, ipAddress, userAgent);
	}
}

function requireAccessToken(user: AccessTokenPayload | RefreshTokenPayload | undefined): AccessTokenPayload {
	if (user === undefined || !("isSuperAdmin" in user)) {
		throw new BadRequestException({
			message: "Access token required",
			error: "ACCESS_TOKEN_REQUIRED",
		});
	}
	return user;
}

function assertFreshMfaAssurance(admin: AccessTokenPayload, stepUpTtlMs: number): void {
	const assuredAt: number | undefined = admin.mfaAssuredAt;
	if (assuredAt === undefined || Date.now() - assuredAt > stepUpTtlMs) {
		throw new ForbiddenException({
			message: "Fresh MFA verification required before impersonation.",
			error: "MFA_STEP_UP_REQUIRED",
		});
	}
}
