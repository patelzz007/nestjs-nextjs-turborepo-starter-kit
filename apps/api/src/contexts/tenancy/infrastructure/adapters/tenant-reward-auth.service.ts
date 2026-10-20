import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CapabilitySlug, CedarAuthorizationDecision, MembershipRole, TenantRewardMembershipResponse } from "@workspace/shared";
import { merchantRoleHasCapability, MerchantCapabilitySchema } from "@workspace/shared";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { CEDAR_POLICY_EVALUATOR, type CedarPolicyEvaluatorPort } from "../../../authorization/public-api";
import { MERCHANT_CAPABILITY_CEDAR_ACTIONS } from "../../domain/policies/merchant-capability.policy";
import { mapMembershipLocationScope } from "../persistence/tenant-membership.mapper";
import { TenantAuditService } from "../audit/tenant-audit.adapter";
import { TenantContextService } from "./tenant-context.service";

export interface ResolvedTenantRewardContext {
	readonly tenantId: string;
	readonly slug: string;
	readonly userId: string;
	readonly membership: TenantRewardMembershipResponse;
	readonly policyVersion: number;
}

/** The member a merchant capability is checked for — always resolved server-side, never from the request. */
export interface TenantCapabilitySubject {
	readonly userId: string;
	readonly tenantId: string;
	readonly role: MembershipRole;
}

/** Tenant Cedar action guarding `capability`; throws for slugs no API action is guarded by (fail closed). */
function resolveCedarAction(capability: CapabilitySlug): string {
	const parsed = MerchantCapabilitySchema.safeParse(capability);
	const cedarAction = parsed.success ? MERCHANT_CAPABILITY_CEDAR_ACTIONS[parsed.data] : null;
	if (cedarAction === null) {
		throw new ForbiddenException({
			message: "Unknown merchant capability",
			error: "TENANT_CAPABILITY_UNKNOWN",
			capability,
		});
	}
	return cedarAction;
}

/** Baseline role gate (the table shared with the merchant app); tenant Cedar policies may only narrow it. */
function requireRoleCapability(role: MembershipRole, capability: CapabilitySlug): void {
	if (!merchantRoleHasCapability(role, capability)) {
		throw new ForbiddenException({
			message: "Your tenant role does not include this capability",
			error: "TENANT_ROLE_CAPABILITY_REQUIRED",
			capability,
		});
	}
}

/** The membership's location scope in the shape the Cedar principal carries. */
function cedarLocationScope(scope: ReturnType<typeof mapMembershipLocationScope>): { readonly locationScope: string; readonly locationIds: readonly string[] } {
	return { locationScope: scope.locationScopeType, locationIds: scope.locationIds };
}

@Injectable()
export class TenantRewardAuthService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly tenantContext: TenantContextService,
		@Inject(CEDAR_POLICY_EVALUATOR) private readonly cedar: CedarPolicyEvaluatorPort,
		private readonly audit: TenantAuditService,
	) {}

	public async resolveTenantFromSlug(userId: string, tenantSlug: string): Promise<ResolvedTenantRewardContext> {
		const resolved = await this.tenantContext.resolveBySlug(userId, tenantSlug);
		const org = await this.tenantTx.withSystemOperation(
			{
				operation: "tenant.context.resolve_membership",
				reason: "Resolve the caller's tenant membership context",
				actorUserId: userId,
			},
			async (tx) =>
				tx.tenant.findUnique({
					where: { id: resolved.tenantId },
					include: { merchantProfile: true },
				}),
		);

		if (org === null) {
			throw new NotFoundException({ message: "Tenant not found", error: "TENANT_NOT_FOUND" });
		}

		const membership: TenantRewardMembershipResponse = {
			tenantId: resolved.tenantId,
			tenantSlug: resolved.slug,
			displayName: org.displayName,
			role: resolved.membership.role,
			kybStatus: org.merchantProfile?.kybStatus ?? "PENDING",
			lifecycleState: org.lifecycleState,
		};

		return {
			tenantId: resolved.tenantId,
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
	public async requireMembershipCapability(subject: TenantCapabilitySubject, capability: CapabilitySlug): Promise<void> {
		const cedarAction = resolveCedarAction(capability);
		requireRoleCapability(subject.role, capability);
		await this.requireCedarAction(subject.userId, subject.tenantId, cedarAction, "Tenant", subject.tenantId, subject.role);
	}

	/** Resolves the caller's membership for `tenantSlug` (uniform 404 for non-members), then {@link requireMembershipCapability}. */
	public async requireCapabilityForSlug(userId: string, tenantSlug: string, capability: CapabilitySlug): Promise<ResolvedTenantRewardContext> {
		const resolved = await this.resolveTenantFromSlug(userId, tenantSlug);
		await this.requireMembershipCapability({ userId, tenantId: resolved.tenantId, role: resolved.membership.role }, capability);
		return resolved;
	}

	public async requireCedarAction(userId: string, tenantId: string, action: string, resourceType: string, resourceId: string, membershipRole: MembershipRole): Promise<void> {
		const policyVersion = await this.cedar.getActivePolicyVersion(tenantId);
		const decision = await this.tenantTx.withTenantTransaction(
			{ userId, tenantId, purpose: `authorize.${action}`, policyVersion },
			async (tx): Promise<CedarAuthorizationDecision["decision"]> => {
				// The member's REAL location scope (read in the same tenant session
				// the decision is audited in) — never a hard-coded ALL_LOCATIONS.
				// No live membership → no stores and an explicit Deny.
				const membership = await tx.membership.findFirst({
					where: { tenantId, userId, status: "ACTIVE", isDeleted: false },
					include: { locationScopes: { where: { isDeleted: false } } },
				});
				const evaluated: CedarAuthorizationDecision | null =
					membership === null
						? null
						: await this.cedar.evaluate({
								tenantId,
								principal: { userId, role: membershipRole, ...cedarLocationScope(mapMembershipLocationScope(membership)) },
								action,
							});
				const outcome: CedarAuthorizationDecision["decision"] = evaluated?.decision ?? "Deny";

				await this.audit.recordInTx(tx, {
					tenantId,
					actorUserId: userId,
					action: `authorize.${action}`,
					resourceType,
					resourceId,
					decision: outcome,
					policyVersion: evaluated?.policyVersion ?? policyVersion,
				});
				return outcome;
			},
		);

		if (decision !== "Allow") {
			throw new ForbiddenException({
				message: "Insufficient tenant permissions",
				error: "TENANT_ACTION_FORBIDDEN",
				action,
			});
		}
	}
}
