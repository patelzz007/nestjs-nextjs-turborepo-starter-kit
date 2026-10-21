import { Controller, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	MessageResponseSchema,
	TenantAccessRequestCreateSchema,
	TenantAccessRequestParamSchema,
	TenantAccessRequestResponseSchema,
	TenantAppealCreateSchema,
	TenantContextResponseSchema,
	TenantLifecycleResponseSchema,
	TenantMembershipLeaveResponseSchema,
	type TenantAppealCreateInput,
	type TenantLifecycleResponse,
	type TenantMembershipLeaveResponse,
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
	TenantMemberLocationParamSchema,
	TenantMemberLocationRemoveResponseSchema,
	TenantMemberLocationRemoveSchema,
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
	type TenantMemberLocationParam,
	type TenantMemberLocationRemoveInput,
	type TenantMemberLocationRemoveResponse,
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
import { RemoveMemberFromLocationCommand } from "../../application/commands/remove-member-from-location/remove-member-from-location.command";
import { RenameOwnMembershipCommand } from "../../application/commands/rename-own-membership/rename-own-membership.command";
import { RequestTenantAccessCommand } from "../../application/commands/request-tenant-access/request-tenant-access.command";
import { ResubmitLocationCommand } from "../../application/commands/resubmit-location/resubmit-location.command";
import { ReviewAccessRequestCommand } from "../../application/commands/review-access-request/review-access-request.command";
import { RevokeInviteCommand } from "../../application/commands/revoke-invite/revoke-invite.command";
import { GetTenantContextQuery } from "../../application/queries/get-tenant-context/get-tenant-context.query";
import { TenantLifecycleRoute } from "./tenant-lifecycle-route.decorator";
import { LeaveTenantCommand } from "../../application/commands/leave-tenant/leave-tenant.command";
import { ReactivateTenantCommand } from "../../application/commands/reactivate-tenant/reactivate-tenant.command";
import { SubmitSuspensionAppealCommand } from "../../application/commands/submit-suspension-appeal/submit-suspension-appeal.command";
import { GetTenantLifecycleQuery } from "../../application/queries/get-tenant-lifecycle/get-tenant-lifecycle.query";
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

	// ── Lifecycle routes (MT-23): they run while the tenant is suspended or pending deletion. ──

	@TenantLifecycleRoute()
	@Get(":tenantSlug/lifecycle")
	@ZodResponse(TenantLifecycleResponseSchema, { description: "The tenant's lifecycle state, current suspension and appeals" })
	public getLifecycle(@CurrentActor() actor: ActorContext, @ZodParams(TenantSlugParamSchema) params: { tenantSlug: string }): Promise<TenantLifecycleResponse> {
		return this.queryBus.execute(new GetTenantLifecycleQuery(actor, params));
	}

	@TenantLifecycleRoute()
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/lifecycle/appeals")
	@ZodResponse(TenantLifecycleResponseSchema, { status: HttpStatus.CREATED, description: "Appeal submitted (409 TENANT_APPEAL_PENDING when one is already waiting)" })
	public submitAppeal(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodBody(TenantAppealCreateSchema) body: TenantAppealCreateInput,
	): Promise<TenantLifecycleResponse> {
		return this.commandBus.execute(new SubmitSuspensionAppealCommand(actor, { tenantSlug: params.tenantSlug, message: body.message }));
	}

	@TenantLifecycleRoute()
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/lifecycle/reactivate")
	@ZodResponse(TenantLifecycleResponseSchema, { status: HttpStatus.CREATED, description: "Pending deletion cancelled: the tenant is active again" })
	public reactivate(@CurrentActor() actor: ActorContext, @ZodParams(TenantSlugParamSchema) params: { tenantSlug: string }): Promise<TenantLifecycleResponse> {
		return this.commandBus.execute(new ReactivateTenantCommand(actor, params));
	}

	@TenantLifecycleRoute("leave")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/members/me/leave")
	@ZodResponse(TenantMembershipLeaveResponseSchema, { status: HttpStatus.CREATED, description: "Left the tenant (409 TENANT_OWNER_CANNOT_LEAVE for the owner)" })
	public leave(@CurrentActor() actor: ActorContext, @ZodParams(TenantSlugParamSchema) params: { tenantSlug: string }): Promise<TenantMembershipLeaveResponse> {
		return this.commandBus.execute(new LeaveTenantCommand(actor, params));
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
	@Post(":tenantSlug/members/:membershipId/locations/:locationId/remove")
	@ZodResponse(TenantMemberLocationRemoveResponseSchema, { status: HttpStatus.CREATED, description: "Team member removed from one store" })
	public removeMemberFromLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantMemberLocationParamSchema) params: TenantMemberLocationParam,
		@ZodBody(TenantMemberLocationRemoveSchema) body: TenantMemberLocationRemoveInput,
	): Promise<TenantMemberLocationRemoveResponse> {
		return this.commandBus.execute(new RemoveMemberFromLocationCommand(actor, { ...body, ...params }));
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
