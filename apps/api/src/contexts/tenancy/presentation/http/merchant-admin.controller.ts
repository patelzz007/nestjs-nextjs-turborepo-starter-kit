import { Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	AdminKybUpdateSchema,
	AdminTenantAppealParamSchema,
	AdminTenantAppealRejectSchema,
	AdminTenantLifecycleChangeSchema,
	TenantLifecycleResponseSchema,
	type AdminTenantAppealParam,
	type AdminTenantAppealRejectInput,
	type AdminTenantLifecycleChangeInput,
	type TenantLifecycleResponse,
	AdminLocationRequestResponseSchema,
	AdminMerchantDetailResponseSchema,
	AdminMerchantInviteAvailabilitySchema,
	AdminMerchantInviteCreatedResponseSchema,
	AdminLocationCreateSchema,
	AdminLocationReviewPathInputSchema,
	AdminLocationReviewSchema,
	apiContract,
	EmailPreviewSchema,
	FileDownloadDispositionSchema,
	MerchantKybDocumentDownloadResponseSchema,
	MerchantTenantResponseSchema,
	OkResponseSchema,
	LocationResponseSchema,
	UuidParamSchema,
	type AdminLocationRequestResponse,
	type AdminMerchantInviteAvailability,
	type AdminMerchantDetailResponse,
	type EmailPreview,
	type MerchantKybDocumentDownloadResponse,
	type MerchantTenantResponse,
	type LocationResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";
import { z } from "zod";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CreateLocationAsAdminCommand } from "../../application/commands/create-location-as-admin/create-location-as-admin.command";
import { DecideKybCommand } from "../../application/commands/decide-kyb/decide-kyb.command";
import {
	ProvisionMerchantFromAdminInviteCommand,
	type MerchantInviteCreated,
} from "../../application/commands/provision-merchant-from-admin-invite/provision-merchant-from-admin-invite.command";
import { ReviewLocationCommand } from "../../application/commands/review-location/review-location.command";
import { RejectSuspensionAppealCommand } from "../../application/commands/reject-suspension-appeal/reject-suspension-appeal.command";
import { ReinstateTenantCommand } from "../../application/commands/reinstate-tenant/reinstate-tenant.command";
import { SuspendTenantCommand } from "../../application/commands/suspend-tenant/suspend-tenant.command";
import { BanTenantCommand } from "../../application/commands/ban-tenant/ban-tenant.command";
import { UnbanTenantCommand } from "../../application/commands/unban-tenant/unban-tenant.command";
import { GetKybDocumentDownloadUrlQuery } from "../../application/queries/get-kyb-document-download-url/get-kyb-document-download-url.query";
import { MerchantAdminApplicationService } from "../../application/services/merchant-admin.application-service";
import { MerchantInviteApplicationService } from "../../application/services/merchant-invite.application-service";
import { TenantLifecycleApplicationService } from "../../application/services/tenant-lifecycle.application-service";
import {
	KYB_ADMIN_DECIDE_OPERATION,
	LOCATION_ADMIN_CREATE_OPERATION,
	LOCATION_ADMIN_LIST_OPERATION,
	LOCATION_ADMIN_REVIEW_OPERATION,
	MERCHANT_ADMIN_READ_OPERATION,
	PROVISION_ADMIN_MERCHANT_INVITE_OPERATION,
	TENANT_LIFECYCLE_ADMIN_BAN_OPERATION,
	TENANT_LIFECYCLE_ADMIN_REINSTATE_OPERATION,
	TENANT_LIFECYCLE_ADMIN_UNBAN_OPERATION,
	TENANT_LIFECYCLE_ADMIN_REJECT_APPEAL_OPERATION,
	TENANT_LIFECYCLE_ADMIN_SUSPEND_OPERATION,
	TENANT_LIFECYCLE_READ_OPERATION,
} from "../../application/ports/tenants.tokens";

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@ApiController("/admin/invites")
export class RewardsAdminInvitesController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly invites: MerchantInviteApplicationService,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "MERCHANT_ORG")
	@PlatformOperation(PROVISION_ADMIN_MERCHANT_INVITE_OPERATION)
	@Post()
	@ApiOperation({ summary: "Create merchant invite" })
	@ZodResponse(AdminMerchantInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Invite created with token" })
	public createInvite(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.rewardsAdmin.createInvite.input) body: z.output<typeof apiContract.rewardsAdmin.createInvite.input>,
	): Promise<MerchantInviteCreated> {
		return this.commandBus.execute(new ProvisionMerchantFromAdminInviteCommand(actor, body));
	}

	// The admin panel asks before showing the invite page: a single-tenant deployment refuses new merchants.
	@RequirePermission("CREATE", "MERCHANT_ORG")
	@Get("availability")
	@ApiOperation({
		summary: "Whether a new merchant may be invited",
		description: "False on a single-tenant deployment, which serves only its configured tenant; POST /admin/invites is then refused with 403 TENANT_PROVISIONING_DISABLED.",
	})
	@ZodResponse(AdminMerchantInviteAvailabilitySchema, { description: "Invite availability" })
	public getInviteAvailability(): AdminMerchantInviteAvailability {
		return this.invites.availability();
	}

	// A pure render (no state change), so a GET: the admin page re-renders it live as the form is typed.
	@RequirePermission("CREATE", "MERCHANT_ORG")
	@Get("preview-email")
	@ApiOperation({
		summary: "Preview merchant invite email (does not send)",
		description:
			"Renders the invite email for a business name and pilot city, for a live preview while the invite is composed. The template's sample business name stands in when none is given. The recipient is not an input: the email body never shows it.",
	})
	@ZodResponse(EmailPreviewSchema, { description: "Rendered invite email preview" })
	public previewInviteEmail(
		@ZodQuery(apiContract.rewardsAdmin.previewInviteEmail.input) query: z.output<typeof apiContract.rewardsAdmin.previewInviteEmail.input>,
	): EmailPreview {
		return this.invites.previewInviteEmail(query);
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@PlatformOperation(LOCATION_ADMIN_LIST_OPERATION)
@ApiController("/admin/location-requests")
export class RewardsAdminLocationRequestsController {
	public constructor(private readonly merchants: MerchantAdminApplicationService) {}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get()
	@ApiOperation({ summary: "List pending tenant store location requests" })
	@ZodPaginatedResponse(AdminLocationRequestResponseSchema, { description: "Paginated location requests" })
	public listLocationRequests(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.rewardsAdmin.listLocationRequests.input) query: z.output<typeof apiContract.rewardsAdmin.listLocationRequests.input>,
	): Promise<PaginatedServiceResult<AdminLocationRequestResponse>> {
		return this.merchants.listLocationRequests(actor, query);
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@ApiController("/admin/merchants")
export class RewardsAdminMerchantsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly merchants: MerchantAdminApplicationService,
		private readonly lifecycles: TenantLifecycleApplicationService,
	) {}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@PlatformOperation(MERCHANT_ADMIN_READ_OPERATION)
	@Get()
	@ApiOperation({ summary: "List merchant tenants" })
	@ZodPaginatedResponse(MerchantTenantResponseSchema, { description: "Paginated merchant org list" })
	public listMerchants(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.rewardsAdmin.listTenants.input) query: z.output<typeof apiContract.rewardsAdmin.listTenants.input>,
	): Promise<PaginatedServiceResult<MerchantTenantResponse>> {
		return this.merchants.listMerchants(actor, query);
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@PlatformOperation(MERCHANT_ADMIN_READ_OPERATION)
	@Get(":tenantId")
	@ApiOperation({ summary: "Get merchant tenant detail for KYB review" })
	@ZodResponse(AdminMerchantDetailResponseSchema, { description: "Merchant org detail with KYB payload" })
	public getMerchant(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getTenant.input) params: { tenantId: string },
	): Promise<AdminMerchantDetailResponse> {
		return this.merchants.getMerchantDetail(actor, params);
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@PlatformOperation(MERCHANT_ADMIN_READ_OPERATION)
	@Get(":tenantId/documents/:documentId/download")
	@ApiOperation({ summary: "Get a short-lived signed download URL for a merchant KYB document" })
	@ZodResponse(MerchantKybDocumentDownloadResponseSchema, { description: "Signed download URL or scan status" })
	public downloadDocument(
		@CurrentActor() actor: ActorContext,
		@ZodParams(z.object({ tenantId: UuidParamSchema, documentId: UuidParamSchema }).strict()) params: { tenantId: string; documentId: string },
		@ZodQuery(z.object({ disposition: FileDownloadDispositionSchema.optional() }).strict()) query: { disposition?: "inline" | "attachment" },
	): Promise<MerchantKybDocumentDownloadResponse> {
		return this.queryBus.execute(
			new GetKybDocumentDownloadUrlQuery(actor, {
				requester: { kind: "admin", tenantId: params.tenantId },
				documentId: params.documentId,
				disposition: query.disposition ?? "inline",
			}),
		);
	}

	/** D05: checked against the KYB transition table under the profile's row lock, audited in the same transaction. */
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("APPROVE", "MERCHANT_ORG")
	@PlatformOperation(KYB_ADMIN_DECIDE_OPERATION)
	@Patch(":tenantId/kyb")
	@ApiOperation({ summary: "Update merchant KYB status (REJECTED / ACTION_REQUIRED require kybFields.rejectionReason)" })
	@ZodResponse(OkResponseSchema, { description: "KYB updated" })
	public async updateKyb(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getTenant.input) params: { tenantId: string },
		@ZodBody(AdminKybUpdateSchema) body: z.output<typeof AdminKybUpdateSchema>,
	): Promise<{ ok: true }> {
		await this.commandBus.execute(new DecideKybCommand(actor, { ...body, tenantId: params.tenantId }));
		return { ok: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "MERCHANT_ORG")
	@PlatformOperation(LOCATION_ADMIN_CREATE_OPERATION)
	@Post(":tenantId/locations")
	@ApiOperation({ summary: "Create a tenant store location" })
	@ZodResponse(LocationResponseSchema, { status: HttpStatus.CREATED, description: "Tenant location created" })
	public createLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getTenant.input) params: { tenantId: string },
		@ZodBody(AdminLocationCreateSchema) body: z.output<typeof AdminLocationCreateSchema>,
	): Promise<LocationResponse> {
		return this.commandBus.execute(new CreateLocationAsAdminCommand(actor, { ...body, tenantId: params.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("APPROVE", "MERCHANT_ORG")
	@PlatformOperation(LOCATION_ADMIN_REVIEW_OPERATION)
	@Patch(":tenantId/locations/:locationId/review")
	@ApiOperation({ summary: "Approve or reject a tenant store location request" })
	@ZodResponse(LocationResponseSchema, { description: "Tenant location reviewed" })
	public reviewLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(AdminLocationReviewPathInputSchema) params: { tenantId: string; locationId: string },
		@ZodBody(AdminLocationReviewSchema) body: z.output<typeof AdminLocationReviewSchema>,
	): Promise<LocationResponse> {
		return this.commandBus.execute(new ReviewLocationCommand(actor, { ...body, ...params }));
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@PlatformOperation(TENANT_LIFECYCLE_READ_OPERATION)
	@Get(":tenantId/lifecycle")
	@ApiOperation({ summary: "Read a tenant's lifecycle state, current suspension and appeals" })
	@ZodResponse(TenantLifecycleResponseSchema, { description: "Tenant lifecycle" })
	public getLifecycle(@ZodParams(apiContract.rewardsAdmin.getTenant.input) params: { tenantId: string }): Promise<TenantLifecycleResponse> {
		return this.lifecycles.getForPlatform(params);
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("SUSPEND", "MERCHANT_ORG")
	@PlatformOperation(TENANT_LIFECYCLE_ADMIN_SUSPEND_OPERATION)
	@Post(":tenantId/suspend")
	@ApiOperation({ summary: "Suspend an active or restricted tenant: only its lifecycle routes keep working" })
	@ZodResponse(TenantLifecycleResponseSchema, { status: HttpStatus.CREATED, description: "Tenant suspended" })
	public suspend(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getTenant.input) params: { tenantId: string },
		@ZodBody(AdminTenantLifecycleChangeSchema) body: AdminTenantLifecycleChangeInput,
	): Promise<TenantLifecycleResponse> {
		return this.commandBus.execute(new SuspendTenantCommand(actor, { tenantId: params.tenantId, reason: body.reason }));
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("REACTIVATE", "MERCHANT_ORG")
	@PlatformOperation(TENANT_LIFECYCLE_ADMIN_REINSTATE_OPERATION)
	@Post(":tenantId/reinstate")
	@ApiOperation({ summary: "Reinstate a suspended tenant (its pending appeal is accepted with this reason)" })
	@ZodResponse(TenantLifecycleResponseSchema, { status: HttpStatus.CREATED, description: "Tenant reinstated" })
	public reinstate(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getTenant.input) params: { tenantId: string },
		@ZodBody(AdminTenantLifecycleChangeSchema) body: AdminTenantLifecycleChangeInput,
	): Promise<TenantLifecycleResponse> {
		return this.commandBus.execute(new ReinstateTenantCommand(actor, { tenantId: params.tenantId, reason: body.reason }));
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@SuperAdminOnly()
	@RequirePermission("BAN", "MERCHANT_ORG")
	@PlatformOperation(TENANT_LIFECYCLE_ADMIN_BAN_OPERATION)
	@Post(":tenantId/ban")
	@ApiOperation({
		summary: "SuperAdmin: ban an active, restricted or suspended tenant",
		description:
			"Harder than a suspension: the tenant cannot appeal or be reactivated by its owner, and its pending appeal is closed. Only its lifecycle routes keep working (read the status, leave).",
	})
	@ZodResponse(TenantLifecycleResponseSchema, { status: HttpStatus.CREATED, description: "Tenant banned" })
	public ban(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getTenant.input) params: { tenantId: string },
		@ZodBody(AdminTenantLifecycleChangeSchema) body: AdminTenantLifecycleChangeInput,
	): Promise<TenantLifecycleResponse> {
		return this.commandBus.execute(new BanTenantCommand(actor, { tenantId: params.tenantId, reason: body.reason }));
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@SuperAdminOnly()
	@RequirePermission("UNBAN", "MERCHANT_ORG")
	@PlatformOperation(TENANT_LIFECYCLE_ADMIN_UNBAN_OPERATION)
	@Post(":tenantId/unban")
	@ApiOperation({ summary: "SuperAdmin: lift a tenant's ban (it is active again)" })
	@ZodResponse(TenantLifecycleResponseSchema, { status: HttpStatus.CREATED, description: "Tenant unbanned" })
	public unban(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getTenant.input) params: { tenantId: string },
		@ZodBody(AdminTenantLifecycleChangeSchema) body: AdminTenantLifecycleChangeInput,
	): Promise<TenantLifecycleResponse> {
		return this.commandBus.execute(new UnbanTenantCommand(actor, { tenantId: params.tenantId, reason: body.reason }));
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("REJECT", "MERCHANT_ORG")
	@PlatformOperation(TENANT_LIFECYCLE_ADMIN_REJECT_APPEAL_OPERATION)
	@Post(":tenantId/appeals/:appealId/reject")
	@ApiOperation({ summary: "Reject a tenant's pending appeal against its suspension" })
	@ZodResponse(TenantLifecycleResponseSchema, { status: HttpStatus.CREATED, description: "Appeal rejected" })
	public rejectAppeal(
		@CurrentActor() actor: ActorContext,
		@ZodParams(AdminTenantAppealParamSchema) params: AdminTenantAppealParam,
		@ZodBody(AdminTenantAppealRejectSchema) body: AdminTenantAppealRejectInput,
	): Promise<TenantLifecycleResponse> {
		return this.commandBus.execute(new RejectSuspensionAppealCommand(actor, { ...params, note: body.note }));
	}
}
