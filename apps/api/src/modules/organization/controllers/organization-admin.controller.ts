import { Body, Controller, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AdminCreateOrganizationInviteSchema, apiPath, type AdminCreateOrganizationInviteInput } from "@workspace/shared";

import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../auth/decorators/super-admin.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { OrganizationProvisioningService } from "../services/organization-provisioning.service";

@ApiTags("Organizations")
@Controller(apiPath("/admin/organizations"))
export class OrganizationAdminController {
	public constructor(private readonly provisioning: OrganizationProvisioningService) {}

	@Post("invites")
	@SuperAdminOnly()
	@RequirePermission("CREATE", "MERCHANT_ORG")
	@ApiOkResponse({ description: "Organization invite created" })
	public async createInvite(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(AdminCreateOrganizationInviteSchema)) body: AdminCreateOrganizationInviteInput,
	): Promise<{ organizationId: string; inviteToken: string }> {
		const result = await this.provisioning.provisionFromPlatformInvite(user.sub, body);
		return { organizationId: result.organizationId, inviteToken: result.inviteToken };
	}
}
