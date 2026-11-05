import type { FeatureFlagSetting as FeatureFlagSettingRow, Prisma } from "@prisma/client";
import { epochMs, FeatureFlagKeySchema, type EpochMs, type FeatureFlagKey, type FeatureFlagStoreOption, type StoreFeatureFlagKey } from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import {
	FEATURE_FLAGS_READ_OPERATION,
	FEATURE_FLAGS_WRITE_OPERATION,
	type FeatureFlagChange,
	type FeatureFlagRecord,
	type FeatureFlagStore,
	type StoreOverrideChange,
	type StoreOverrideRecord,
} from "../../application/ports/feature-flag.store";

const READ_OPERATION = FEATURE_FLAGS_READ_OPERATION;
const WRITE_OPERATION = FEATURE_FLAGS_WRITE_OPERATION;

export interface FeatureFlagTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/** What a per-store setting's read joins: the row, its merchant's and branch's names. */
const OVERRIDE_SELECT = {
	id: true,
	key: true,
	tenantId: true,
	locationId: true,
	enabled: true,
	reason: true,
	updatedAt: true,
	updatedBy: true,
	tenant: { select: { displayName: true } },
	location: { select: { name: true } },
} satisfies Prisma.FeatureFlagStoreOverrideSelect;

type OverrideRow = Prisma.FeatureFlagStoreOverrideGetPayload<{ select: typeof OVERRIDE_SELECT }>;

function toOverride(row: OverrideRow, key: StoreFeatureFlagKey, names: ReadonlyMap<string, string>): StoreOverrideRecord {
	return {
		id: row.id,
		key,
		tenantId: row.tenantId,
		tenantName: row.tenant.displayName,
		locationId: row.locationId,
		locationName: row.location?.name ?? null,
		enabled: row.enabled,
		reason: row.reason,
		updatedAt: epochMs(Number(row.updatedAt)),
		updatedByName: row.updatedBy === null ? null : (names.get(row.updatedBy) ?? null),
	};
}

async function namesOf(tx: Prisma.TransactionClient, ids: readonly (string | null)[]): Promise<ReadonlyMap<string, string>> {
	const wanted = [...new Set(ids.flatMap((id) => (id === null ? [] : [id])))];
	const users = wanted.length === 0 ? [] : await tx.user.findMany({ where: { id: { in: wanted } }, select: { id: true, fullName: true } });
	return new Map(users.map((user): [string, string] => [user.id, user.fullName]));
}

function toRecord(row: FeatureFlagSettingRow, names: ReadonlyMap<string, string>): FeatureFlagRecord {
	return {
		key: FeatureFlagKeySchema.parse(row.key),
		mode: row.mode,
		percentage: row.percentage,
		reason: row.reason,
		updatedAt: epochMs(Number(row.updatedAt)),
		updatedByName: row.updatedBy === null ? null : (names.get(row.updatedBy) ?? null),
	};
}

/** `FeatureFlagSetting` over Prisma (enhancement 5.6). Unknown keys in the table (a flag since removed) are skipped. */
export class PrismaFeatureFlagStore implements FeatureFlagStore {
	public constructor(private readonly transactions: FeatureFlagTransactions) {}

	public settings(actor: ActorContext, names: boolean): Promise<readonly FeatureFlagRecord[]> {
		return this.transactions.withSystemOperation({ operation: READ_OPERATION, reason: "Feature flags: read the settings", actorUserId: actingUserId(actor) }, async (tx) => {
			const rows = (await tx.featureFlagSetting.findMany({ where: { isDeleted: false } })).filter((row) => FeatureFlagKeySchema.safeParse(row.key).success);
			const ids = names ? [...new Set(rows.flatMap((row) => (row.updatedBy === null ? [] : [row.updatedBy])))] : [];
			const users = ids.length === 0 ? [] : await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
			const byId = new Map(users.map((user): [string, string] => [user.id, user.fullName]));
			return rows.map((row) => toRecord(row, byId));
		});
	}

	public save(actor: ActorContext, key: FeatureFlagKey, change: FeatureFlagChange): Promise<FeatureFlagRecord> {
		const userId = actingUserId(actor);
		return this.transactions.withSystemOperation({ operation: WRITE_OPERATION, reason: `Feature flags: set ${key}`, actorUserId: userId }, async (tx) => {
			const now = BigInt(change.at);
			const existing = await tx.featureFlagSetting.findFirst({ where: { key, isDeleted: false }, select: { id: true } });
			const data = { mode: change.mode, percentage: change.percentage, reason: change.reason, updatedAt: now, updatedBy: userId };
			const row =
				existing === null
					? await tx.featureFlagSetting.create({ data: { key, ...data, createdBy: userId } })
					: await tx.featureFlagSetting.update({ where: { id: existing.id }, data });
			const user = userId === null ? null : await tx.user.findFirst({ where: { id: userId }, select: { id: true, fullName: true } });
			return toRecord(row, new Map(user === null ? [] : [[user.id, user.fullName]]));
		});
	}

