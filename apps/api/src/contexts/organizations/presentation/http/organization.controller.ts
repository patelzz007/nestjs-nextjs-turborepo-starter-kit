import { Controller, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	MessageResponseSchema,
	OrganizationAccessRequestCreateSchema,
	OrganizationAccessRequestParamSchema,
	OrganizationAccessRequestResponseSchema,
	OrganizationContextResponseSchema,
	OrganizationLocationCloseResponseSchema,
	OrganizationLocationCloseSchema,
	OrganizationLocationCreateSchema,
	OrganizationLocationIdParamSchema,
	OrganizationLocationResponseSchema,
	OrganizationLocationUpdateSchema,
	OrganizationMemberInviteCreatedResponseSchema,
	OrganizationMemberInviteIdParamSchema,
	OrganizationMemberInviteListQuerySchema,
	OrganizationMemberInviteResponseSchema,
	OrganizationMemberInviteSchema,
	OrganizationMemberListQuerySchema,
	OrganizationMemberRosterResponseSchema,
	OrganizationMemberStoreParamSchema,
	OrganizationMemberStoreRemoveResponseSchema,
	OrganizationMemberStoreRemoveSchema,
	OrganizationMembershipResponseSchema,
	OrganizationOwnMembershipUpdateSchema,
	OrganizationSlugParamSchema,
	ReviewOrganizationAccessRequestSchema,
	type MessageResponse,
	type OrganizationAccessRequestCreateInput,
	type OrganizationAccessRequestParam,
	type OrganizationAccessRequestResponse,
	type OrganizationContextResponse,
	type OrganizationLocationCloseInput,
	type OrganizationLocationCloseResponse,
	type OrganizationLocationCreateInput,
	type OrganizationLocationResponse,
	type OrganizationLocationUpdateInput,
	type OrganizationMemberInviteCreatedResponse,
	type OrganizationMemberInviteInput,
	type OrganizationMemberInviteListQuery,
	type OrganizationMemberInviteResponse,
	type OrganizationMemberListQuery,
	type OrganizationMemberRosterResponse,
	type OrganizationMemberStoreParam,
	type OrganizationMemberStoreRemoveInput,
	type OrganizationMemberStoreRemoveResponse,
	type OrganizationMembershipResponse,
	type OrganizationOwnMembershipUpdateInput,
	type PaginatedServiceResult,
	type ReviewOrganizationAccessRequestInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CloseLocationCommand } from "../../application/commands/close-location/close-location.command";
import { InviteMemberCommand } from "../../application/commands/invite-member/invite-member.command";
import { ProposeLocationCommand } from "../../application/commands/propose-location/propose-location.command";
import { RemoveMemberFromStoreCommand } from "../../application/commands/remove-member-from-store/remove-member-from-store.command";
import { RenameOwnMembershipCommand } from "../../application/commands/rename-own-membership/rename-own-membership.command";
import { RequestOrganizationAccessCommand } from "../../application/commands/request-organization-access/request-organization-access.command";
import { ResubmitLocationCommand } from "../../application/commands/resubmit-location/resubmit-location.command";
import { ReviewAccessRequestCommand } from "../../application/commands/review-access-request/review-access-request.command";
import { RevokeInviteCommand } from "../../application/commands/revoke-invite/revoke-invite.command";
import { GetOrganizationContextQuery } from "../../application/queries/get-organization-context/get-organization-context.query";
import { ListMembersQuery } from "../../application/queries/list-members/list-members.query";
import { ListPendingInvitesQuery } from "../../application/queries/list-pending-invites/list-pending-invites.query";

