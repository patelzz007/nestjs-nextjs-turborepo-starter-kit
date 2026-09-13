import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { epochMs, UuidParamSchema, type OrganizationContextResponse, type OrganizationMembershipResponse } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "./organization-audit.service";

interface ResolvedOrganizationContext {
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
				operation: "auth.pre_login",
				reason: "Resolve organization route key",
				correlationId: `org-id:${routeKey}`,
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

	/** Resolve slug or organization id → organization; uniform not-found for missing/unauthorized. */
	public async resolveBySlug(userId: string, routeKey: string): Promise<ResolvedOrganizationContext> {
		try {
			const row = await this.tenantTx.withSystemOperation(
				{
					operation: "auth.pre_login",
					reason: "Resolve organization route key for URL context",
					correlationId: `org-route:${routeKey}`,
					actorUserId: userId,
				},
				async (tx) => {
					const org = await tx.organization.findFirst({
						where: this.buildActiveOrganizationWhere(routeKey),
						include: {
							memberships: {
								where: { userId, status: "ACTIVE", isDeleted: false },
								include: { locationScopes: true },
							},
						},
					});
					return org;
				},
			);

			if (row === null || row.memberships.length === 0) {
				throw new NotFoundException();
			}

			const membership = row.memberships[0];
			const locationScopeType = membership.locationScopes.length === 0 ? "ALL_LOCATIONS" : membership.locationScopes[0].scopeType;
			const locationIds = membership.locationScopes.flatMap((s) => (s.locationId === null ? [] : [s.locationId]));

			const policyVersion = await this.cedar.getActivePolicyVersion(row.id);

			const membershipResponse: OrganizationMembershipResponse = {
				id: membership.id,
				organizationId: membership.organizationId,
				userId: membership.userId,
				role: membership.role,
				status: membership.status,
				displayName: membership.displayName,
				locationScopeType,
				locationIds,
				createdAt: epochMs(Number(membership.createdAt)),
				updatedAt: epochMs(Number(membership.updatedAt)),
			};

			return {
				organizationId: row.id,
				slug: row.slug,
				userId,
				membership: membershipResponse,
				policyVersion,
			};
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new NotFoundException();
		}
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
						primaryLocationId: primary.id,
						createdAt: epochMs(Number(org.createdAt)),
						updatedAt: epochMs(Number(org.updatedAt)),
					},
					membership: resolved.membership,
					locations: org.locations.map((l) => ({
						id: l.id,
						organizationId: l.organizationId,
						name: l.name,
						code: l.code,
						isPrimary: l.isPrimary,
						createdAt: epochMs(Number(l.createdAt)),
						updatedAt: epochMs(Number(l.updatedAt)),
					})),
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

	public async assertActionAllowed(resolved: ResolvedOrganizationContext, action: string, resourceType: string, resourceId: string): Promise<void> {
		const decision = await this.cedar.evaluate({
			organizationId: resolved.organizationId,
			principal: `User::"${resolved.userId}"`,
			action: `Action::"${action}"`,
			resource: `${resourceType}::"${resourceId}"`,
			membershipRole: resolved.membership.role,
			locationScopeType: resolved.membership.locationScopeType,
			locationIds: resolved.membership.locationIds,
		});

		await this.audit.record({
			organizationId: resolved.organizationId,
			actorUserId: resolved.userId,
			action: `authorize.${action}`,
			resourceType,
			resourceId,
			decision: decision.decision,
			policyVersion: decision.policyVersion,
		});

		if (decision.decision !== "Allow") {
			throw new NotFoundException();
		}
	}
}
