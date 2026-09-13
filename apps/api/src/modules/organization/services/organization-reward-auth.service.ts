import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { epochMs } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationContextService } from "./organization-context.service";

export interface ResolvedOrganizationRewardContext {
	readonly organizationId: string;
	readonly slug: string;
	readonly userId: string;
	readonly membership: OrganizationRewardMembershipResponse;
	readonly policyVersion: number;
}

@Injectable()
export class OrganizationRewardAuthService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly organizationContext: OrganizationContextService,
		private readonly cedar: CedarPolicyEvaluatorService,
		private readonly audit: OrganizationAuditService,
	) {}

	public async resolveOrganizationFromSlug(userId: string, orgSlug: string): Promise<ResolvedOrganizationRewardContext> {
		const resolved = await this.organizationContext.resolveBySlug(userId, orgSlug);
		const org = await this.tenantTx.withSystemOperation(
			{
				operation: "auth.pre_login",
				reason: "Resolve organization reward hub context",
				correlationId: `reward-org:${orgSlug}`,
				actorUserId: userId,
			},
			async (tx) =>
				tx.organization.findUnique({
					where: { id: resolved.organizationId },
					include: { merchantProfile: true },
				}),
		);

		if (org === null) {
			throw new NotFoundException({ message: "Organization not found", error: "ORGANIZATION_NOT_FOUND" });
		}

		const membership: OrganizationRewardMembershipResponse = {
			organizationId: resolved.organizationId,
			organizationSlug: resolved.slug,
			displayName: org.displayName,
			role: resolved.membership.role,
			kybStatus: org.merchantProfile?.kybStatus ?? "PENDING",
			lifecycleState: org.lifecycleState,
		};

		return {
			organizationId: resolved.organizationId,
			slug: resolved.slug,
			userId,
			membership,
			policyVersion: resolved.policyVersion,
		};
	}

	public async requireCedarAction(
		userId: string,
		organizationId: string,
		action: string,
		resourceType: string,
		resourceId: string,
		membership: OrganizationRewardMembershipResponse,
	): Promise<void> {
		const decision = await this.cedar.evaluate({
			organizationId,
			principal: `User::"${userId}"`,
			action: `Action::"${action}"`,
			resource: `${resourceType}::"${resourceId}"`,
			membershipRole: membership.role,
			locationScopeType: "ALL_LOCATIONS",
			locationIds: [],
		});

		await this.audit.record({
			organizationId,
			actorUserId: userId,
			action: `authorize.${action}`,
			resourceType,
			resourceId,
			decision: decision.decision,
			policyVersion: decision.policyVersion,
		});

		if (decision.decision !== "Allow") {
			throw new ForbiddenException({
				message: "Insufficient organization permissions",
				error: "ORGANIZATION_ACTION_FORBIDDEN",
				action,
			});
		}
	}

	public async listMembershipsForUser(userId: string): Promise<OrganizationRewardMembershipResponse[]> {
		const rows = await this.tenantTx.withSystemOperation(
			{
				operation: "auth.pre_login",
				reason: "List organization reward hub memberships",
				correlationId: `reward-memberships:${userId}`,
				actorUserId: userId,
			},
			async (tx) =>
				tx.organizationMembership.findMany({
					where: { userId, status: "ACTIVE", isDeleted: false },
					include: {
						organization: {
							include: { merchantProfile: true },
						},
					},
					orderBy: { createdAt: "asc" },
				}),
		);

		return rows
			.filter((row) => !row.organization.isDeleted)
			.map((row) => ({
				organizationId: row.organizationId,
				organizationSlug: row.organization.slug,
				displayName: row.organization.displayName,
				role: row.role,
				kybStatus: row.organization.merchantProfile?.kybStatus ?? "PENDING",
				lifecycleState: row.organization.lifecycleState,
				createdAt: epochMs(Number(row.createdAt)),
			}));
	}
}
