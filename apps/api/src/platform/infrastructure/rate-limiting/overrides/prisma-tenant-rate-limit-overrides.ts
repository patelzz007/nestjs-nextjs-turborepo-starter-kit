// ============================================
// platform/infrastructure/rate-limiting/overrides/prisma-tenant-rate-limit-overrides.ts — the stored overrides (ADR 071)
// ============================================
// Platform staff only (RLS bypass-only table): every read and write runs under `rate_limits.overrides`.
// One live override per tenant and policy (a partial unique index): setting one again replaces it.

import type { Prisma, TenantRateLimitOverride as TenantRateLimitOverrideRow } from "@prisma/client";
import {
	epochMs,
	overrideAllowance,
	TenantRateLimitPolicyNameSchema,
	type RateLimitAllowance,
	type SetTenantRateLimitOverrideInput,
	type TenantRateLimitOverride,
	type TenantRateLimitPolicyName,
} from "@workspace/shared";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { Clock } from "../../../application/clock.port";
import { NotFoundError } from "../../../application/errors/app-error";
import { RATE_LIMIT_OVERRIDES_OPERATION } from "../../../application/shared-system-operations";
import type { TenantRateLimitOverrideSource } from "./cached-tenant-rate-limit-overrides";

type OverrideRow = TenantRateLimitOverrideRow;

/** Shown when a tenant row is gone (soft-deleted tenants keep their overrides until they expire). */
const UNKNOWN_TENANT_NAME = "Unknown tenant";

async function tenantNames(tx: Prisma.TransactionClient, tenantIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
	const tenants = await tx.tenant.findMany({ where: { id: { in: [...new Set(tenantIds)] } }, select: { id: true, displayName: true } });
	return new Map(tenants.map((tenant) => [tenant.id, tenant.displayName]));
}

function toOverride(row: OverrideRow, names: ReadonlyMap<string, string>): TenantRateLimitOverride {
	return {
		id: row.id,
		tenantId: row.tenantId,
		tenantName: names.get(row.tenantId) ?? UNKNOWN_TENANT_NAME,
		policyName: TenantRateLimitPolicyNameSchema.parse(row.policyName),
		limit: row.limit,
		windowMs: Number(row.windowMs),
		reason: row.reason,
		expiresAt: epochMs(Number(row.expiresAt)),
		setByUserId: row.setByUserId,
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
		isDeleted: row.isDeleted,
		deletedAt: row.deletedAt === null ? null : epochMs(Number(row.deletedAt)),
	};
}

/** The uncached store; `CachedTenantRateLimitOverrides` puts the cache in front of `allowanceFor`. */
export class PrismaTenantRateLimitOverrides implements TenantRateLimitOverrideSource {
	public constructor(
		private readonly transactions: TenantTransactionService,
		private readonly clock: Clock,
	) {}

	/** Every live override of one tenant (what the cache holds). */
	public async liveForTenant(tenantId: string): Promise<ReadonlyMap<TenantRateLimitPolicyName, RateLimitAllowance & { readonly expiresAt: number }>> {
		const now = this.clock.now();
		const rows = await this.transactions.withSystemOperation(
			{ operation: RATE_LIMIT_OVERRIDES_OPERATION, reason: "Apply a tenant's rate-limit overrides", actorUserId: null },
			(tx) => tx.tenantRateLimitOverride.findMany({ where: { tenantId, isDeleted: false, expiresAt: { gt: BigInt(now) } } }),
		);
		return new Map(
			rows.map((row) => [TenantRateLimitPolicyNameSchema.parse(row.policyName), { limit: row.limit, windowMs: Number(row.windowMs), expiresAt: Number(row.expiresAt) }]),
		);
	}

	public async list(actorUserId: string): Promise<readonly TenantRateLimitOverride[]> {
		const now = this.clock.now();
		return this.transactions.withSystemOperation({ operation: RATE_LIMIT_OVERRIDES_OPERATION, reason: "List tenant rate-limit overrides", actorUserId }, async (tx) => {
			const rows = await tx.tenantRateLimitOverride.findMany({ where: { isDeleted: false, expiresAt: { gt: BigInt(now) } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }] });
			const names = await tenantNames(
				tx,
				rows.map((row) => row.tenantId),
			);
			return rows.map((row) => toOverride(row, names));
		});
	}

	public async set(input: SetTenantRateLimitOverrideInput, setByUserId: string): Promise<TenantRateLimitOverride> {
		const now = BigInt(this.clock.now());
		const allowance = overrideAllowance(input);
		return this.transactions.withSystemOperation({ operation: RATE_LIMIT_OVERRIDES_OPERATION, reason: input.reason, actorUserId: setByUserId }, async (tx) => {
			const tenant = await tx.tenant.findFirst({ where: { id: input.tenantId, isDeleted: false }, select: { id: true, displayName: true } });
			if (tenant === null) {
				throw new NotFoundError({ message: "Tenant not found" });
			}
			// Replacing: the previous override ends now (soft delete), so its history stays in the change trail.
			await tx.tenantRateLimitOverride.updateMany({
				where: { tenantId: input.tenantId, policyName: input.policyName, isDeleted: false },
				data: { isDeleted: true, deletedAt: now, deletedBy: setByUserId, updatedAt: now, updatedBy: setByUserId },
			});
			const row = await tx.tenantRateLimitOverride.create({
				data: {
					tenantId: input.tenantId,
					policyName: input.policyName,
					limit: allowance.limit,
					windowMs: BigInt(allowance.windowMs),
					reason: input.reason,
					expiresAt: BigInt(input.expiresAt),
					setByUserId,
					createdBy: setByUserId,
					updatedBy: setByUserId,
				},
			});
			return toOverride(row, new Map([[tenant.id, tenant.displayName]]));
		});
	}

	/** Ends an override now; returns its tenant (to drop the cache) or null when there was none. */
	public async remove(overrideId: string, removedByUserId: string): Promise<string | null> {
		const now = BigInt(this.clock.now());
		return this.transactions.withSystemOperation(
			{ operation: RATE_LIMIT_OVERRIDES_OPERATION, reason: "End a tenant rate-limit override", actorUserId: removedByUserId },
			async (tx) => {
				const existing = await tx.tenantRateLimitOverride.findFirst({ where: { id: overrideId, isDeleted: false }, select: { tenantId: true } });
				if (existing === null) {
					return null;
				}
				await tx.tenantRateLimitOverride.updateMany({
					where: { id: overrideId, isDeleted: false },
					data: { isDeleted: true, deletedAt: now, deletedBy: removedByUserId, updatedAt: now, updatedBy: removedByUserId },
				});
				return existing.tenantId;
			},
		);
	}
}