	public storeOverrides(actor: ActorContext, key: StoreFeatureFlagKey): Promise<readonly StoreOverrideRecord[]> {
		return this.transactions.withSystemOperation(
			{ operation: READ_OPERATION, reason: `Feature flags: the store settings of ${key}`, actorUserId: actingUserId(actor) },
			async (tx) => {
				const rows = await tx.featureFlagStoreOverride.findMany({
					where: { key, isDeleted: false },
					select: OVERRIDE_SELECT,
					orderBy: [{ tenant: { displayName: "asc" } }, { locationId: { sort: "asc", nulls: "first" } }, { location: { name: "asc" } }],
				});
				const names = await namesOf(
					tx,
					rows.map((row) => row.updatedBy),
				);
				return rows.map((row) => toOverride(row, key, names));
			},
		);
	}

	public setStoreOverride(actor: ActorContext, key: StoreFeatureFlagKey, change: StoreOverrideChange): Promise<StoreOverrideRecord | null> {
		const userId = actingUserId(actor);
		return this.transactions.withSystemOperation({ operation: WRITE_OPERATION, reason: `Feature flags: set ${key} at a store`, actorUserId: userId }, async (tx) => {
			const tenant = await tx.tenant.findFirst({ where: { id: change.tenantId, isDeleted: false }, select: { id: true } });
			const branch =
				change.locationId === null
					? null
					: await tx.location.findFirst({ where: { id: change.locationId, tenantId: change.tenantId, isDeleted: false }, select: { id: true } });
			if (tenant === null || (change.locationId !== null && branch === null)) {
				return null;
			}
			const now = BigInt(change.at);
			// One live setting per flag and store (the partial uniques): the earlier one is kept, soft-deleted.
			await tx.featureFlagStoreOverride.updateMany({
				where: { key, tenantId: change.tenantId, locationId: change.locationId, isDeleted: false },
				data: { isDeleted: true, deletedAt: now, deletedBy: userId, updatedAt: now, updatedBy: userId },
			});
			const row = await tx.featureFlagStoreOverride.create({
				data: {
					key,
					tenantId: change.tenantId,
					locationId: change.locationId,
					enabled: change.enabled,
					reason: change.reason,
					createdAt: now,
					createdBy: userId,
					updatedAt: now,
					updatedBy: userId,
				},
				select: OVERRIDE_SELECT,
			});
			return toOverride(row, key, await namesOf(tx, [userId]));
		});
	}

	public removeStoreOverride(actor: ActorContext, key: StoreFeatureFlagKey, overrideId: string, at: EpochMs): Promise<boolean> {
		const userId = actingUserId(actor);
		return this.transactions.withSystemOperation(
			{ operation: WRITE_OPERATION, reason: `Feature flags: remove a store setting of ${key}`, actorUserId: userId },
			async (tx) => {
				const now = BigInt(at);
				const removed = await tx.featureFlagStoreOverride.updateMany({
					where: { id: overrideId, key, isDeleted: false },
					data: { isDeleted: true, deletedAt: now, deletedBy: userId, updatedAt: now, updatedBy: userId },
				});
				return removed.count > 0;
			},
		);
	}

	public searchStores(actor: ActorContext, search: string, limit: number): Promise<readonly FeatureFlagStoreOption[]> {
		return this.transactions.withSystemOperation(
			{ operation: READ_OPERATION, reason: "Feature flags: find a store to set a flag for", actorUserId: actingUserId(actor) },
			async (tx) => {
				const tenants = await tx.tenant.findMany({
					where: { isDeleted: false, ...(search.length === 0 ? {} : { displayName: { contains: search, mode: "insensitive" } }) },
					select: { id: true, displayName: true, locations: { where: { isDeleted: false }, select: { id: true, name: true }, orderBy: { name: "asc" } } },
					orderBy: { displayName: "asc" },
					take: limit,
				});
				return tenants.map((tenant) => ({
					tenantId: tenant.id,
					tenantName: tenant.displayName,
					branches: tenant.locations.map((location) => ({ locationId: location.id, name: location.name })),
				}));
			},
		);
	}
}
