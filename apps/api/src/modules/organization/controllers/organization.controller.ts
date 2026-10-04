import { Controller, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	MessageResponseSchema,
	OrganizationAccessRequestResponseSchema,
	OrganizationContextResponseSchema,
	OrganizationLocationResponseSchema,
	OrganizationLocationCloseResponseSchema,
	OrganizationLocationCloseSchema,
	OrganizationMemberStoreParamSchema,
	OrganizationMemberStoreRemoveResponseSchema,
	OrganizationMemberStoreRemoveSchema,
	type OrganizationLocationCloseInput,
	type OrganizationLocationCloseResponse,
	type OrganizationMemberStoreParam,
	type OrganizationMemberStoreRemoveInput,
	type OrganizationMemberStoreRemoveResponse,
	OrganizationMemberInviteCreatedResponseSchema,
	OrganizationMemberInviteListResponseSchema,
	OrganizationMemberRosterListResponseSchema,
	OrganizationMembershipResponseSchema,
	OrganizationOwnMembershipUpdateSchema,
	type OrganizationMembershipResponse,
	type OrganizationOwnMembershipUpdateInput,
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
import { toProfileActor } from "../../auth/profile/profile-actor";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { OrganizationContextService } from "../services/organization-context.service";
import { OrganizationLocationService } from "../services/organization-location.service";
import { OrganizationMembershipService, teamActorFromContext } from "../services/organization-membership.service";
import { OrganizationOwnMembershipService } from "../services/organization-own-membership.service";
import { OrganizationStoreMemberService } from "../services/organization-store-member.service";

@ApiTags("Organizations")
@Controller(apiPath("/orgs"))
export class OrganizationController {
	public constructor(
		private readonly context: OrganizationContextService,
		private readonly membership: OrganizationMembershipService,
		private readonly locations: OrganizationLocationService,
		private readonly storeMembers: OrganizationStoreMemberService,
		private readonly ownMembership: OrganizationOwnMembershipService,
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

	@Post(":orgSlug/locations/:locationId/close")
	@ZodResponse(OrganizationLocationCloseResponseSchema, {
		status: HttpStatus.CREATED,
		description: "Store closed: soft-deleted with its memberships, terminals and keys revoked",
	})
	public async closeLocation(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationLocationIdParamSchema) params: { orgSlug: string; locationId: string },
		@ZodBody(OrganizationLocationCloseSchema) body: OrganizationLocationCloseInput,
	): Promise<OrganizationLocationCloseResponse> {
		return this.locations.closeMerchantLocation(user.sub, params.orgSlug, params.locationId, body);
	}

	@Post(":orgSlug/members/:membershipId/stores/:locationId/remove")
	@ZodResponse(OrganizationMemberStoreRemoveResponseSchema, { status: HttpStatus.CREATED, description: "Team member removed from one store" })
	public async removeMemberFromStore(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationMemberStoreParamSchema) params: OrganizationMemberStoreParam,
		@ZodBody(OrganizationMemberStoreRemoveSchema) body: OrganizationMemberStoreRemoveInput,
	): Promise<OrganizationMemberStoreRemoveResponse> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		return this.storeMembers.removeFromStore(teamActorFromContext(resolved), params.membershipId, params.locationId, body);
	}

	@Get(":orgSlug/members")
	@ZodResponse(OrganizationMemberRosterListResponseSchema, { description: "Organization member roster" })
	public async listMembers(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
	): Promise<OrganizationMemberRosterResponse[]> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		return this.membership.listMembers(teamActorFromContext(resolved));
	}

	/**
	 * Authorization: authenticated; the caller must be a live ACTIVE member of the organization (else 404, no
	 * existence oracle) and only ever changes their OWN membership (selected by the token's user id). No team
	 * capability needed. Refused (403 ORGANIZATION_MEMBERSHIP_UPDATE_DURING_IMPERSONATION) for an impersonation session.
	 */
	@Patch(":orgSlug/members/me")
	@ZodResponse(OrganizationMembershipResponseSchema, {
		description: "The signed-in member's own membership after setting (or, with null, clearing) their display name in this organization",
	})
	public async updateOwnMembership(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodBody(OrganizationOwnMembershipUpdateSchema) body: OrganizationOwnMembershipUpdateInput,
	): Promise<OrganizationMembershipResponse> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		return this.ownMembership.updateOwnMembership(toProfileActor(user).kind, teamActorFromContext(resolved), body);
	}

	@Get(":orgSlug/members/invites")
	@ZodResponse(OrganizationMemberInviteListResponseSchema, { description: "Pending organization team invitations" })
	public async listMemberInvites(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
	): Promise<OrganizationMemberInviteResponse[]> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		return this.membership.listPendingInvites(teamActorFromContext(resolved));
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
		return this.membership.inviteMember(teamActorFromContext(resolved), orgContext.organization.displayName, body);
	}

	@Post(":orgSlug/members/invites/:inviteId/revoke")
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Organization team invitation revoked" })
	public async revokeMemberInvite(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationMemberInviteIdParamSchema) params: { orgSlug: string; inviteId: string },
	): Promise<MessageResponse> {
		const resolved = await this.context.resolveBySlug(user.sub, params.orgSlug);
		await this.membership.revokeInvite(teamActorFromContext(resolved), params.inviteId);
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
		await this.membership.reviewAccessRequest(teamActorFromContext(resolved), params.requestId, body);
		return { message: "Access request reviewed" };
	}
}
