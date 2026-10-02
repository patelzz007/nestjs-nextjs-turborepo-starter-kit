import { Controller, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	MessageResponseSchema,
	OrganizationAccessRequestResponseSchema,
	OrganizationContextResponseSchema,
	OrganizationLocationResponseSchema,
	OrganizationMemberInviteCreatedResponseSchema,
	OrganizationMemberInviteListResponseSchema,
	OrganizationMemberRosterListResponseSchema,
	type MessageResponse,
	OrganizationAccessRequestCreateSchema,
	OrganizationAccessRequestParamSchema,
	OrganizationLocationCreateSchema,
	OrganizationLocationIdParamSchema,
	OrganizationLocationUpdateSchema,
	OrganizationMemberInviteIdParamSchema,
	OrganizationMemberInviteSchema,
	OrganizationSlugParamSchema,
	type OrganizationAccessRequestCreateInput,
	type OrganizationAccessRequestParam,
	type OrganizationAccessRequestResponse,
	type OrganizationContextResponse,
	type OrganizationLocationCreateInput,
	type OrganizationLocationResponse,
	type OrganizationLocationUpdateInput,
	type OrganizationMemberInviteCreatedResponse,
	type OrganizationMemberInviteInput,
	type OrganizationMemberInviteResponse,
	type OrganizationMemberRosterResponse,
	type ReviewOrganizationAccessRequestInput,
	ReviewOrganizationAccessRequestSchema,
} from "@workspace/shared";

import { ZodBody, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { OrganizationContextService } from "../services/organization-context.service";
import { OrganizationLocationService } from "../services/organization-location.service";
import { OrganizationMembershipService } from "../services/organization-membership.service";

@ApiTags("Organizations")
@Controller(apiPath("/orgs"))
export class OrganizationController {
	public constructor(
		private readonly context: OrganizationContextService,
		private readonly membership: OrganizationMembershipService,
		private readonly locations: OrganizationLocationService,
	) {}

	@Get(":orgSlug/context")
	@ZodResponse(OrganizationContextResponseSchema, { description: "Organization context for the signed-in member" })
	public async getContext(@GetUser() user: AccessTokenPayload, @ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string }): Promise<OrganizationContextResponse> {
		return this.context.getContext(user.sub, params.orgSlug);
	}

	@Post(":orgSlug/access-requests")
	@ZodResponse(OrganizationAccessRequestResponseSchema, { status: HttpStatus.CREATED, description: "Organization access request created" })
	public async requestAccess(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodBody(OrganizationAccessRequestCreateSchema) body: OrganizationAccessRequestCreateInput,
	): Promise<OrganizationAccessRequestResponse> {
		const organizationId = await this.context.resolveOrganizationIdBySlug(params.orgSlug);
		return this.membership.createAccessRequest(user.sub, organizationId, body);
	}

	@Post(":orgSlug/locations")
	@ZodResponse(OrganizationLocationResponseSchema, { status: HttpStatus.CREATED, description: "Organization store location requested" })
	public async createLocation(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodBody(OrganizationLocationCreateSchema) body: OrganizationLocationCreateInput,
	): Promise<OrganizationLocationResponse> {
		return this.locations.createMerchantLocation(user.sub, params.orgSlug, body);
	}

	@Patch(":orgSlug/locations/:locationId")
	@ZodResponse(OrganizationLocationResponseSchema, { description: "Rejected organization store location resubmitted" })
	public async updateLocation(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationLocationIdParamSchema) params: { orgSlug: string; locationId: string },
		@ZodBody(OrganizationLocationUpdateSchema) body: OrganizationLocationUpdateInput,
	): Promise<OrganizationLocationResponse> {
		return this.locations.resubmitMerchantLocation(user.sub, params.orgSlug, params.locationId, body);
	}

	@Get(":orgSlug/members")
	@ZodResponse(OrganizationMemberRosterListResponseSchema, { description: "Organization member roster" })
	public async listMembers(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
	): Promise<OrganizationMemberRosterResponse[]> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		return this.membership.listMembers(user.sub, resolved.membership.role, resolved.organizationId);
	}

	@Get(":orgSlug/members/invites")
	@ZodResponse(OrganizationMemberInviteListResponseSchema, { description: "Pending organization team invitations" })
	public async listMemberInvites(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
	): Promise<OrganizationMemberInviteResponse[]> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		return this.membership.listPendingInvites(user.sub, resolved.membership.role, resolved.organizationId);
	}

	@Post(":orgSlug/members/invite")
	@ZodResponse(OrganizationMemberInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Organization team invitation sent" })
	public async inviteMember(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodBody(OrganizationMemberInviteSchema) body: OrganizationMemberInviteInput,
	): Promise<OrganizationMemberInviteCreatedResponse> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		const orgContext = await this.context.getContext(user.sub, params.orgSlug);
		return this.membership.inviteMember(user.sub, resolved.membership.role, resolved.organizationId, orgContext.organization.displayName, body);
	}

	@Post(":orgSlug/members/invites/:inviteId/revoke")
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Organization team invitation revoked" })
	public async revokeMemberInvite(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationMemberInviteIdParamSchema) params: { orgSlug: string; inviteId: string },
	): Promise<MessageResponse> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		await this.membership.revokeInvite(user.sub, resolved.membership.role, resolved.organizationId, params.inviteId);
		return { message: "Invitation revoked" };
	}

	@Post(":orgSlug/access-requests/:requestId/review")
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Organization access request reviewed" })
	public async reviewAccessRequest(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationAccessRequestParamSchema) params: OrganizationAccessRequestParam,
		@ZodBody(ReviewOrganizationAccessRequestSchema) body: ReviewOrganizationAccessRequestInput,
	): Promise<MessageResponse> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		await this.membership.reviewAccessRequest(user.sub, resolved.organizationId, params.requestId, body);
		return { message: "Access request reviewed" };
	}
}
