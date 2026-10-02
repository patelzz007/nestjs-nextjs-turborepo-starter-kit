import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CapabilitySlug, OrganizationMembershipRole, OrganizationRewardMembershipResponse } from "@workspace/shared";
import { epochMs, merchantRoleHasCapability, MerchantCapabilitySchema } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { MERCHANT_CAPABILITY_CEDAR_ACTIONS } from "../constants/merchant-capability-cedar-actions";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationContextService } from "./organization-context.service";

export interface ResolvedOrganizationRewardContext {
	readonly organizationId: string;
	readonly slug: string;
	readonly userId: string;
	readonly membership: OrganizationRewardMembershipResponse;
	readonly policyVersion: number;
}

/** The member a merchant capability is checked for — always resolved server-side, never from the request. */
export interface OrganizationCapabilitySubject {
	readonly userId: string;
	readonly organizationId: string;
	readonly role: OrganizationMembershipRole;
}

/** Tenant Cedar action guarding `capability`; throws for slugs no API action is guarded by (fail closed). */
function resolveCedarAction(capability: CapabilitySlug): string {
	const parsed = MerchantCapabilitySchema.safeParse(capability);
	const cedarAction = parsed.success ? MERCHANT_CAPABILITY_CEDAR_ACTIONS[parsed.data] : null;
	if (cedarAction === null) {
		throw new ForbiddenException({
			message: "Unknown reward hub capability",
			error: "ORGANIZATION_CAPABILITY_UNKNOWN",
			capability,
		});
	}
	return cedarAction;
}

/** Baseline role gate (the table shared with the merchant app); tenant Cedar policies may only narrow it. */
function requireRoleCapability(role: OrganizationMembershipRole, capability: CapabilitySlug): void {
	if (!merchantRoleHasCapability(role, capability)) {
		throw new ForbiddenException({
			message: "Your organization role does not include this capability",
			error: "ORGANIZATION_ROLE_CAPABILITY_REQUIRED",
			capability,
		});
	}
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

	/**
	 * The single merchant capability check: membership role table first (shared
	 * with the merchant app, so the UI hides exactly what the API denies), then
	 * the tenant Cedar policy for the capability's action (audited). Throws 403.
	 */
	public async requireMembershipCapability(subject: OrganizationCapabilitySubject, capability: CapabilitySlug): Promise<void> {
		const cedarAction = resolveCedarAction(capability);
		requireRoleCapability(subject.role, capability);
		await this.requireCedarAction(subject.userId, subject.organizationId, cedarAction, "RewardHub", subject.organizationId, subject.role);
	}

	/** Resolves the caller's membership for `orgSlug` (uniform 404 for non-members), then {@link requireMembershipCapability}. */
	public async requireCapabilityForSlug(userId: string, orgSlug: string, capability: CapabilitySlug): Promise<ResolvedOrganizationRewardContext> {
		const resolved = await this.resolveOrganizationFromSlug(userId, orgSlug);
		await this.requireMembershipCapability({ userId, organizationId: resolved.organizationId, role: resolved.membership.role }, capability);
		return resolved;
	}

	public async requireCedarAction(
		userId: string,
		organizationId: string,
		action: string,
		resourceType: string,
		resourceId: string,
		membershipRole: OrganizationMembershipRole,
	): Promise<void> {
		const decision = await this.cedar.evaluate({
			organizationId,
			principal: `User::"${userId}"`,
			action: `Action::"${action}"`,
			resource: `${resourceType}::"${resourceId}"`,
			membershipRole,
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
