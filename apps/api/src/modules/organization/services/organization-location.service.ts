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
	type OrganizationLocationCloseInput,
	type OrganizationLocationCloseResponse,
	type OrganizationLocationDraft,
	type OrganizationLocationResponse,
	type OrganizationLocationUpdateInput,
	type OrganizationMembershipRole,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationLocationRepository, type AdminLocationRequestRow } from "../repositories/organization-location.repository";
import { StoreAccessRepository } from "../repositories/store-access.repository";
import { mapOrganizationLocationToResponse } from "../utils/organization-location-mapper.util";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationContextService } from "./organization-context.service";
import { OrganizationRewardAuthService } from "./organization-reward-auth.service";

const MAX_PENDING_LOCATIONS_PER_ORG = 5;

/** A location state transition lost to a concurrent change (or was never valid from the current status). */
const LOCATION_STATUS_CONFLICT_CODE = "ORGANIZATION_LOCATION_STATUS_CONFLICT";

/** Closing the primary store is refused: it anchors the organization (one live primary is an invariant). */
export const LOCATION_PRIMARY_CLOSE_REFUSED_CODE = "ORGANIZATION_LOCATION_PRIMARY_CANNOT_CLOSE";

/** The actor's location scope does not cover the store they tried to act on. */
export const STORE_OUT_OF_SCOPE_CODE = "ORGANIZATION_STORE_OUT_OF_SCOPE";

/** The transaction client a location write runs on. */
type LocationReadTransaction = Parameters<OrganizationLocationRepository["findByIdInTx"]>[0];
/** The transaction client the onboarding location writes run on. */
type LocationWriteTransaction = Parameters<OrganizationLocationRepository["create"]>[0];

