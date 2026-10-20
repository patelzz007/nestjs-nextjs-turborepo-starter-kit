import { Controller, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	MessageResponseSchema,
	TenantAccessRequestCreateSchema,
	TenantAccessRequestParamSchema,
	TenantAccessRequestResponseSchema,
	TenantContextResponseSchema,
	LocationCloseResponseSchema,
	LocationCloseSchema,
	LocationCreateSchema,
	LocationIdParamSchema,
	LocationResponseSchema,
	LocationUpdateSchema,
	TenantMemberInviteCreatedResponseSchema,
	TenantMemberInviteIdParamSchema,
	TenantMemberInviteListQuerySchema,
	TenantMemberInviteResponseSchema,
	TenantMemberInviteSchema,
	TenantMemberListQuerySchema,
	TenantMemberRosterResponseSchema,
	TenantMemberStoreParamSchema,
	TenantMemberStoreRemoveResponseSchema,
	TenantMemberStoreRemoveSchema,
	MembershipResponseSchema,
	TenantOwnMembershipUpdateSchema,
	TenantSlugParamSchema,
	ReviewTenantAccessRequestSchema,
	type MessageResponse,
	type TenantAccessRequestCreateInput,
	type TenantAccessRequestParam,
	type TenantAccessRequestResponse,
	type TenantContextResponse,
	type LocationCloseInput,
	type LocationCloseResponse,
	type LocationCreateInput,
	type LocationResponse,
	type LocationUpdateInput,
	type TenantMemberInviteCreatedResponse,
	type TenantMemberInviteInput,
	type TenantMemberInviteListQuery,
	type TenantMemberInviteResponse,
	type TenantMemberListQuery,
	type TenantMemberRosterResponse,
	type TenantMemberStoreParam,
	type TenantMemberStoreRemoveInput,
	type TenantMemberStoreRemoveResponse,
	type MembershipResponse,
	type TenantOwnMembershipUpdateInput,
	type PaginatedServiceResult,
	type ReviewTenantAccessRequestInput,
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
import { RequestTenantAccessCommand } from "../../application/commands/request-tenant-access/request-tenant-access.command";
import { ResubmitLocationCommand } from "../../application/commands/resubmit-location/resubmit-location.command";
import { ReviewAccessRequestCommand } from "../../application/commands/review-access-request/review-access-request.command";
import { RevokeInviteCommand } from "../../application/commands/revoke-invite/revoke-invite.command";
import { GetTenantContextQuery } from "../../application/queries/get-tenant-context/get-tenant-context.query";
import { TenantLifecycleRoute } from "./tenant-lifecycle-route.decorator";
import { ListMembersQuery } from "../../application/queries/list-members/list-members.query";
import { ListPendingInvitesQuery } from "../../application/queries/list-pending-invites/list-pending-invites.query";

@ApiTags("Tenants")
@Controller(apiPath("/tenants"))
export class TenantController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@TenantLifecycleRoute()
	@Get(":tenantSlug/context")
	@ZodResponse(TenantContextResponseSchema, { description: "Tenant context for the signed-in member" })
	public getContext(@CurrentActor() actor: ActorContext, @ZodParams(TenantSlugParamSchema) params: { tenantSlug: string }): Promise<TenantContextResponse> {
		return this.queryBus.execute(new GetTenantContextQuery(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/access-requests")
	@ZodResponse(TenantAccessRequestResponseSchema, { status: HttpStatus.CREATED, description: "Tenant access request created" })
	public requestAccess(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodBody(TenantAccessRequestCreateSchema) body: TenantAccessRequestCreateInput,
	): Promise<TenantAccessRequestResponse> {
		return this.commandBus.execute(new RequestTenantAccessCommand(actor, { ...body, tenantSlug: params.tenantSlug }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/locations")
	@ZodResponse(LocationResponseSchema, { status: HttpStatus.CREATED, description: "Tenant store location requested" })
	public createLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodBody(LocationCreateSchema) body: LocationCreateInput,
	): Promise<LocationResponse> {
		return this.commandBus.execute(new ProposeLocationCommand(actor, { ...body, tenantSlug: params.tenantSlug }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch(":tenantSlug/locations/:locationId")
	@ZodResponse(LocationResponseSchema, { description: "Rejected tenant store location resubmitted" })
	public updateLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(LocationIdParamSchema) params: { tenantSlug: string; locationId: string },
		@ZodBody(LocationUpdateSchema) body: LocationUpdateInput,
	): Promise<LocationResponse> {
		return this.commandBus.execute(new ResubmitLocationCommand(actor, { ...body, ...params }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/locations/:locationId/close")
	@ZodResponse(LocationCloseResponseSchema, {
		status: HttpStatus.CREATED,
		description: "Store closed: soft-deleted with its memberships, terminals and keys revoked",
	})
	public closeLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(LocationIdParamSchema) params: { tenantSlug: string; locationId: string },
		@ZodBody(LocationCloseSchema) body: LocationCloseInput,
	): Promise<LocationCloseResponse> {
		return this.commandBus.execute(new CloseLocationCommand(actor, { ...body, ...params }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/members/:membershipId/stores/:locationId/remove")
	@ZodResponse(TenantMemberStoreRemoveResponseSchema, { status: HttpStatus.CREATED, description: "Team member removed from one store" })
	public removeMemberFromStore(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantMemberStoreParamSchema) params: TenantMemberStoreParam,
		@ZodBody(TenantMemberStoreRemoveSchema) body: TenantMemberStoreRemoveInput,
	): Promise<TenantMemberStoreRemoveResponse> {
		return this.commandBus.execute(new RemoveMemberFromStoreCommand(actor, { ...body, ...params }));
	}

	@Get(":tenantSlug/members")
	@ZodPaginatedResponse(TenantMemberRosterResponseSchema, { description: "One page of the tenant member roster; pagination is in `meta`" })
	public listMembers(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodListQuery(TenantMemberListQuerySchema) query: TenantMemberListQuery,
	): Promise<PaginatedServiceResult<TenantMemberRosterResponse>> {
		return this.queryBus.execute(new ListMembersQuery(actor, { tenantSlug: params.tenantSlug, query }));
	}

	/**
	 * Authorization: authenticated; the caller must be a live ACTIVE member of the tenant (else 404, no
	 * existence oracle) and only ever changes their OWN membership (selected by the token's user id). No team
	 * capability needed. Refused (403 TENANT_MEMBERSHIP_UPDATE_DURING_IMPERSONATION) for an impersonation session.
	 */
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch(":tenantSlug/members/me")
	@ZodResponse(MembershipResponseSchema, {
		description: "The signed-in member's own membership after setting (or, with null, clearing) their display name in this tenant",
	})
	public updateOwnMembership(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodBody(TenantOwnMembershipUpdateSchema) body: TenantOwnMembershipUpdateInput,
	): Promise<MembershipResponse> {
		return this.commandBus.execute(new RenameOwnMembershipCommand(actor, { ...body, tenantSlug: params.tenantSlug }));
	}

	@Get(":tenantSlug/members/invites")
	@ZodPaginatedResponse(TenantMemberInviteResponseSchema, { description: "One page of the pending tenant team invitations; pagination is in `meta`" })
	public listMemberInvites(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodListQuery(TenantMemberInviteListQuerySchema) query: TenantMemberInviteListQuery,
	): Promise<PaginatedServiceResult<TenantMemberInviteResponse>> {
		return this.queryBus.execute(new ListPendingInvitesQuery(actor, { tenantSlug: params.tenantSlug, query }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/members/invite")
	@ZodResponse(TenantMemberInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Tenant team invitation sent" })
	public inviteMember(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodBody(TenantMemberInviteSchema) body: TenantMemberInviteInput,
	): Promise<TenantMemberInviteCreatedResponse> {
		return this.commandBus.execute(new InviteMemberCommand(actor, { ...body, tenantSlug: params.tenantSlug }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/members/invites/:inviteId/revoke")
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Tenant team invitation revoked" })
	public async revokeMemberInvite(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantMemberInviteIdParamSchema) params: { tenantSlug: string; inviteId: string },
	): Promise<MessageResponse> {
		await this.commandBus.execute(new RevokeInviteCommand(actor, params));
		return { message: "Invitation revoked" };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/access-requests/:requestId/review")
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Tenant access request reviewed" })
	public async reviewAccessRequest(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantAccessRequestParamSchema) params: TenantAccessRequestParam,
		@ZodBody(ReviewTenantAccessRequestSchema) body: ReviewTenantAccessRequestInput,
	): Promise<MessageResponse> {
		await this.commandBus.execute(new ReviewAccessRequestCommand(actor, { ...body, ...params }));
		return { message: "Access request reviewed" };
	}
}
