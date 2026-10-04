import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { epochMs, UuidParamSchema, type OrganizationContextResponse, type OrganizationMembershipResponse } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { mapOrganizationLocationToResponse } from "../utils/organization-location-mapper.util";
import { mapMembershipToResponse } from "../utils/organization-membership-mapper.util";
import { OrganizationAuditService } from "./organization-audit.service";

export interface ResolvedOrganizationContext {
	readonly organizationId: string;
	readonly slug: string;
	readonly userId: string;
	readonly membership: OrganizationMembershipResponse;
	readonly policyVersion: number;
}

@Injectable()
export class OrganizationContextService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly cedar: CedarPolicyEvaluatorService,
		private readonly audit: OrganizationAuditService,
	) {}

	/** Resolve slug or organization id → organization id for pre-membership flows (uniform not-found). */
	public async resolveOrganizationIdBySlug(routeKey: string): Promise<string> {
		const org = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.context.resolve_route_key",
				reason: "Resolve organization route key",
				actorUserId: null,
			},
			async (tx) =>
				tx.organization.findFirst({
					where: this.buildActiveOrganizationWhere(routeKey),
					select: { id: true },
				}),
		);
		if (org === null) {
			throw new NotFoundException();
		}
		return org.id;
	}

	/**
	 * Resolve slug or organization id → organization; uniform not-found for a
	 * missing organization AND for a non-member (no existence oracle). Any other
	 * failure (database down, policy load error) propagates as itself — it is
	 * never disguised as a 404.
	 */
	public async resolveBySlug(userId: string, routeKey: string): Promise<ResolvedOrganizationContext> {
		const row = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.context.resolve_route_key",
				reason: "Resolve organization route key for URL context",
				actorUserId: userId,
			},
			async (tx) =>
				tx.organization.findFirst({
					where: this.buildActiveOrganizationWhere(routeKey),
					include: {
						memberships: {
							where: { userId, status: "ACTIVE", isDeleted: false },
							include: { locationScopes: true },
						},
					},
				}),
		);

		const membership = row?.memberships[0];
		if (row === null || membership === undefined) {
			throw new NotFoundException();
		}

		const policyVersion = await this.cedar.getActivePolicyVersion(row.id);
		const membershipResponse: OrganizationMembershipResponse = mapMembershipToResponse(membership);

		return {
			organizationId: row.id,
			slug: row.slug,
			userId,
			membership: membershipResponse,
			policyVersion,
		};
	}

	public async getContext(userId: string, orgSlug: string): Promise<OrganizationContextResponse> {
		const resolved = await this.resolveBySlug(userId, orgSlug);

		return this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "organization.context",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => {
				const org = await tx.organization.findUnique({
					where: { id: resolved.organizationId },
					include: {
						locations: { where: { isDeleted: false } },
						merchantProfile: true,
					},
				});

				if (org === null) {
					throw new NotFoundException();
				}

				const primary = org.locations.find((l) => l.isPrimary) ?? org.locations[0];

				return {
					organization: {
						id: org.id,
						slug: org.slug,
						displayName: org.displayName,
						lifecycleState: org.lifecycleState,
						primaryLocationId: primary?.id ?? null,
						createdAt: epochMs(Number(org.createdAt)),
						updatedAt: epochMs(Number(org.updatedAt)),
					},
					membership: resolved.membership,
					locations: org.locations.map((l) => mapOrganizationLocationToResponse(l)),
					merchantProfile: org.merchantProfile
						? {
								organizationId: org.merchantProfile.organizationId,
								legalName: org.merchantProfile.legalName,
								category: org.merchantProfile.category,
								city: org.merchantProfile.city,
								kybStatus: org.merchantProfile.kybStatus,
								contactEmail: org.merchantProfile.contactEmail,
								contactPhone: org.merchantProfile.contactPhone,
							}
						: null,
					policyVersion: resolved.policyVersion,
				};
			},
		);
	}

	private buildActiveOrganizationWhere(routeKey: string): Prisma.OrganizationWhereInput {
		const slugMatches: Prisma.OrganizationWhereInput[] = [{ slug: routeKey }, { slugHistory: { some: { slug: routeKey } } }];

		if (UuidParamSchema.safeParse(routeKey).success) {
			return {
				isDeleted: false,
				lifecycleState: { notIn: ["DELETED", "PENDING_DELETION"] },
				OR: [{ id: routeKey }, ...slugMatches],
			};
		}

		return {
			isDeleted: false,
			lifecycleState: { notIn: ["DELETED", "PENDING_DELETION"] },
			OR: slugMatches,
		};
	}

	/** Ensures a location belongs to the org and is within the caller's membership scope. */
	public async assertAccessibleLocation(userId: string, orgSlug: string, locationId: string): Promise<void> {
		const resolved = await this.resolveBySlug(userId, orgSlug);

		const location = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.context.location_access",
				reason: "Validate organization location access",
				actorUserId: userId,
			},
			async (tx) =>
				tx.organizationLocation.findFirst({
					where: { id: locationId, organizationId: resolved.organizationId, isDeleted: false, status: "ACTIVE" },
					select: { id: true },
				}),
		);

		if (location === null) {
			throw new NotFoundException();
		}

		if (resolved.membership.locationScopeType === "SELECTED" && !resolved.membership.locationIds.includes(locationId)) {
			throw new ForbiddenException({
				message: "Location is outside your membership scope",
				error: "ORGANIZATION_LOCATION_FORBIDDEN",
			});
		}
	}

	public async assertActionAllowed(resolved: ResolvedOrganizationContext, action: string, resourceType: string, resourceId: string): Promise<void> {
		const decision = await this.cedar.evaluate({
			organizationId: resolved.organizationId,
			principal: {
				userId: resolved.userId,
				role: resolved.membership.role,
				locationScope: resolved.membership.locationScopeType,
				locationIds: resolved.membership.locationIds,
			},
			action,
		});

		await this.tenantTx.withTenantTransaction(
			{ userId: resolved.userId, organizationId: resolved.organizationId, purpose: `authorize.${action}`, policyVersion: decision.policyVersion },
			async (tx) =>
				this.audit.recordInTx(tx, {
					organizationId: resolved.organizationId,
					actorUserId: resolved.userId,
					action: `authorize.${action}`,
					resourceType,
					resourceId,
					decision: decision.decision,
					policyVersion: decision.policyVersion,
				}),
		);

		if (decision.decision !== "Allow") {
			throw new NotFoundException();
		}
	}
}