@Injectable()
export class OrganizationLocationService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly organizationContext: OrganizationContextService,
		private readonly locationRepository: OrganizationLocationRepository,
		private readonly audit: OrganizationAuditService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly cedar: CedarPolicyEvaluatorService,
		private readonly storeAccess: StoreAccessRepository,
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
				// Quota check and insert under the organization's location lock: two
				// concurrent requests cannot both see "4 pending" and create a 6th.
				await this.locationRepository.lockOrganizationLocationsInTx(tx, resolved.organizationId);
				const pendingCount = await this.locationRepository.countPendingByOrganizationInTx(tx, resolved.organizationId);
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

				await this.audit.recordInTx(tx, {
					organizationId: resolved.organizationId,
					actorUserId: userId,
					policyVersion: resolved.policyVersion,
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
				const location = await this.locationRepository.resubmitRejectedLocationInTx(tx, resolved.organizationId, locationId, {
					name: input.name,
					addressText: input.addressText,
					contactPhone: input.contactPhone ?? null,
					requestedByUserId: userId,
				});
				if (location === null) {
					throw await this.locationStateConflict(tx, resolved.organizationId, locationId, "Only rejected store requests can be edited and resubmitted");
				}

				await this.audit.recordInTx(tx, {
					organizationId: resolved.organizationId,
					actorUserId: userId,
					policyVersion: resolved.policyVersion,
					action: "organization.location.resubmitted",
					resourceType: "OrganizationLocation",
					resourceId: location.id,
				});

				return mapOrganizationLocationToResponse(location);
			},
		);
	}

	/**
	 * Close a store for good (bankruptcy, lease ended): soft-deletes the
	 * location and its mirrored store and takes away everything that grants
	 * access to it — store memberships, member scope rows, terminals, and
	 * store-scoped API keys — in ONE transaction with the audit row. Sales and
	 * redemption history stay readable (nothing is hard-deleted). Needs
	 * `merchant:manage_locations` and a location scope that covers the store;
	 * the primary store cannot be closed.
	 */
	public async closeMerchantLocation(userId: string, orgSlug: string, locationId: string, input: OrganizationLocationCloseInput): Promise<OrganizationLocationCloseResponse> {
		const resolved = await this.organizationContext.resolveBySlug(userId, orgSlug);
		await this.requireManageLocations(userId, resolved.membership.role, resolved.organizationId);
		if (resolved.membership.locationScopeType !== "ALL_LOCATIONS" && !resolved.membership.locationIds.includes(locationId)) {
			throw new AuthorizationError({ code: STORE_OUT_OF_SCOPE_CODE, message: "This store is outside your location scope" });
		}

		return this.tenantTx.withSystemOperation({ operation: "organization.location.close", reason: "Merchant closed a store", actorUserId: userId }, async (tx) => {
			const organizationId = resolved.organizationId;
			await this.locationRepository.lockOrganizationLocationsInTx(tx, organizationId);
			const stamp = { actorUserId: userId, at: Date.now() };
			const closed = await this.locationRepository.closeLocationInTx(tx, organizationId, locationId, {
				reason: input.reason,
				closedByUserId: userId,
				at: stamp.at,
			});
			if (closed === null) {
				throw await this.closeRefusal(tx, organizationId, locationId);
			}

			const storeId = await this.storeAccess.findStoreIdByLocationInTx(tx, locationId);
			if (storeId === null) {
				throw new NotFoundError();
			}
			const storeMembershipsRemoved = await this.storeAccess.softDeleteStoreMembershipsInTx(tx, storeId, stamp);
			const memberScopesRemoved = await this.storeAccess.deleteLocationScopesInTx(tx, locationId);
			const { terminalsRemoved, apiKeysRevoked } = await this.storeAccess.removeTerminalsAndRevokeKeysInTx(tx, organizationId, locationId, stamp);

			await this.audit.recordInTx(tx, {
				organizationId,
				actorUserId: userId,
				policyVersion: resolved.policyVersion,
				action: "organization.location.closed",
				resourceType: "OrganizationLocation",
				resourceId: locationId,
				metadata: { reason: input.reason, storeId, storeMembershipsRemoved, memberScopesRemoved, terminalsRemoved, apiKeysRevoked },
			});

			return {
				locationId,
				storeId,
				closedAt: epochMs(stamp.at),
				reason: input.reason,
				storeMembershipsRemoved,
				memberScopesRemoved,
				terminalsRemoved,
				apiKeysRevoked,
			};
		});
	}

	public async createAdminLocation(adminUserId: string, organizationId: string, input: AdminOrganizationLocationCreateInput): Promise<OrganizationLocationResponse> {
		const policyVersion = await this.cedar.getActivePolicyVersion(organizationId);
		return this.tenantTx.withSystemOperation(
			{
				operation: "organization.location.admin_create",
				reason: "RewardHub admin created organization location",
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

				await this.audit.recordInTx(tx, {
					organizationId,
					actorUserId: adminUserId,
					policyVersion,
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
		const policyVersion = await this.cedar.getActivePolicyVersion(organizationId);
		return this.tenantTx.withSystemOperation(
			{
				operation: "organization.location.admin_review",
				reason: "RewardHub admin reviewed organization location",
				actorUserId: adminUserId,
			},
			async (tx) => {
				const location = await this.locationRepository.reviewPendingLocationInTx(tx, organizationId, locationId, {
					approve: input.approve,
					rejectionReason: input.approve ? null : (input.rejectionReason?.trim() ?? null),
					reviewedByUserId: adminUserId,
				});
				if (location === null) {
					throw await this.locationStateConflict(tx, organizationId, locationId, "Only pending store requests can be reviewed");
				}

				await this.audit.recordInTx(tx, {
					organizationId,
					actorUserId: adminUserId,
					policyVersion,
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
				actorUserId: null,
			},
			async (tx) => this.locationRepository.listAdminRequestsInTx(tx, query),
		);
		return toPaginatedServiceResult(
			mapListResult(result, (row) => this.mapAdminLocationRequest(row)),
			query,
		);
	}

	/** Active tenant policy version recorded on the onboarding location audit rows (read before the onboarding transaction opens). */
	public async onboardingPolicyVersion(organizationId: string): Promise<number> {
		return this.cedar.getActivePolicyVersion(organizationId);
	}

	/**
	 * Creates the primary store from the merchant's submitted address and
	 * requests the additional ones — inside the caller's merchant-onboarding
	 * transaction, so onboarding commits or rolls back as one unit.
	 */
	public async finalizeOnboardingLocationsInTx(
		tx: LocationWriteTransaction,
		input: {
			readonly organizationId: string;
			readonly userId: string;
			readonly policyVersion: number;
			readonly city: PilotCity;
			readonly primary: { readonly name: string; readonly addressText: string; readonly contactPhone: string };
			readonly additionalLocations: readonly OrganizationLocationDraft[];
		},
	): Promise<void> {
		const { organizationId, userId, policyVersion, city, primary, additionalLocations } = input;
		// The primary store is created HERE, from the merchant's submitted
		// address — provisioning never creates an address-less primary.
		const primaryLocation = await this.locationRepository.upsertPrimaryFromOnboardingInTx(tx, organizationId, {
			name: primary.name,
			addressText: primary.addressText,
			city,
			contactPhone: primary.contactPhone,
			reviewedByUserId: userId,
		});
		await this.audit.recordInTx(tx, {
			organizationId,
			actorUserId: userId,
			policyVersion,
			action: "organization.location.primary_finalized",
			resourceType: "OrganizationLocation",
			resourceId: primaryLocation.id,
		});

		for (const draft of additionalLocations) {
			const requested = await this.locationRepository.create(tx, {
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
			await this.audit.recordInTx(tx, {
				organizationId,
				actorUserId: userId,
				policyVersion,
				action: "organization.location.requested",
				resourceType: "OrganizationLocation",
				resourceId: requested.id,
			});
		}
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

	/** Why a close compare-and-set matched nothing: gone/already closed (404), the primary store (409), or a lost race (409). */
	private async closeRefusal(tx: LocationReadTransaction, organizationId: string, locationId: string): Promise<NotFoundError | ConflictError> {
		const current = await this.locationRepository.findByIdInTx(tx, organizationId, locationId);
		if (current === null) {
			return new NotFoundError();
		}
		return current.isPrimary
			? new ConflictError({ code: LOCATION_PRIMARY_CLOSE_REFUSED_CODE, message: "The primary store cannot be closed" })
			: new ConflictError({ code: LOCATION_STATUS_CONFLICT_CODE, message: "This store was changed by another request — reload and try again" });
	}

	/**
	 * A compare-and-set lost: 404 when the location is not a live location of
	 * the organization, otherwise 409 (its status is no longer the one the
	 * transition requires — a concurrent request changed it first).
	 */
	private async locationStateConflict(tx: LocationReadTransaction, organizationId: string, locationId: string, message: string): Promise<NotFoundError | ConflictError> {
		const current = await this.locationRepository.findByIdInTx(tx, organizationId, locationId);
		return current === null ? new NotFoundError() : new ConflictError({ code: LOCATION_STATUS_CONFLICT_CODE, message });
	}

	/** Requesting and resubmitting stores need `merchant:manage_locations` (role table → tenant Cedar policy). */
	private async requireManageLocations(userId: string, role: OrganizationMembershipRole, organizationId: string): Promise<void> {
		await this.organizationRewardAuth.requireMembershipCapability({ userId, organizationId, role }, MERCHANT_CAPABILITY.manageLocations);
	}
}
