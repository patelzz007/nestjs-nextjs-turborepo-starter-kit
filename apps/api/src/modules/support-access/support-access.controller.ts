import { Controller, HttpStatus, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	MessageResponseSchema,
	SupportAccessGrantApproveSchema,
	SupportAccessGrantRequestSchema,
	SupportAccessGrantResponseSchema,
	UuidParamSchema,
	type MessageResponse,
	type SupportAccessGrantApproveInput,
	type SupportAccessGrantRequestInput,
	type SupportAccessGrantResponse,
} from "@workspace/shared";

import { GetUser } from "../auth/decorators/get-user.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../auth/decorators/super-admin.decorator";
import type { AccessTokenPayload } from "../auth/services/token.service";
import { ZodBody, ZodParam } from "../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../common/decorators/zod-response.decorators";
import { Authorize } from "../authorization/decorators/authorize.decorator";
import { SupportAccessService } from "./support-access.service";

@ApiTags("Support Access")
@Controller(apiPath("/support-access"))
export class SupportAccessController {
	public constructor(private readonly supportAccess: SupportAccessService) {}

	@Post("request")
	@SuperAdminOnly()
	@RequirePermission("CREATE", "USER")
	@Authorize({
		action: "CREATE",
		resource: "USER",
		description: "SuperAdmin can request support access",
	})
	@ZodResponse(SupportAccessGrantResponseSchema, { status: HttpStatus.CREATED, description: "Support access grant requested" })
	public async requestGrant(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(SupportAccessGrantRequestSchema) body: SupportAccessGrantRequestInput,
	): Promise<SupportAccessGrantResponse> {
		return this.supportAccess.requestGrant(user.sub, body);
	}

	@Post(":grantId/approve")
	@RequirePermission("UPDATE", "MERCHANT_ORG")
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Support access grant approved" })
	public async approve(
		@GetUser() user: AccessTokenPayload,
		@ZodParam("grantId", UuidParamSchema) grantId: string,
		@ZodBody(SupportAccessGrantApproveSchema) body: SupportAccessGrantApproveInput,
	): Promise<MessageResponse> {
		await this.supportAccess.tenantApprove(grantId, user.sub, body.organizationId);
		return { message: "Support access approved" };
	}

	@Post(":grantId/revoke")
	@SuperAdminOnly()
	@Authorize({
		action: "DELETE",
		resource: "USER",
		resourceId: "grantId",
		description: "SuperAdmin can revoke support access",
	})
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Support access grant revoked" })
	public async revoke(@ZodParam("grantId", UuidParamSchema) grantId: string, @GetUser() user: AccessTokenPayload): Promise<MessageResponse> {
		await this.supportAccess.revoke(grantId, user.sub);
		return { message: "Support access revoked" };
	}
}
