import { Controller, HttpStatus, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
	AdminCreateOrganizationInviteSchema,
	AdminOrganizationInviteCreatedResponseSchema,
	apiPath,
	type AdminCreateOrganizationInviteInput,
	type AdminOrganizationInviteCreatedResponse,
} from "@workspace/shared";

import { ZodBody } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
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
	@ZodResponse(AdminOrganizationInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Organization invite created" })
	public async createInvite(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(AdminCreateOrganizationInviteSchema) body: AdminCreateOrganizationInviteInput,
	): Promise<AdminOrganizationInviteCreatedResponse> {
		const result = await this.provisioning.provisionFromPlatformInvite(user.sub, body);
		return { organizationId: result.organizationId, inviteToken: result.inviteToken };
	}
}
