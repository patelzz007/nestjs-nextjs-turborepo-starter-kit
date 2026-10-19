import { Controller, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	AdminKybUpdateSchema,
	AdminLocationRequestResponseSchema,
	AdminMerchantDetailResponseSchema,
	AdminMerchantInviteCreatedResponseSchema,
	AdminOrganizationLocationCreateSchema,
	AdminOrganizationLocationReviewPathInputSchema,
	AdminOrganizationLocationReviewSchema,
	apiContract,
	apiPath,
	EmailPreviewSchema,
	FileDownloadDispositionSchema,
	MerchantKybDocumentDownloadResponseSchema,
	MerchantOrgResponseSchema,
	OkResponseSchema,
	OrganizationLocationResponseSchema,
	UuidParamSchema,
	type AdminLocationRequestResponse,
	type AdminMerchantDetailResponse,
	type EmailPreview,
	type MerchantKybDocumentDownloadResponse,
	type MerchantOrgResponse,
	type OrganizationLocationResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RlsBypass } from "../../../../platform/presentation/http/security/decorators/rls-bypass.decorator";
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
import { GetKybDocumentDownloadUrlQuery } from "../../application/queries/get-kyb-document-download-url/get-kyb-document-download-url.query";
import { GetMerchantDetailQuery } from "../../application/queries/get-merchant-detail/get-merchant-detail.query";
import { ListLocationRequestsQuery } from "../../application/queries/list-location-requests/list-location-requests.query";
import { ListMerchantsQuery } from "../../application/queries/list-merchants/list-merchants.query";
import { PreviewMerchantInviteEmailQuery } from "../../application/queries/preview-merchant-invite-email/preview-merchant-invite-email.query";

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/invites"))
export class RewardsAdminInvitesController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post()
	@ApiOperation({ summary: "Create merchant invite" })
	@ZodResponse(AdminMerchantInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Invite created with token" })
	public createInvite(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.rewardsAdmin.createInvite.input) body: z.output<typeof apiContract.rewardsAdmin.createInvite.input>,
	): Promise<MerchantInviteCreated> {
		return this.commandBus.execute(new ProvisionMerchantFromAdminInviteCommand(actor, body));
	}

	// A pure render (no state change), so a GET: the admin page re-renders it live as the form is typed.
	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Get("preview-email")
	@ApiOperation({
		summary: "Preview merchant invite email (does not send)",
		description:
			"Renders the invite email for a business name and pilot city, for a live preview while the invite is composed. The template's sample business name stands in when none is given. The recipient is not an input: the email body never shows it.",
	})
	@ZodResponse(EmailPreviewSchema, { description: "Rendered invite email preview" })
	public previewInviteEmail(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(apiContract.rewardsAdmin.previewInviteEmail.input) query: z.output<typeof apiContract.rewardsAdmin.previewInviteEmail.input>,
	): Promise<EmailPreview> {
		return this.queryBus.execute(new PreviewMerchantInviteEmailQuery(actor, query));
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/location-requests"))
export class RewardsAdminLocationRequestsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get()
	@ApiOperation({ summary: "List pending organization store location requests" })
	@ZodPaginatedResponse(AdminLocationRequestResponseSchema, { description: "Paginated location requests" })
	public listLocationRequests(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.rewardsAdmin.listLocationRequests.input) query: z.output<typeof apiContract.rewardsAdmin.listLocationRequests.input>,
	): Promise<PaginatedServiceResult<AdminLocationRequestResponse>> {
		return this.queryBus.execute(new ListLocationRequestsQuery(actor, query));
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/merchants"))
export class RewardsAdminMerchantsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get()
	@ApiOperation({ summary: "List merchant organizations" })
	@ZodPaginatedResponse(MerchantOrgResponseSchema, { description: "Paginated merchant org list" })
	public listMerchants(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.rewardsAdmin.listOrganizations.input) query: z.output<typeof apiContract.rewardsAdmin.listOrganizations.input>,
	): Promise<PaginatedServiceResult<MerchantOrgResponse>> {
		return this.queryBus.execute(new ListMerchantsQuery(actor, query));
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get(":organizationId")
	@ApiOperation({ summary: "Get merchant organization detail for KYB review" })
	@ZodResponse(AdminMerchantDetailResponseSchema, { description: "Merchant org detail with KYB payload" })
	public getMerchant(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getOrganization.input) params: { organizationId: string },
	): Promise<AdminMerchantDetailResponse> {
		return this.queryBus.execute(new GetMerchantDetailQuery(actor, params));
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get(":organizationId/documents/:documentId/download")
	@ApiOperation({ summary: "Get a short-lived signed download URL for a merchant KYB document" })
	@ZodResponse(MerchantKybDocumentDownloadResponseSchema, { description: "Signed download URL or scan status" })
	public downloadDocument(
		@CurrentActor() actor: ActorContext,
		@ZodParams(z.object({ organizationId: UuidParamSchema, documentId: UuidParamSchema }).strict()) params: { organizationId: string; documentId: string },
		@ZodQuery(z.object({ disposition: FileDownloadDispositionSchema.optional() }).strict()) query: { disposition?: "inline" | "attachment" },
	): Promise<MerchantKybDocumentDownloadResponse> {
		return this.queryBus.execute(
			new GetKybDocumentDownloadUrlQuery(actor, {
				requester: { kind: "admin", organizationId: params.organizationId },
				documentId: params.documentId,
				disposition: query.disposition ?? "inline",
			}),
		);
	}

	/** D05: checked against the KYB transition table under the profile's row lock, audited in the same transaction. */
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Patch(":organizationId/kyb")
	@ApiOperation({ summary: "Update merchant KYB status (REJECTED / ACTION_REQUIRED require kybFields.rejectionReason)" })
	@ZodResponse(OkResponseSchema, { description: "KYB updated" })
	public async updateKyb(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getOrganization.input) params: { organizationId: string },
		@ZodBody(AdminKybUpdateSchema) body: z.output<typeof AdminKybUpdateSchema>,
	): Promise<{ ok: true }> {
		await this.commandBus.execute(new DecideKybCommand(actor, { ...body, organizationId: params.organizationId }));
		return { ok: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post(":organizationId/locations")
	@ApiOperation({ summary: "Create an organization store location" })
	@ZodResponse(OrganizationLocationResponseSchema, { status: HttpStatus.CREATED, description: "Organization location created" })
	public createLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getOrganization.input) params: { organizationId: string },
		@ZodBody(AdminOrganizationLocationCreateSchema) body: z.output<typeof AdminOrganizationLocationCreateSchema>,
	): Promise<OrganizationLocationResponse> {
		return this.commandBus.execute(new CreateLocationAsAdminCommand(actor, { ...body, organizationId: params.organizationId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Patch(":organizationId/locations/:locationId/review")
	@ApiOperation({ summary: "Approve or reject an organization store location request" })
	@ZodResponse(OrganizationLocationResponseSchema, { description: "Organization location reviewed" })
	public reviewLocation(
		@CurrentActor() actor: ActorContext,
		@ZodParams(AdminOrganizationLocationReviewPathInputSchema) params: { organizationId: string; locationId: string },
		@ZodBody(AdminOrganizationLocationReviewSchema) body: z.output<typeof AdminOrganizationLocationReviewSchema>,
	): Promise<OrganizationLocationResponse> {
		return this.commandBus.execute(new ReviewLocationCommand(actor, { ...body, ...params }));
	}
}
