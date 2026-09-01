import { BadRequestException, Controller, Param, Post, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { ImpersonateServiceResponse, StopImpersonationServiceResponse } from "@workspace/shared";
import { ImpersonateResponseSchema, StopImpersonationResponseSchema, UuidParamSchema, apiPath } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { EmailVerified } from "../auth/decorators/email-verified.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../auth/decorators/super-admin.decorator";
import type { AccessTokenPayload, RefreshTokenPayload } from "../auth/services/token.service";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { createWrappedDto } from "../../common/dto/response-wrapper";
import { extractClientInfo } from "../../common/utils/client-info";
import { RlsBypass } from "../auth/decorators/rls-bypass.decorator";
import { SetAuthCookiesInterceptor } from "../auth/interceptors/set-auth-cookies.interceptor";

import { ImpersonationService } from "./impersonation.service";

const WrappedImpersonateResponse = createWrappedDto(ImpersonateResponseSchema, "WrappedImpersonateResponse");
const WrappedStopImpersonationResponse = createWrappedDto(StopImpersonationResponseSchema, "WrappedStopImpersonationResponse");

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
	constructor(private readonly impersonationService: ImpersonationService) {}

	/**
	 * POST /auth/impersonate/:userId
	 * SuperAdmin starts impersonating another user.
	 * Returns a short-lived access token that the frontend can use to act as
	 * the target user. The original SuperAdmin session is NOT invalidated.
	 */
	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@SuperAdminOnly()
	@EmailVerified()
	@RequirePermission("CREATE", "USER")
	@Post("/impersonate/:userId")
	@UseInterceptors(SetAuthCookiesInterceptor)
	@ApiOperation({ summary: "SuperAdmin: impersonate another user" })
	@ApiOkResponse({ type: WrappedImpersonateResponse, description: "Impersonation started" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async impersonate(
		@GetUser() user: AccessTokenPayload | RefreshTokenPayload | undefined,
		@Param("userId", new ZodValidationPipe(UuidParamSchema)) targetUserId: string,
		@Req() req: FastifyRequest,
	): Promise<ImpersonateServiceResponse> {
		const admin = requireAccessToken(user);
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
	@ApiOkResponse({ type: WrappedStopImpersonationResponse, description: "Impersonation ended" })
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
