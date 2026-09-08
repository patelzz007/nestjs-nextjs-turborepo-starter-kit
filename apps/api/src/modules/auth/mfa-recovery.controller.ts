import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
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

import { createWrappedArrayDto, createWrappedDto } from "../../common/dto/response-wrapper";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { GetUser } from "./decorators/get-user.decorator";
import { SuperAdminOnly } from "./decorators/super-admin.decorator";
import { MfaRecoveryService } from "./services/mfa-recovery.service";

const WrappedMfaRecoveryStatusResponse = createWrappedDto(MfaRecoveryStatusResponseSchema, "WrappedMfaRecoveryStatusResponse");
const WrappedAdminMfaRecoveryRequestList = createWrappedArrayDto(AdminMfaRecoveryRequestSchema, "WrappedAdminMfaRecoveryRequestList");

@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class MfaRecoveryController {
	public constructor(private readonly mfaRecoveryService: MfaRecoveryService) {}

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@ApiBearerAuth()
	@Post("/mfa/recovery")
	@HttpCode(200)
	@ApiOperation({ summary: "Initiate an admin-reviewed MFA recovery request" })
	@ApiOkResponse({ type: WrappedMfaRecoveryStatusResponse })
	public async initiateRecovery(
		@GetUser("sub") userId: string,
		@Body(new ZodValidationPipe(apiContract.auth.mfaRecoveryInitiate.input)) body: InitiateMfaRecoveryInput,
	): Promise<MfaRecoveryStatusResponse> {
		return this.mfaRecoveryService.initiateRecovery(userId, body);
	}

	@ApiBearerAuth()
	@Get("/mfa/recovery/status")
	@ApiOperation({ summary: "Get the current MFA recovery request status" })
	@ApiOkResponse({ type: WrappedMfaRecoveryStatusResponse })
	public async getRecoveryStatus(@GetUser("sub") userId: string): Promise<MfaRecoveryStatusResponse> {
		return this.mfaRecoveryService.getRecoveryStatus(userId);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Get("/admin/mfa/recovery/requests")
	@ApiOperation({ summary: "SuperAdmin: list MFA recovery requests" })
	@ApiOkResponse({ type: WrappedAdminMfaRecoveryRequestList })
	public async listRecoveryRequests(
		@Query(new ZodValidationPipe(apiContract.auth.adminMfaRecoveryRequests.input)) query: AdminMfaRecoveryListQuery,
	): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
		return this.mfaRecoveryService.listAdminRecoveryRequests(query);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Post("/admin/mfa/recovery/review")
	@HttpCode(200)
	@ApiOperation({ summary: "SuperAdmin: approve or deny an MFA recovery request" })
	@ApiOkResponse({ type: WrappedMfaRecoveryStatusResponse })
	public async reviewRecovery(
		@GetUser("sub") adminUserId: string,
		@Body(new ZodValidationPipe(apiContract.auth.adminMfaRecoveryReview.input)) body: AdminReviewMfaRecoveryInput,
	): Promise<MfaRecoveryStatusResponse> {
		if (body.action === "approve") {
			return this.mfaRecoveryService.adminApprove(adminUserId, body);
		}

		return this.mfaRecoveryService.adminDeny(adminUserId, body);
	}
}
