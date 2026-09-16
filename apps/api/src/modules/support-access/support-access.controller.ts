import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { apiPath, SupportAccessGrantRequestSchema, type SupportAccessGrantRequestInput, type SupportAccessGrantResponse } from "@workspace/shared";

import { GetUser } from "../auth/decorators/get-user.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../auth/decorators/super-admin.decorator";
import type { AccessTokenPayload } from "../auth/services/token.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
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
	@ApiOkResponse({ description: "Support access grant requested" })
	public async requestGrant(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(SupportAccessGrantRequestSchema)) body: SupportAccessGrantRequestInput,
	): Promise<SupportAccessGrantResponse> {
		return this.supportAccess.requestGrant(user.sub, body);
	}

	@Post(":grantId/approve")
	@RequirePermission("UPDATE", "MERCHANT_ORG")
	@ApiOkResponse({ description: "Support access grant approved" })
	public async approve(@GetUser() user: AccessTokenPayload, @Param("grantId") grantId: string, @Body() body: { organizationId: string }): Promise<{ message: string }> {
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
	@ApiOkResponse({ description: "Support access grant revoked" })
	public async revoke(@Param("grantId") grantId: string, @GetUser() user: AccessTokenPayload): Promise<{ message: string }> {
		await this.supportAccess.revoke(grantId, user.sub);
		return { message: "Support access revoked" };
	}
}
