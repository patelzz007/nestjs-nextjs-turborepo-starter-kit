// ============================================
// platform/infrastructure/rate-limiting/overrides/cached-tenant-rate-limit-overrides.ts — overrides, cached (ADR 071, 072)
// ============================================
// The tenant traffic guard asks on every tenant request, so a tenant's live overrides are cached on every
// instance and in Redis, and dropped everywhere after a change commits. Expiry is checked at read time, so
// an override stops applying the moment it expires even while its entry is still cached.

import {
	TenantRateLimitPolicyNameSchema,
	type RateLimitAllowance,
	type SetTenantRateLimitOverrideInput,
	type TenantRateLimitOverride,
	type TenantRateLimitPolicyName,
} from "@workspace/shared";
import { z } from "zod";

import { defineCache, PLATFORM_SCOPE, type AppCache, type CacheDefinition } from "../../../application/ports/app-cache.port";
import type { Clock } from "../../../application/clock.port";
import type { TenantRateLimitOverridesPort } from "../../../application/ports/tenant-rate-limit-overrides.port";

/** Where overrides are stored (`PrismaTenantRateLimitOverrides`). */
export interface TenantRateLimitOverrideSource {
	liveForTenant(tenantId: string): Promise<ReadonlyMap<TenantRateLimitPolicyName, RateLimitAllowance & { readonly expiresAt: number }>>;
	list(actorUserId: string): Promise<readonly TenantRateLimitOverride[]>;
	set(input: SetTenantRateLimitOverrideInput, setByUserId: string): Promise<TenantRateLimitOverride>;
	/** Returns the override's tenant (to drop its cache entry), or null when there was none. */
	remove(overrideId: string, removedByUserId: string): Promise<string | null>;
}

/** A safety net only: every change drops the entry at once. */
export const TENANT_OVERRIDES_TTL_MS = 60_000;
const TENANT_OVERRIDES_ENTRIES = 10_000;
const NO_STALE_MS = 0;

const CachedAllowanceSchema = z.object({
	policyName: TenantRateLimitPolicyNameSchema,
	limit: z.number().int().positive(),
	windowMs: z.number().int().positive(),
	expiresAt: z.number().int(),
});
type CachedAllowance = z.output<typeof CachedAllowanceSchema>;
const CachedAllowancesSchema = z.array(CachedAllowanceSchema);

export class CachedTenantRateLimitOverrides implements TenantRateLimitOverridesPort {
	public readonly overrides: CacheDefinition<readonly CachedAllowance[], "platform"> = defineCache<readonly CachedAllowance[], "platform">({
		name: "rate-limits.tenant-overrides",
		version: 1,
		schema: CachedAllowancesSchema,
		scope: "platform",
		tier: "two-tier",
		ttlMs: TENANT_OVERRIDES_TTL_MS,
		staleMs: NO_STALE_MS,
		containsPersonalData: false,
		localMaxEntries: TENANT_OVERRIDES_ENTRIES,
		sharedMaxKeys: TENANT_OVERRIDES_ENTRIES,
	});

	public constructor(
		private readonly store: TenantRateLimitOverrideSource,
		private readonly clock: Clock,
		private readonly cache: AppCache,
	) {
		cache.register(this.overrides);
	}

	public async allowanceFor(tenantId: string, policyName: TenantRateLimitPolicyName): Promise<RateLimitAllowance | null> {
		const live = await this.cache.getOrLoad(this.overrides, PLATFORM_SCOPE, tenantId, async (): Promise<readonly CachedAllowance[]> => {
			const loaded = await this.store.liveForTenant(tenantId);
			return [...loaded.entries()].map(([name, allowance]): CachedAllowance => ({ policyName: name, ...allowance }));
		});
		const now = this.clock.now();
		const found = live.find((allowance: CachedAllowance): boolean => allowance.policyName === policyName && allowance.expiresAt > now);
		return found === undefined ? null : { limit: found.limit, windowMs: found.windowMs };
	}

	public list(actorUserId: string): Promise<readonly TenantRateLimitOverride[]> {
		return this.store.list(actorUserId);
	}

	public async set(input: SetTenantRateLimitOverrideInput, setByUserId: string): Promise<TenantRateLimitOverride> {
		const saved = await this.store.set(input, setByUserId);
		await this.cache.invalidate(this.overrides, PLATFORM_SCOPE, saved.tenantId);
		return saved;
	}

	public async remove(overrideId: string, removedByUserId: string): Promise<boolean> {
		const tenantId = await this.store.remove(overrideId, removedByUserId);
		if (tenantId === null) {
			return false;
		}
		await this.cache.invalidate(this.overrides, PLATFORM_SCOPE, tenantId);
		return true;
	}
}
