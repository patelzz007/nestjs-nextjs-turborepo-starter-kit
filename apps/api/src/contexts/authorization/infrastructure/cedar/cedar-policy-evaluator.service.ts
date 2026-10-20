import { Inject, Injectable } from "@nestjs/common";
import { nowEpochMs, type CedarAuthorizationDecision } from "@workspace/shared";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { CedarEvaluationInput, CedarPolicyEvaluatorPort } from "../../application/ports/cedar-policy-evaluator.port";
import { POLICY_ENGINE, type PolicyBundle, type PolicyEngine, type PolicyEngineDecision } from "../../application/ports/policy-engine.port";
import type { PolicyBundleCacheTarget } from "../cache/authorization-invalidation.service";
import { composePolicyBundle } from "./policy-bundle";
import { POLICY_BUNDLE_CACHE_TTL_MS } from "./policy-control-plane.constants";

export type { CedarEvaluationInput };

interface CachedPolicyBundle {
	readonly bundle: PolicyBundle;
	readonly loadedAt: number;
}

/**
 * Evaluates Cedar decisions against each tenant's published bundle,
 * cached per process. Entries are dropped when a policy is published on any
 * instance (registered with `AuthorizationInvalidationService` by
 * `PolicyBundleCacheRegistration`) and expire after
 * {@link POLICY_BUNDLE_CACHE_TTL_MS} as a convergence backstop.
 */
@Injectable()
export class CedarPolicyEvaluatorService implements CedarPolicyEvaluatorPort, PolicyBundleCacheTarget {
	private readonly bundleCache: Map<string, CachedPolicyBundle> = new Map<string, CachedPolicyBundle>();

	public constructor(
		private readonly tenantTx: TenantTransactionService,
		@Inject(POLICY_ENGINE) private readonly engine: PolicyEngine,
	) {}

	public async getActivePolicyVersion(tenantId: string): Promise<number> {
		const bundle = await this.loadBundle(tenantId);
		return bundle.version;
	}

	public async evaluate(input: CedarEvaluationInput): Promise<CedarAuthorizationDecision> {
		const bundle = await this.loadBundle(input.tenantId);
		const result: PolicyEngineDecision = this.engine.decide(bundle, {
			tenantId: input.tenantId,
			principal: input.principal,
			action: input.action,
			...(input.locationId === undefined ? {} : { locationId: input.locationId }),
		});

		return {
			decision: result.decision,
			diagnostics: [result.diagnostic],
			policyVersion: bundle.version,
			evaluatedAt: nowEpochMs(),
		};
	}

	/** Drops one tenant's cached bundle (after a TENANT-scope publish). */
	public invalidateTenant(tenantId: string): void {
		this.bundleCache.delete(tenantId);
	}

	/** Drops every cached bundle: a platform guardrail is part of every tenant's bundle. */
	public invalidateAll(): void {
		this.bundleCache.clear();
	}

	private async loadBundle(tenantId: string): Promise<PolicyBundle> {
		const cached: CachedPolicyBundle | undefined = this.bundleCache.get(tenantId);
		if (cached !== undefined && nowEpochMs() - cached.loadedAt < POLICY_BUNDLE_CACHE_TTL_MS) {
			return cached.bundle;
		}

		const versions = await this.tenantTx.withSystemOperation(
			{
				operation: "policy.bundle.load",
				reason: "Load policy bundle",
				actorUserId: null,
			},
			async (tx) => {
				return tx.authorizationPolicyVersion.findMany({
					where: {
						OR: [{ tenantId }, { tenantId: null, scope: "PLATFORM_GUARDRAIL" }],
						supersededAt: null,
					},
					orderBy: { version: "desc" },
				});
			},
		);

		// Same membership rule as `isVersionInTenantBundle` (the simulation uses that predicate).
		const bundle = composePolicyBundle(versions);
		this.bundleCache.set(tenantId, { bundle, loadedAt: nowEpochMs() });
		return bundle;
	}
}
