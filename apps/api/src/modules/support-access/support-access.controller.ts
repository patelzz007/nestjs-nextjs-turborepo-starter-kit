import { Body, Controller, Param, Post } from "@nestjs/common";
import { SupportAccessGrantRequestSchema, type SupportAccessGrantRequestInput, type SupportAccessGrantResponse } from "@workspace/shared";

import { GetUser } from "../auth/decorators/get-user.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../auth/decorators/super-admin.decorator";
import type { AccessTokenPayload } from "../auth/services/token.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SupportAccessService } from "./support-access.service";

@Controller("support-access")
export class SupportAccessController {
	public constructor(private readonly supportAccess: SupportAccessService) {}

	@Post("request")
	@SuperAdminOnly()
	@RequirePermission("CREATE", "USER")
	public async requestGrant(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(SupportAccessGrantRequestSchema)) body: SupportAccessGrantRequestInput,
	): Promise<SupportAccessGrantResponse> {
		return this.supportAccess.requestGrant(user.sub, body);
	}

	@Post(":grantId/approve")
	@RequirePermission("UPDATE", "MERCHANT_ORG")
	public async approve(
		@GetUser() user: AccessTokenPayload,
		@Param("grantId") grantId: string,
		@Body() body: { organizationId: string },
	): Promise<{ message: string }> {
		await this.supportAccess.tenantApprove(grantId, user.sub, body.organizationId);
		return { message: "Support access approved" };
	}

	@Post(":grantId/revoke")
	@SuperAdminOnly()
	public async revoke(@GetUser() user: AccessTokenPayload, @Param("grantId") grantId: string): Promise<{ message: string }> {
		await this.supportAccess.revoke(grantId, user.sub);
		return { message: "Support access revoked" };
	}
}
