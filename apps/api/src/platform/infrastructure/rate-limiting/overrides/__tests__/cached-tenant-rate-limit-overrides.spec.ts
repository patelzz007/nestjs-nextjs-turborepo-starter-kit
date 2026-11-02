import {
	epochMs,
	type EpochMs,
	type RateLimitAllowance,
	type SetTenantRateLimitOverrideInput,
	type TenantRateLimitOverride,
	type TenantRateLimitPolicyName,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { localAppCache } from "../../../../../../test/support/local-app-cache";
import type { Clock } from "../../../../application/clock.port";
import { CachedTenantRateLimitOverrides, type TenantRateLimitOverrideSource } from "../cached-tenant-rate-limit-overrides";

const TENANT = "0193f2c4-0000-7000-8000-0000000000d1";
const STAFF = "0193f2c4-0000-7000-8000-0000000000d2";
const NOW = 1_800_000_000_000;
const DAY_MS = 86_400_000;

/** The store with the Prisma store's semantics: one live override per tenant and policy, expiry checked by the reader. */
class InMemoryOverrideSource implements TenantRateLimitOverrideSource {
	public readonly rows: TenantRateLimitOverride[] = [];
	public loads = 0;

	public liveForTenant(tenantId: string): Promise<ReadonlyMap<TenantRateLimitPolicyName, RateLimitAllowance & { readonly expiresAt: number }>> {
		this.loads += 1;
		return Promise.resolve(
			new Map(
				this.rows
					.filter((row) => row.tenantId === tenantId && !row.isDeleted)
					.map((row) => [row.policyName, { limit: row.limit, windowMs: row.windowMs, expiresAt: row.expiresAt }]),
			),
		);
	}

	public list(): Promise<readonly TenantRateLimitOverride[]> {
		return Promise.resolve(this.rows.filter((row) => !row.isDeleted));
	}

	public set(input: SetTenantRateLimitOverrideInput, setByUserId: string): Promise<TenantRateLimitOverride> {
		const row: TenantRateLimitOverride = {
			id: `override-${String(this.rows.length + 1)}`,
			tenantId: input.tenantId,
			tenantName: "Sunrise Cafe",
			policyName: input.policyName,
			limit: input.policyName === "TENANT_BROADCASTS" ? input.perWeek : input.burst,
			windowMs: input.policyName === "TENANT_BROADCASTS" ? 7 * DAY_MS : 4_000,
			reason: input.reason,
			expiresAt: input.expiresAt,
			setByUserId,
			createdAt: epochMs(NOW),
			updatedAt: epochMs(NOW),
			isDeleted: false,
			deletedAt: null,
		};
		this.rows.push(row);
		return Promise.resolve(row);
	}

	public remove(overrideId: string): Promise<string | null> {
		const index = this.rows.findIndex((row) => row.id === overrideId && !row.isDeleted);
		const row = this.rows.at(index);
		if (index === -1 || row === undefined) {
			return Promise.resolve(null);
		}
		this.rows.splice(index, 1, { ...row, isDeleted: true });
		return Promise.resolve(row.tenantId);
	}
}

/** A clock the test moves forward. */
class SettableClock implements Clock {
	public at: number = NOW;

	public now(): EpochMs {
		return epochMs(this.at);
	}
}

function setup(): { readonly source: InMemoryOverrideSource; readonly overrides: CachedTenantRateLimitOverrides; readonly clock: SettableClock } {
	const clock = new SettableClock();
	const source = new InMemoryOverrideSource();
	return {
		source,
		clock,
		overrides: new CachedTenantRateLimitOverrides(
			source,
			clock,
			localAppCache(() => clock.at),
		),
	};
}

const BLACK_FRIDAY: SetTenantRateLimitOverrideInput = {
	tenantId: TENANT,
	policyName: "TENANT_TRAFFIC",
	ratePerSecond: 100,
	burst: 400,
	reason: "Black Friday campaign traffic",
	expiresAt: epochMs(NOW + DAY_MS),
};

describe("CachedTenantRateLimitOverrides", () => {
	it("answers the default (null) without an override, and caches the tenant's overrides", async () => {
		const { source, overrides } = setup();

		expect(await overrides.allowanceFor(TENANT, "TENANT_TRAFFIC")).toBeNull();
		expect(await overrides.allowanceFor(TENANT, "API_KEY_TRAFFIC")).toBeNull();
		expect(source.loads).toBe(1);
	});

	it("applies a new override at once, because setting it drops the cached answer", async () => {
		const { overrides } = setup();
		await overrides.allowanceFor(TENANT, "TENANT_TRAFFIC");

		await overrides.set(BLACK_FRIDAY, STAFF);

		expect(await overrides.allowanceFor(TENANT, "TENANT_TRAFFIC")).toEqual({ limit: 400, windowMs: 4_000 });
	});

	it("stops applying an override the moment it expires, even while cached", async () => {
		const { overrides, clock } = setup();
		await overrides.set(BLACK_FRIDAY, STAFF);
		expect(await overrides.allowanceFor(TENANT, "TENANT_TRAFFIC")).not.toBeNull();

		clock.at = NOW + DAY_MS;

		expect(await overrides.allowanceFor(TENANT, "TENANT_TRAFFIC")).toBeNull();
	});

	it("goes back to the default when an override is removed, and says when there was none", async () => {
		const { overrides } = setup();
		const saved = await overrides.set(BLACK_FRIDAY, STAFF);
		await overrides.allowanceFor(TENANT, "TENANT_TRAFFIC");

		expect(await overrides.remove(saved.id, STAFF)).toBe(true);
		expect(await overrides.allowanceFor(TENANT, "TENANT_TRAFFIC")).toBeNull();
		expect(await overrides.remove(saved.id, STAFF)).toBe(false);
	});
});
