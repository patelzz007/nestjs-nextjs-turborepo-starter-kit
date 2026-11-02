// ============================================
// platform/application/ports/tenant-rate-limit-overrides.port.ts — per-tenant limits (ADR 071)
// ============================================
// A tenant override replaces a tenant policy's default until it expires: there are no plans or tiers; a
// future billing ADR will drive these. Reads are cached (ADR 072) and dropped on every change, so every
// instance applies a change within seconds.

import type { RateLimitAllowance, SetTenantRateLimitOverrideInput, TenantRateLimitOverride, TenantRateLimitPolicyName } from "@workspace/shared";

export interface TenantRateLimitOverridesPort {
	/** The live (unexpired) override of one tenant policy, or null for the default. */
	allowanceFor(tenantId: string, policyName: TenantRateLimitPolicyName): Promise<RateLimitAllowance | null>;
	/** Every live override, soonest expiry first (the admin page). */
	list(actorUserId: string): Promise<readonly TenantRateLimitOverride[]>;
	/** Sets (or replaces) a tenant policy's override. Throws `NotFoundError` for an unknown tenant. */
	set(input: SetTenantRateLimitOverrideInput, setByUserId: string): Promise<TenantRateLimitOverride>;
	/** Ends an override now (soft delete); false when there was none. */
	remove(overrideId: string, removedByUserId: string): Promise<boolean>;
}

export const TENANT_RATE_LIMIT_OVERRIDES = Symbol("TENANT_RATE_LIMIT_OVERRIDES");
