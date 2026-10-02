import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrganizationLocationStatus, PilotCity } from "@prisma/client";
import {
	epochMs,
	MERCHANT_CAPABILITY,
	type AdminLocationRequestListQuery,
	type AdminLocationRequestResponse,
	type AdminOrganizationLocationCreateInput,
	type AdminOrganizationLocationReviewInput,
	type OrganizationLocationCreateInput,
	type OrganizationLocationDraft,
	type OrganizationLocationResponse,
	type OrganizationLocationUpdateInput,
	type OrganizationMembershipRole,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationLocationRepository, type AdminLocationRequestRow } from "../repositories/organization-location.repository";
import { mapOrganizationLocationToResponse } from "../utils/organization-location-mapper.util";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationContextService } from "./organization-context.service";
import { OrganizationRewardAuthService } from "./organization-reward-auth.service";

const MAX_PENDING_LOCATIONS_PER_ORG = 5;

@Injectable()
export class OrganizationLocationService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly organizationContext: OrganizationContextService,
		private readonly locationRepository: OrganizationLocationRepository,
		private readonly audit: OrganizationAuditService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
	) {}

	public async createMerchantLocation(userId: string, orgSlug: string, input: OrganizationLocationCreateInput): Promise<OrganizationLocationResponse> {
		const resolved = await this.organizationContext.resolveBySlug(userId, orgSlug);
		await this.requireManageLocations(userId, resolved.membership.role, resolved.organizationId);

		return this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "organization.location.create",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => {
				const pendingCount = await this.locationRepository.countPendingByOrganization(resolved.organizationId);
				if (pendingCount >= MAX_PENDING_LOCATIONS_PER_ORG) {
					throw new BadRequestException("Too many store requests are already pending review");
				}

				const org = await tx.organization.findUnique({
					where: { id: resolved.organizationId },
					select: { merchantProfile: { select: { city: true } } },
				});

				if (org?.merchantProfile === undefined || org.merchantProfile === null) {
					throw new NotFoundException();
				}

				const location = await this.locationRepository.create(tx, {
					organizationId: resolved.organizationId,
					name: input.name,
					addressText: input.addressText,
					city: org.merchantProfile.city,
					contactPhone: input.contactPhone ?? null,
					status: "PENDING_APPROVAL",
					isPrimary: false,
					requestedByUserId: userId,
					reviewedByUserId: null,
					reviewedAt: null,
				});

				await this.audit.record({
					organizationId: resolved.organizationId,
					actorUserId: userId,
					action: "organization.location.requested",
					resourceType: "OrganizationLocation",
					resourceId: location.id,
				});

				return mapOrganizationLocationToResponse(location);
			},
		);
	}

	public async resubmitMerchantLocation(userId: string, orgSlug: string, locationId: string, input: OrganizationLocationUpdateInput): Promise<OrganizationLocationResponse> {
		const resolved = await this.organizationContext.resolveBySlug(userId, orgSlug);
		await this.requireManageLocations(userId, resolved.membership.role, resolved.organizationId);

		return this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "organization.location.resubmit",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => {
				const existing = await this.locationRepository.findById(resolved.organizationId, locationId);
				if (existing === null) {
					throw new NotFoundException();
				}
				if (existing.status !== "REJECTED") {
					throw new BadRequestException("Only rejected store requests can be edited and resubmitted");
				}

				const location = await this.locationRepository.updateRejectedLocation(tx, locationId, {
					name: input.name,
					addressText: input.addressText,
					contactPhone: input.contactPhone ?? null,
					requestedByUserId: userId,
				});

				await this.audit.record({
					organizationId: resolved.organizationId,
					actorUserId: userId,
					action: "organization.location.resubmitted",
					resourceType: "OrganizationLocation",
					resourceId: location.id,
				});

				return mapOrganizationLocationToResponse(location);
			},
		);
	}

	public async createAdminLocation(adminUserId: string, organizationId: string, input: AdminOrganizationLocationCreateInput): Promise<OrganizationLocationResponse> {
		return this.tenantTx.withSystemOperation(
			{
				operation: "organization.location.admin_create",
				reason: "RewardHub admin created organization location",
				correlationId: `admin-location:${organizationId}`,
				actorUserId: adminUserId,
			},
			async (tx) => {
				const org = await tx.organization.findFirst({
					where: { id: organizationId, isDeleted: false },
					select: { merchantProfile: { select: { city: true } } },
				});

				if (org?.merchantProfile == null) {
					throw new NotFoundException();
				}

				const status: OrganizationLocationStatus = input.approveImmediately ? "ACTIVE" : "PENDING_APPROVAL";
				const reviewedAt = input.approveImmediately ? BigInt(Date.now()) : null;

				const location = await this.locationRepository.create(tx, {
					organizationId,
					name: input.name,
					addressText: input.addressText,
					city: input.city ?? org.merchantProfile.city,
					contactPhone: input.contactPhone ?? null,
					status,
					isPrimary: false,
					requestedByUserId: adminUserId,
					reviewedByUserId: input.approveImmediately ? adminUserId : null,
					reviewedAt,
				});

				await this.audit.record({
					organizationId,
					actorUserId: adminUserId,
					action: "organization.location.admin_created",
					resourceType: "OrganizationLocation",
					resourceId: location.id,
					metadata: { status },
				});

				return mapOrganizationLocationToResponse(location);
			},
		);
	}

	public async reviewAdminLocation(
		adminUserId: string,
		organizationId: string,
		locationId: string,
		input: AdminOrganizationLocationReviewInput,
	): Promise<OrganizationLocationResponse> {
		return this.tenantTx.withSystemOperation(
			{
				operation: "organization.location.admin_review",
				reason: "RewardHub admin reviewed organization location",
				correlationId: `admin-location-review:${locationId}`,
				actorUserId: adminUserId,
			},
			async (tx) => {
				const existing = await tx.organizationLocation.findFirst({
					where: { id: locationId, organizationId, isDeleted: false },
				});

				if (existing === null) {
					throw new NotFoundException();
				}

				if (existing.status !== "PENDING_APPROVAL") {
					throw new BadRequestException("Only pending store requests can be reviewed");
				}

				const location = await this.locationRepository.reviewLocation(tx, locationId, {
					approve: input.approve,
					rejectionReason: input.approve ? null : (input.rejectionReason?.trim() ?? null),
					reviewedByUserId: adminUserId,
				});

				await this.audit.record({
					organizationId,
					actorUserId: adminUserId,
					action: input.approve ? "organization.location.approved" : "organization.location.rejected",
					resourceType: "OrganizationLocation",
					resourceId: location.id,
				});

				return mapOrganizationLocationToResponse(location);
			},
		);
	}

	public async listAdminLocationRequests(query: AdminLocationRequestListQuery): Promise<PaginatedServiceResult<AdminLocationRequestResponse>> {
		const result = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.location.admin_list",
				reason: "List organization location requests",
				correlationId: "admin-location-requests",
				actorUserId: null,
			},
			async (tx) => this.locationRepository.listAdminRequestsInTx(tx, query),
		);
		return toPaginatedServiceResult(
			mapListResult(result, (row) => this.mapAdminLocationRequest(row)),
			query,
		);
	}

	public async finalizeOnboardingLocations(
		organizationId: string,
		userId: string,
		city: PilotCity,
		primary: { readonly name: string; readonly addressText: string; readonly contactPhone: string },
		additionalLocations: readonly OrganizationLocationDraft[],
	): Promise<void> {
		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.location.onboarding_finalize",
				reason: "Finalize organization locations after merchant onboarding",
				correlationId: `onboarding-locations:${organizationId}`,
				actorUserId: userId,
			},
			async (tx) => {
				await this.locationRepository.updatePrimaryFromOnboarding(tx, organizationId, {
					name: primary.name,
					addressText: primary.addressText,
					city,
					contactPhone: primary.contactPhone,
					reviewedByUserId: userId,
				});

				for (const draft of additionalLocations) {
					await this.locationRepository.create(tx, {
						organizationId,
						name: draft.name,
						addressText: draft.addressText,
						city,
						contactPhone: draft.contactPhone ?? null,
						status: "PENDING_APPROVAL",
						isPrimary: false,
						requestedByUserId: userId,
						reviewedByUserId: null,
						reviewedAt: null,
					});
				}
			},
		);
	}

	private mapAdminLocationRequest(row: AdminLocationRequestRow): AdminLocationRequestResponse {
		return {
			id: row.id,
			organizationId: row.organizationId,
			organizationSlug: row.organization.slug,
			organizationDisplayName: row.organization.displayName,
			name: row.name,
			code: row.code,
			addressText: row.addressText,
			city: row.city,
			contactPhone: row.contactPhone,
			status: row.status,
			rejectionReason: row.rejectionReason,
			isPrimary: row.isPrimary,
			requestedByUserId: row.requestedByUserId,
			createdAt: epochMs(Number(row.createdAt)),
		};
	}

	/** Requesting and resubmitting stores need `merchant:manage_locations` (role table → tenant Cedar policy). */
	private async requireManageLocations(userId: string, role: OrganizationMembershipRole, organizationId: string): Promise<void> {
		await this.organizationRewardAuth.requireMembershipCapability({ userId, organizationId, role }, MERCHANT_CAPABILITY.manageLocations);
	}
}
