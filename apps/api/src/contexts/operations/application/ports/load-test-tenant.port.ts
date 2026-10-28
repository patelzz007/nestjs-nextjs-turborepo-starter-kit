// ============================================
// application/ports/load-test-tenant.port.ts — the Load Test tenant and its load-test users
// ============================================
// Every load test acts as load-test users inside this one tenant (ADR 068), so no real tenant's
// data is ever touched. Provisioning is idempotent; the purge is the one hard delete in the platform.

import type { LoadTestPurgeResult } from "@workspace/shared";

/** What a run needs to sign in: the tenant, and every load-test user with this run's password. */
export interface ProvisionedLoadTestTenant {
	readonly tenantId: string;
	readonly tenantSlug: string;
	readonly customerEmails: readonly string[];
	/** Each customer's verified phone, in the same order (a claim with it needs no one-time code). */
	readonly customerPhones: readonly string[];
	readonly staffEmails: readonly string[];
}

export interface LoadTestProvisioningPort {
	/**
	 * Makes sure the tenant, its store, its roles, its published rewards and `customers` customer
	 * users plus the staff exist, and gives every load-test user `passwordHash` (one fresh password per
	 * run, so a password handed to an earlier run stops working).
	 */
	provision(input: { readonly customers: number; readonly passwordHash: string }): Promise<ProvisionedLoadTestTenant>;
	/** How many load-test users exist. */
	loadTestUserCount(): Promise<number>;
}

export interface LoadTestPurgePort {
	/** Hard-deletes what load tests created inside the Load Test tenant, and nothing else. */
	purge(): Promise<LoadTestPurgeResult>;
}
