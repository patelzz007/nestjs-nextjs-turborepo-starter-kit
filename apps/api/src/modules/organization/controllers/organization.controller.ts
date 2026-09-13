import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	OrganizationAccessRequestCreateSchema,
	OrganizationMemberInviteSchema,
	OrganizationSlugParamSchema,
	type OrganizationAccessRequestCreateInput,
	type OrganizationAccessRequestResponse,
	type OrganizationContextResponse,
	type OrganizationMemberInviteInput,
	type ReviewOrganizationAccessRequestInput,
	ReviewOrganizationAccessRequestSchema,
} from "@workspace/shared";

import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { OrganizationContextService } from "../services/organization-context.service";
import { OrganizationMembershipService } from "../services/organization-membership.service";

@ApiTags("Organizations")
@Controller(apiPath("/orgs"))
export class OrganizationController {
	public constructor(
		private readonly context: OrganizationContextService,
		private readonly membership: OrganizationMembershipService,
	) {}

	@Get(":orgSlug/context")
	@ApiOkResponse({ description: "Organization context for the signed-in member" })
	public async getContext(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) params: { orgSlug: string },
	): Promise<OrganizationContextResponse> {
		return this.context.getContext(user.sub, params.orgSlug);
	}

	@Post(":orgSlug/access-requests")
	@ApiOkResponse({ description: "Organization access request created" })
	public async requestAccess(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) params: { orgSlug: string },
		@Body(new ZodValidationPipe(OrganizationAccessRequestCreateSchema)) body: OrganizationAccessRequestCreateInput,
	): Promise<OrganizationAccessRequestResponse> {
		const organizationId = await this.context.resolveOrganizationIdBySlug(params.orgSlug);
		return this.membership.createAccessRequest(user.sub, organizationId, body);
	}

	@Post(":orgSlug/members/invite")
	@ApiOkResponse({ description: "Organization member invited" })
	public async inviteMember(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) params: { orgSlug: string },
		@Body(new ZodValidationPipe(OrganizationMemberInviteSchema)) body: OrganizationMemberInviteInput,
	): Promise<{ message: string }> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		await this.membership.inviteMember(user.sub, resolved.organizationId, body);
		return { message: "Member invited" };
	}

	@Post(":orgSlug/access-requests/:requestId/review")
	@ApiOkResponse({ description: "Organization access request reviewed" })
	public async reviewAccessRequest(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) params: { orgSlug: string },
		@Param("requestId") requestId: string,
		@Body(new ZodValidationPipe(ReviewOrganizationAccessRequestSchema)) body: ReviewOrganizationAccessRequestInput,
	): Promise<{ message: string }> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		await this.membership.reviewAccessRequest(user.sub, resolved.organizationId, requestId, body);
		return { message: "Access request reviewed" };
	}
}
