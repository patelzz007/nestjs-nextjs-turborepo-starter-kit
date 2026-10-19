import type { Prisma } from "@prisma/client";

import type { CedarPolicyEvaluatorPort } from "../../../authorization/public-api";
import type { TenantPolicyDecision, TenantPolicyPort, TenantPolicyPrincipal, TenantPolicyProvisioningPort } from "../../application/ports/tenant-policy.port";
import { findActivePolicyVersionInTx, seedDefaultTenantPolicies } from "../../../authorization/public-api";

/** Tenant Cedar decisions and policy versions, over authorization's `CEDAR_POLICY_EVALUATOR` port. */
export class CedarTenantPolicyAdapter implements TenantPolicyPort {
	public constructor(private readonly cedar: CedarPolicyEvaluatorPort) {}

	public async activePolicyVersion(organizationId: string): Promise<number> {
		return this.cedar.getActivePolicyVersion(organizationId);
	}

	public async evaluate(organizationId: string, principal: TenantPolicyPrincipal, action: string): Promise<TenantPolicyDecision> {
		const decision = await this.cedar.evaluate({
			organizationId,
			principal: { userId: principal.userId, role: principal.role, locationScope: principal.locationScope, locationIds: principal.locationIds },
			action,
		});
		return { allowed: decision.decision === "Allow", policyVersion: decision.policyVersion };
	}
}

/** Authorization's default tenant policy, written on the unit-of-work transaction (a new organization's policies are not committed yet). */
export class TransactionTenantPolicyProvisioning implements TenantPolicyProvisioningPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async seedDefaultPolicies(organizationId: string, actorUserId: string): Promise<void> {
		await seedDefaultTenantPolicies(this.db, organizationId, actorUserId);
	}

	public async activePolicyVersion(organizationId: string): Promise<number> {
		return findActivePolicyVersionInTx(this.db, organizationId);
	}
}
