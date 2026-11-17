import type { Prisma } from "@prisma/client";
import {
	DynamicConfigKeySchema,
	FlagGroupConditionsSchema,
	epochMs,
	FeatureFlagKeySchema,
	RevisionContentSchema,
	RolloutUnitSchema,
	type FlagGroup,
	type FlagGroupDefinition,
	type FlagGroupMemberListQuery,
	type FlagGroupUsage,
	type RolloutUnit,
} from "@workspace/shared";
import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import { isUniqueViolationOf } from "../../../../platform/infrastructure/persistence/unique-violation";
import { FEATURE_FLAGS_READ_OPERATION, FEATURE_FLAGS_WRITE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { Written } from "../../application/ports/flag-admin.store";
import type { FlagGroupChange, FlagGroupStore, MemberChangeOutcome, MemberPage, NewFlagGroup } from "../../application/ports/flag-group.store";
import { groupKeysOf } from "../../domain/policies/flag-rules.policy";
import { bumpCatalogVersion, namesOf, type FlagTransactions } from "./flag-transactions";

const GROUP_KEY_INDEX = "FlagGroup_key_key";
const FIRST_PAGE = 1;
const NONE = 0;

const GROUP_SELECT = {
	id: true,
	key: true,
	name: true,
	description: true,
	kind: true,
	unit: true,
	conditions: true,
	updatedAt: true,
	updatedBy: true,
	_count: { select: { members: { where: { isDeleted: false } } } },
} satisfies Prisma.FlagGroupSelect;

type GroupRow = Prisma.FlagGroupGetPayload<{ select: typeof GROUP_SELECT }>;

function definitionOf(row: GroupRow): FlagGroupDefinition {
	return row.kind === "LIST" ? { kind: "LIST", unit: RolloutUnitSchema.parse(row.unit) } : { kind: "CONDITIONS", conditions: FlagGroupConditionsSchema.parse(row.conditions) };
}

/** Which live or pending revisions name each group key. */
async function usages(tx: Prisma.TransactionClient): Promise<ReadonlyMap<string, readonly FlagGroupUsage[]>> {
	const revisions = await tx.flagRevision.findMany({ where: { status: { in: ["LIVE", "PENDING"] } }, select: { kind: true, key: true, content: true } });
	const byGroup = new Map<string, FlagGroupUsage[]>();
	for (const revision of revisions) {
		const content = RevisionContentSchema.parse(revision.content);
		const flagKey = FeatureFlagKeySchema.safeParse(revision.key);
		const configKey = DynamicConfigKeySchema.safeParse(revision.key);
		const usage: FlagGroupUsage | null =
			revision.kind === "FLAG" && flagKey.success
				? { kind: "FLAG", key: flagKey.data }
				: revision.kind === "CONFIG" && configKey.success
					? { kind: "CONFIG", key: configKey.data }
					: null;
		if (usage === null) {
			continue;
		}
		for (const group of groupKeysOf(content.rules)) {
			const list = byGroup.get(group) ?? [];
			if (!list.some((existing) => existing.kind === usage.kind && existing.key === usage.key)) {
				list.push(usage);
			}
			byGroup.set(group, list);
		}
	}
	return byGroup;
}

function toGroup(row: GroupRow, used: ReadonlyMap<string, readonly FlagGroupUsage[]>, names: ReadonlyMap<string, string>): FlagGroup {
	return {
		id: row.id,
		key: row.key,
		name: row.name,
		description: row.description,
		definition: definitionOf(row),
		memberCount: row._count.members,
		usedBy: [...(used.get(row.key) ?? [])],
		updatedAt: epochMs(Number(row.updatedAt)),
		updatedByName: row.updatedBy === null ? null : (names.get(row.updatedBy) ?? null),
	};
}

/** `FlagGroupStore` over Prisma (ADR 087). Members are removed by soft delete; a listed USER group is personal data. */
export class PrismaFlagGroupStore implements FlagGroupStore {
	public constructor(private readonly transactions: FlagTransactions) {}

	public list(actor: ActorContext): Promise<readonly FlagGroup[]> {
		return this.read(actor, "read the flag groups", async (tx) => {
			const rows = await tx.flagGroup.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" }, select: GROUP_SELECT });
			const [used, names] = await Promise.all([
				usages(tx),
				namesOf(
					tx,
					rows.map((row) => row.updatedBy),
				),
			]);
			return rows.map((row) => toGroup(row, used, names));
		});
	}

	public find(actor: ActorContext, groupId: string): Promise<FlagGroup | null> {
		return this.read(actor, "read a flag group", async (tx) => this.findIn(tx, groupId));
	}

	public async create(actor: ActorContext, group: NewFlagGroup): Promise<Written<FlagGroup> | null> {
		try {
			return await this.write(actor, `create the flag group ${group.key}`, async (tx): Promise<Written<FlagGroup> | null> => {
				if ((await tx.flagGroup.count({ where: { key: group.key, isDeleted: false } })) > NONE) {
					return null;
				}
				const row = await tx.flagGroup.create({
					data: {
						key: group.key,
						name: group.name,
						description: group.description,
						kind: group.definition.kind,
						reason: group.reason,
						...(group.definition.kind === "LIST" ? { unit: group.definition.unit } : { conditions: group.definition.conditions }),
					},
					select: { id: true },
				});
				const version = await bumpCatalogVersion(tx);
				const created = await this.findIn(tx, row.id);
				return created === null ? null : { value: created, version };
			});
		} catch (error) {
			if (error instanceof Error && isUniqueViolationOf(error, GROUP_KEY_INDEX)) {
				return null;
			}
			throw error;
		}
	}

	public update(actor: ActorContext, groupId: string, change: FlagGroupChange): Promise<Written<FlagGroup> | null> {
		return this.write(actor, "change a flag group", async (tx): Promise<Written<FlagGroup> | null> => {
			const updated = await tx.flagGroup.updateMany({
				where: { id: groupId, isDeleted: false },
				data: { name: change.name, description: change.description, reason: change.reason, ...(change.conditions === null ? {} : { conditions: change.conditions }) },
			});
			if (updated.count === NONE) {
				return null;
			}
			const version = await bumpCatalogVersion(tx);
			const group = await this.findIn(tx, groupId);
			return group === null ? null : { value: group, version };
		});
	}

	public remove(actor: ActorContext, groupId: string, at: number): Promise<Written<true> | null> {
		return this.write(actor, "remove a flag group", async (tx): Promise<Written<true> | null> => {
			const removed = await tx.flagGroup.updateMany({ where: { id: groupId, isDeleted: false }, data: { isDeleted: true, deletedAt: BigInt(at) } });
			if (removed.count === NONE) {
				return null;
			}
			await tx.flagGroupMember.updateMany({ where: { groupId, isDeleted: false }, data: { isDeleted: true, deletedAt: BigInt(at) } });
			return { value: true, version: await bumpCatalogVersion(tx) };
		});
	}

	public changeMembers(
		actor: ActorContext,
		groupId: string,
		action: "ADD" | "REMOVE",
		subjectIds: readonly string[],
		maxMembers: number,
		at: number,
	): Promise<MemberChangeOutcome> {
		return this.write(actor, `${action === "ADD" ? "add to" : "remove from"} a flag group`, async (tx): Promise<MemberChangeOutcome> => {
			const group = await tx.flagGroup.findFirst({ where: { id: groupId, isDeleted: false }, select: { kind: true, unit: true } });
			if (group === null) {
				return { kind: "NOT_FOUND" };
			}
			if (group.kind !== "LIST" || group.unit === null) {
				return { kind: "NOT_LISTED" };
			}
			const wanted = [...new Set(subjectIds)];
			let changed: number;
			if (action === "ADD") {
				const unknown = await this.unknownSubjects(tx, group.unit, wanted);
				if (unknown.length > NONE) {
					return { kind: "UNKNOWN_SUBJECTS", unit: group.unit, subjectIds: unknown };
				}
				const present = new Set(
					(await tx.flagGroupMember.findMany({ where: { groupId, isDeleted: false, subjectId: { in: wanted } }, select: { subjectId: true } })).map((row) => row.subjectId),
				);
				const fresh = wanted.filter((id) => !present.has(id));
				const count = await tx.flagGroupMember.count({ where: { groupId, isDeleted: false } });
				if (count + fresh.length > maxMembers) {
					return { kind: "TOO_MANY", limit: maxMembers };
				}
				changed = (await tx.flagGroupMember.createMany({ data: fresh.map((subjectId) => ({ groupId, subjectId })) })).count;
			} else {
				changed = (await tx.flagGroupMember.updateMany({ where: { groupId, isDeleted: false, subjectId: { in: wanted } }, data: { isDeleted: true, deletedAt: BigInt(at) } }))
					.count;
			}
			const memberCount = await tx.flagGroupMember.count({ where: { groupId, isDeleted: false } });
			const version = changed > NONE ? await bumpCatalogVersion(tx) : null;
			return { kind: "CHANGED", written: { value: { changed, memberCount }, version } };
		});
	}

	public members(actor: ActorContext, groupId: string, query: FlagGroupMemberListQuery): Promise<MemberPage | null> {
		return this.read(actor, "read a flag group's members", async (tx): Promise<MemberPage | null> => {
			const group = await tx.flagGroup.findFirst({ where: { id: groupId, isDeleted: false }, select: { unit: true } });
			if (group === null) {
				return null;
			}
			const where = { groupId, isDeleted: false };
			const { page } = query;
			const [total, rows] = await Promise.all([
				tx.flagGroupMember.count({ where }),
				tx.flagGroupMember.findMany({
					where,
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
					skip: (page - FIRST_PAGE) * query.limit,
					take: query.limit,
					select: { subjectId: true, createdAt: true, createdBy: true },
				}),
			]);
			const [subjectNames, adderNames] = await Promise.all([
				this.subjectNames(
					tx,
					group.unit,
					rows.map((row) => row.subjectId),
				),
				namesOf(
					tx,
					rows.map((row) => row.createdBy),
				),
			]);
			return {
				total,
				items: rows.map((row) => ({
					subjectId: row.subjectId,
					name: subjectNames.get(row.subjectId) ?? null,
					addedAt: epochMs(Number(row.createdAt)),
					addedByName: row.createdBy === null ? null : (adderNames.get(row.createdBy) ?? null),
				})),
			};
		});
	}

	private async findIn(tx: Prisma.TransactionClient, groupId: string): Promise<FlagGroup | null> {
		const row = await tx.flagGroup.findFirst({ where: { id: groupId, isDeleted: false }, select: GROUP_SELECT });
		if (row === null) {
			return null;
		}
		const [used, names] = await Promise.all([usages(tx), namesOf(tx, [row.updatedBy])]);
		return toGroup(row, used, names);
	}

	/** Listed ids of the unit that don't exist (devices aren't recorded anywhere, so never checked). */
	private async unknownSubjects(tx: Prisma.TransactionClient, unit: RolloutUnit, ids: readonly string[]): Promise<readonly string[]> {
		const known = new Set(await this.existing(tx, unit, ids));
		return unit === "DEVICE" ? [] : ids.filter((id) => !known.has(id));
	}

	private async existing(tx: Prisma.TransactionClient, unit: RolloutUnit, ids: readonly string[]): Promise<readonly string[]> {
		const where = { id: { in: [...ids] }, isDeleted: false };
		switch (unit) {
			case "USER":
				return (await tx.user.findMany({ where, select: { id: true } })).map((row) => row.id);
			case "TENANT":
				return (await tx.tenant.findMany({ where, select: { id: true } })).map((row) => row.id);
			case "LOCATION":
				return (await tx.location.findMany({ where, select: { id: true } })).map((row) => row.id);
			case "DEVICE":
				return ids;
		}
	}

	private async subjectNames(tx: Prisma.TransactionClient, unit: RolloutUnit | null, ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
		const where = { id: { in: [...ids] } };
		switch (unit) {
			case "USER":
				return new Map((await tx.user.findMany({ where, select: { id: true, fullName: true } })).map((row): [string, string] => [row.id, row.fullName]));
			case "TENANT":
				return new Map((await tx.tenant.findMany({ where, select: { id: true, displayName: true } })).map((row): [string, string] => [row.id, row.displayName]));
			case "LOCATION":
				return new Map((await tx.location.findMany({ where, select: { id: true, name: true } })).map((row): [string, string] => [row.id, row.name]));
			case "DEVICE":
			case null:
				return new Map();
		}
	}

	private read<T>(actor: ActorContext, what: string, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation({ operation: FEATURE_FLAGS_READ_OPERATION, reason: `Flag groups: ${what}`, actorUserId: actingUserId(actor) }, handler);
	}

	private write<T>(actor: ActorContext, what: string, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation({ operation: FEATURE_FLAGS_WRITE_OPERATION, reason: `Flag groups: ${what}`, actorUserId: actingUserId(actor) }, handler);
	}
}