@ApiTags("Organizations")
@Controller(apiPath("/orgs"))
export class OrganizationController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@Get(":orgSlug/context")
	@ZodResponse(OrganizationContextResponseSchema, { description: "Organization context for the signed-in member" })
	public getContext(@CurrentActor() actor: ActorContext, @ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string }): Promise<OrganizationContextResponse> {
		return this.queryBus.execute(new GetOrganizationContextQuery(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":orgSlug/access-requests")
	@ZodResponse(OrganizationAccessRequestResponseSchema, { status: HttpStatus.CREATED, description: "Organization access request created" })
	public requestAccess(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodBody(OrganizationAccessRequestCreateSchema) body: OrganizationAccessRequestCreateInput,
	): Promise<OrganizationAccessRequestResponse> {
		return this.commandBus.execute(new RequestOrganizationAccessCommand(actor, { ...body, orgSlug: params.orgSlug }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":orgSlug/locations")
	@ZodResponse(OrganizationLocationResponseSchema, { status: HttpStatus.CREATED, description: "Organization store location requested" })
	public createLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodBody(OrganizationLocationCreateSchema) body: OrganizationLocationCreateInput,
	): Promise<OrganizationLocationResponse> {
		return this.commandBus.execute(new ProposeLocationCommand(actor, { ...body, orgSlug: params.orgSlug }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch(":orgSlug/locations/:locationId")
	@ZodResponse(OrganizationLocationResponseSchema, { description: "Rejected organization store location resubmitted" })
	public updateLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationLocationIdParamSchema) params: { orgSlug: string; locationId: string },
		@ZodBody(OrganizationLocationUpdateSchema) body: OrganizationLocationUpdateInput,
	): Promise<OrganizationLocationResponse> {
		return this.commandBus.execute(new ResubmitLocationCommand(actor, { ...body, ...params }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":orgSlug/locations/:locationId/close")
	@ZodResponse(OrganizationLocationCloseResponseSchema, {
		status: HttpStatus.CREATED,
		description: "Store closed: soft-deleted with its memberships, terminals and keys revoked",
	})
	public closeLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationLocationIdParamSchema) params: { orgSlug: string; locationId: string },
		@ZodBody(OrganizationLocationCloseSchema) body: OrganizationLocationCloseInput,
	): Promise<OrganizationLocationCloseResponse> {
		return this.commandBus.execute(new CloseLocationCommand(actor, { ...body, ...params }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":orgSlug/members/:membershipId/stores/:locationId/remove")
	@ZodResponse(OrganizationMemberStoreRemoveResponseSchema, { status: HttpStatus.CREATED, description: "Team member removed from one store" })
	public removeMemberFromStore(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationMemberStoreParamSchema) params: OrganizationMemberStoreParam,
		@ZodBody(OrganizationMemberStoreRemoveSchema) body: OrganizationMemberStoreRemoveInput,
	): Promise<OrganizationMemberStoreRemoveResponse> {
		return this.commandBus.execute(new RemoveMemberFromStoreCommand(actor, { ...body, ...params }));
	}

	@Get(":orgSlug/members")
	@ZodPaginatedResponse(OrganizationMemberRosterResponseSchema, { description: "One page of the organization member roster; pagination is in `meta`" })
	public listMembers(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodListQuery(OrganizationMemberListQuerySchema) query: OrganizationMemberListQuery,
	): Promise<PaginatedServiceResult<OrganizationMemberRosterResponse>> {
		return this.queryBus.execute(new ListMembersQuery(actor, { orgSlug: params.orgSlug, query }));
	}

	/**
	 * Authorization: authenticated; the caller must be a live ACTIVE member of the organization (else 404, no
	 * existence oracle) and only ever changes their OWN membership (selected by the token's user id). No team
	 * capability needed. Refused (403 ORGANIZATION_MEMBERSHIP_UPDATE_DURING_IMPERSONATION) for an impersonation session.
	 */
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch(":orgSlug/members/me")
	@ZodResponse(OrganizationMembershipResponseSchema, {
		description: "The signed-in member's own membership after setting (or, with null, clearing) their display name in this organization",
	})
	public updateOwnMembership(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodBody(OrganizationOwnMembershipUpdateSchema) body: OrganizationOwnMembershipUpdateInput,
	): Promise<OrganizationMembershipResponse> {
		return this.commandBus.execute(new RenameOwnMembershipCommand(actor, { ...body, orgSlug: params.orgSlug }));
	}

	@Get(":orgSlug/members/invites")
	@ZodPaginatedResponse(OrganizationMemberInviteResponseSchema, { description: "One page of the pending organization team invitations; pagination is in `meta`" })
	public listMemberInvites(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodListQuery(OrganizationMemberInviteListQuerySchema) query: OrganizationMemberInviteListQuery,
	): Promise<PaginatedServiceResult<OrganizationMemberInviteResponse>> {
		return this.queryBus.execute(new ListPendingInvitesQuery(actor, { orgSlug: params.orgSlug, query }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":orgSlug/members/invite")
	@ZodResponse(OrganizationMemberInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Organization team invitation sent" })
	public inviteMember(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) params: { orgSlug: string },
		@ZodBody(OrganizationMemberInviteSchema) body: OrganizationMemberInviteInput,
	): Promise<OrganizationMemberInviteCreatedResponse> {
		return this.commandBus.execute(new InviteMemberCommand(actor, { ...body, orgSlug: params.orgSlug }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":orgSlug/members/invites/:inviteId/revoke")
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Organization team invitation revoked" })
	public async revokeMemberInvite(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationMemberInviteIdParamSchema) params: { orgSlug: string; inviteId: string },
	): Promise<MessageResponse> {
		await this.commandBus.execute(new RevokeInviteCommand(actor, params));
		return { message: "Invitation revoked" };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":orgSlug/access-requests/:requestId/review")
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Organization access request reviewed" })
	public async reviewAccessRequest(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationAccessRequestParamSchema) params: OrganizationAccessRequestParam,
		@ZodBody(ReviewOrganizationAccessRequestSchema) body: ReviewOrganizationAccessRequestInput,
	): Promise<MessageResponse> {
		await this.commandBus.execute(new ReviewAccessRequestCommand(actor, { ...body, ...params }));
		return { message: "Access request reviewed" };
	}
}
