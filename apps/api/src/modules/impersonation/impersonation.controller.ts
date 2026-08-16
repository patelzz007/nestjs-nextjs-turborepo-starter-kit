import { Controller, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { ImpersonateResponse, StopImpersonationResponse } from "@workspace/shared";
import { ImpersonateResponseSchema, StopImpersonationResponseSchema, apiPath } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { GetUser } from "../auth/decorators/get-user.decorator";
import { SuperAdminOnly } from "../auth/decorators/super-admin.decorator";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { createWrappedDto } from "../../common/dto/response-wrapper";
import { extractClientInfo } from "../../common/utils/client-info";

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
	@Post("/impersonate/:userId")
	@ApiOperation({ summary: "SuperAdmin: impersonate another user" })
	@ApiOkResponse({ type: WrappedImpersonateResponse, description: "Impersonation started" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async impersonate(@GetUser("sub") superAdminId: string, @Param("userId") targetUserId: string, @Req() req: FastifyRequest): Promise<ImpersonateResponse> {
		const { ipAddress } = extractClientInfo(req);
		const userAgent: string | null = req.headers["user-agent"] ?? null;
		return this.impersonationService.impersonateUser(superAdminId, targetUserId, ipAddress, userAgent);
	}

	/**
	 * POST /auth/stop-impersonation
	 * Stop impersonating — returns a confirmation message.
	 * The frontend should discard the impersonation token and restore
	 * the original SuperAdmin session.
	 */
	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@Post("/stop-impersonation")
	@ApiOperation({ summary: "SuperAdmin: stop impersonating" })
	@ApiOkResponse({ type: WrappedStopImpersonationResponse, description: "Impersonation ended" })
	public async stopImpersonation(
		@GetUser("originalUserId") impersonatorId: string | undefined,
		@GetUser("sub") targetUserId: string,
		@Req() req: FastifyRequest,
	): Promise<StopImpersonationResponse> {
		const { ipAddress } = extractClientInfo(req);
		const userAgent: string | null = req.headers["user-agent"] ?? null;
		// If originalUserId is not set (not an impersonation token), fall back to sub
		const superAdminId: string = impersonatorId ?? targetUserId;
		return this.impersonationService.stopImpersonation(superAdminId, targetUserId, ipAddress, userAgent);
	}
}
