import { Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type {
	AdminMfaRecoveryListQuery,
	AdminMfaRecoveryRequest,
	AdminReviewMfaRecoveryInput,
	InitiateMfaRecoveryInput,
	MfaRecoveryStatusResponse,
	PaginatedServiceResult,
} from "@workspace/shared";
import { apiContract, apiPath, AdminMfaRecoveryRequestSchema, MfaRecoveryStatusResponseSchema } from "@workspace/shared";

import { ZodBody, ZodListQuery } from "../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../common/decorators/zod-response.decorators";
import { GetUser } from "./decorators/get-user.decorator";
import { SuperAdminOnly } from "./decorators/super-admin.decorator";
import { Authorize, self } from "../authorization/decorators/authorize.decorator";
import { MfaRecoveryService } from "./services/mfa-recovery.service";

@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class MfaRecoveryController {
	public constructor(private readonly mfaRecoveryService: MfaRecoveryService) {}

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@ApiBearerAuth()
	@Post("/mfa/recovery")
	@Authorize({ action: "UPDATE", resource: "USER", resourceId: self(), description: "User can initiate MFA recovery for their own account" })
	@ApiOperation({ summary: "Initiate an admin-reviewed MFA recovery request" })
	@ZodResponse(MfaRecoveryStatusResponseSchema, { description: "Recovery request status" })
	public async initiateRecovery(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.mfaRecoveryInitiate.input) body: InitiateMfaRecoveryInput,
	): Promise<MfaRecoveryStatusResponse> {
		return this.mfaRecoveryService.initiateRecovery(userId, body);
	}

	@ApiBearerAuth()
	@Get("/mfa/recovery/status")
	@ApiOperation({ summary: "Get the current MFA recovery request status" })
	@ZodResponse(MfaRecoveryStatusResponseSchema, { description: "Recovery request status" })
	public async getRecoveryStatus(@GetUser("sub") userId: string): Promise<MfaRecoveryStatusResponse> {
		return this.mfaRecoveryService.getRecoveryStatus(userId);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Get("/admin/mfa/recovery/requests")
	@ApiOperation({ summary: "SuperAdmin: list MFA recovery requests" })
	@ZodPaginatedResponse(AdminMfaRecoveryRequestSchema, { description: "Paginated MFA recovery requests" })
	public async listRecoveryRequests(
		@ZodListQuery(apiContract.auth.adminMfaRecoveryRequests.input) query: AdminMfaRecoveryListQuery,
	): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
		return this.mfaRecoveryService.listAdminRecoveryRequests(query);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Post("/admin/mfa/recovery/review")
	@Authorize({
		action: "UPDATE",
		resource: "USER",
		description: "SuperAdmin can review MFA recovery requests",
	})
	@ApiOperation({ summary: "SuperAdmin: approve or deny an MFA recovery request" })
	@ZodResponse(MfaRecoveryStatusResponseSchema, { description: "Reviewed recovery request status" })
	public async reviewRecovery(
		@GetUser("sub") adminUserId: string,
		@ZodBody(apiContract.auth.adminMfaRecoveryReview.input) body: AdminReviewMfaRecoveryInput,
	): Promise<MfaRecoveryStatusResponse> {
		if (body.action === "approve") {
			return this.mfaRecoveryService.adminApprove(adminUserId, body);
		}

		return this.mfaRecoveryService.adminDeny(adminUserId, body);
	}
}
