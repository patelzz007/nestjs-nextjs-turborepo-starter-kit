import { Prisma } from "@prisma/client";
import {
	DecisionSourceSchema,
	DeploymentEnvironmentSchema,
	epochMs,
	FeatureFlagKeySchema,
	RevisionContentSchema,
	type ExposureCount,
	type ExposureStats,
	type FeatureFlagKey,
	type FlagOverride,
	type FlagOverrideUnit,
	type FlagSubjectOption,
	type KillSwitchState,
	type Revision,
} from "@workspace/shared";
import { z } from "zod";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import { isUniqueViolationOf } from "../../../../platform/infrastructure/persistence/unique-violation";
import { FEATURE_FLAGS_READ_OPERATION, FEATURE_FLAGS_WRITE_OPERATION } from "../../application/ports/feature-flags.operations";
import type {
	FlagAdminStore,
	FlagEntryKind,
	NewRevision,
	OverrideChange,
	RevisionDecision,
	RevisionDecisionOutcome,
	RevisionHeads,
	RevisionWriteOutcome,
	Written,
} from "../../application/ports/flag-admin.store";
import { bumpCatalogVersion, namesOf, type FlagTransactions } from "./flag-transactions";

const MS_PER_DAY = 86_400_000;
const WEEK_DAYS = 7;
const FIRST_REVISION = 1;
const NONE = 0;

const REVISION_SELECT = {
	id: true,
	key: true,
	number: true,
	status: true,
	content: true,
	reason: true,
	source: true,
	promotedFrom: true,
	authorUserId: true,
	createdAt: true,
	decidedAt: true,
	decidedByUserId: true,
	decisionReason: true,
	expiresAt: true,
} satisfies Prisma.FlagRevisionSelect;

type RevisionRow = Prisma.FlagRevisionGetPayload<{ select: typeof REVISION_SELECT }>;

const OVERRIDE_SELECT = {
	id: true,
	key: true,
	unit: true,
	userId: true,
	locationId: true,
	tenantId: true,
	isOn: true,
	reason: true,
	updatedAt: true,
	updatedBy: true,
	user: { select: { fullName: true } },
	location: { select: { name: true, tenant: { select: { displayName: true } } } },
	tenant: { select: { displayName: true } },
} satisfies Prisma.FeatureFlagOverrideSelect;

type OverrideRow = Prisma.FeatureFlagOverrideGetPayload<{ select: typeof OVERRIDE_SELECT }>;

/** One decision path's counts, as the raw SQL answers them. */
const ExposureCountRowSchema = z.object({
	source: DecisionSourceSchema,
	ruleId: z.string().nullable(),
	value: z.string(),
	exposures: z.coerce.number().int(),
	subjects: z.coerce.number().int(),
});

function toRevision(row: RevisionRow, names: ReadonlyMap<string, string>): Revision {
	return {
		id: row.id,
		number: row.number,
		status: row.status,
		content: RevisionContentSchema.parse(row.content),
		reason: row.reason,
		source: row.source,
		promotedFrom: row.promotedFrom === null ? null : DeploymentEnvironmentSchema.parse(row.promotedFrom),
		authorUserId: row.authorUserId,
		authorName: row.authorUserId === null ? null : (names.get(row.authorUserId) ?? null),
		createdAt: epochMs(Number(row.createdAt)),
		decidedAt: row.decidedAt === null ? null : epochMs(Number(row.decidedAt)),
		decidedByName: row.decidedByUserId === null ? null : (names.get(row.decidedByUserId) ?? null),
		decisionReason: row.decisionReason,
		expiresAt: row.expiresAt === null ? null : epochMs(Number(row.expiresAt)),
	};
}

function toOverride(row: OverrideRow, key: FeatureFlagKey, names: ReadonlyMap<string, string>): FlagOverride | null {
	const subjectId = row.unit === "USER" ? row.userId : row.unit === "LOCATION" ? row.locationId : row.tenantId;
	if (subjectId === null) {
		return null;
	}
	const subjectName = row.unit === "USER" ? (row.user?.fullName ?? null) : row.unit === "LOCATION" ? (row.location?.name ?? null) : (row.tenant?.displayName ?? null);
	return {
		id: row.id,
		key,
		unit: row.unit,
		subjectId,
		subjectName,
		tenantName: row.unit === "LOCATION" ? (row.location?.tenant.displayName ?? null) : null,
		on: row.isOn,
		reason: row.reason,
		updatedAt: epochMs(Number(row.updatedAt)),
		updatedByName: row.updatedBy === null ? null : (names.get(row.updatedBy) ?? null),
	};
}

/** The indexes two concurrent saves of one flag collide on: the second is refused as a conflict. */
const REVISION_RACE_INDEXES: readonly string[] = ["FlagRevision_kind_key_number_key", "FlagRevision_kind_key_live_key", "FlagRevision_kind_key_pending_key"];

function isRevisionRace(error: Error): boolean {
	return REVISION_RACE_INDEXES.some((index) => isUniqueViolationOf(error, index));
}

/** The subject columns an override of each unit fills. */
function overrideSubject(unit: FlagOverrideUnit, subjectId: string): Pick<Prisma.FeatureFlagOverrideUncheckedCreateInput, "userId" | "locationId" | "tenantId"> {
	switch (unit) {
		case "USER":
			return { userId: subjectId, locationId: null, tenantId: null };
		case "LOCATION":
			return { userId: null, locationId: subjectId, tenantId: null };
		case "TENANT":
			return { userId: null, locationId: null, tenantId: subjectId };
	}
}

/** `FlagAdminStore` over Prisma (ADR 087): reads under `feature_flags.read`, writes under `feature_flags.write`. */
export class PrismaFlagAdminStore implements FlagAdminStore {
	public constructor(private readonly transactions: FlagTransactions) {}

	public heads(actor: ActorContext, kind: FlagEntryKind): Promise<ReadonlyMap<string, RevisionHeads>> {
		return this.read(actor, "read the live and pending revisions", async (tx) => {
			const rows = await tx.flagRevision.findMany({ where: { kind, status: { in: ["LIVE", "PENDING"] } }, select: REVISION_SELECT });
			const names = await namesOf(
				tx,
				rows.flatMap((row) => [row.authorUserId, row.decidedByUserId]),
			);
			const heads = new Map<string, RevisionHeads>();
			for (const row of rows) {
				const current = heads.get(row.key) ?? { live: null, pending: null };
				const revision = toRevision(row, names);
				heads.set(row.key, row.status === "LIVE" ? { ...current, live: revision } : { ...current, pending: revision });
			}
			return heads;
		});
	}

	public revisions(actor: ActorContext, kind: FlagEntryKind, key: string): Promise<readonly Revision[]> {
		return this.read(actor, `read the revisions of ${key}`, async (tx) => {
			const rows = await tx.flagRevision.findMany({ where: { kind, key }, orderBy: { number: "desc" }, select: REVISION_SELECT });
			const names = await namesOf(
				tx,
				rows.flatMap((row) => [row.authorUserId, row.decidedByUserId]),
			);
			return rows.map((row) => toRevision(row, names));
		});
	}

	public killSwitches(actor: ActorContext): Promise<ReadonlyMap<FeatureFlagKey, KillSwitchState>> {
		return this.read(actor, "read the kill switches", async (tx) => {
			const rows = await tx.featureFlagKillSwitch.findMany({ where: { isDeleted: false } });
			const names = await namesOf(
				tx,
				rows.map((row) => row.updatedBy),
			);
			return new Map(
				rows.flatMap((row): [FeatureFlagKey, KillSwitchState][] => {
					const key = FeatureFlagKeySchema.safeParse(row.key);
					return key.success
						? [
								[
									key.data,
									{
										on: row.isOn,
										reason: row.reason,
										changedAt: epochMs(Number(row.updatedAt)),
										changedByName: row.updatedBy === null ? null : (names.get(row.updatedBy) ?? null),
									},
								],
							]
						: [];
				}),
			);
		});
	}

	public overrides(actor: ActorContext, key: FeatureFlagKey | null): Promise<readonly FlagOverride[]> {
		return this.read(actor, "read the flag overrides", async (tx) => {
			const rows = await tx.featureFlagOverride.findMany({
				where: { isDeleted: false, ...(key === null ? {} : { key }) },
				orderBy: { updatedAt: "desc" },
				select: OVERRIDE_SELECT,
			});
			const names = await namesOf(
				tx,
				rows.map((row) => row.updatedBy),
			);
			return rows.flatMap((row) => {
				const flag = FeatureFlagKeySchema.safeParse(row.key);
				const override = flag.success ? toOverride(row, flag.data, names) : null;
				return override === null ? [] : [override];
			});
		});
	}

	public groupKeys(actor: ActorContext): Promise<ReadonlySet<string>> {
		return this.read(
			actor,
			"read the flag group keys",
			async (tx) => new Set((await tx.flagGroup.findMany({ where: { isDeleted: false }, select: { key: true } })).map((row) => row.key)),
		);
	}

	public exposureTotals(actor: ActorContext, kind: FlagEntryKind, since: number): Promise<ReadonlyMap<string, { readonly count: number; readonly lastAt: number | null }>> {
		return this.read(actor, "read exposure totals", async (tx) => {
			const [recent, latest, latestDaily] = await Promise.all([
				tx.featureFlagExposure.groupBy({ by: ["key"], where: { kind, occurredAt: { gte: BigInt(since) } }, _count: { _all: true } }),
				tx.featureFlagExposure.groupBy({ by: ["key"], where: { kind }, _max: { occurredAt: true } }),
				tx.featureFlagExposureDaily.groupBy({ by: ["key"], where: { kind }, _max: { day: true } }),
			]);
			// The latest exposure: the raw rows' (90 days), else the daily sums' (older).
			const lastAt = new Map<string, number>();
			const later = (key: string, at: bigint | null): void => {
				if (at !== null) {
					lastAt.set(key, Math.max(lastAt.get(key) ?? NONE, Number(at)));
				}
			};
			for (const row of latestDaily) {
				later(row.key, row._max.day);
			}
			for (const row of latest) {
				later(row.key, row._max.occurredAt);
			}
			const counts = new Map(recent.map((row): [string, number] => [row.key, row._count._all]));
			const keys = new Set([...lastAt.keys(), ...counts.keys()]);
			return new Map(
				[...keys].map((key): [string, { readonly count: number; readonly lastAt: number | null }] => [
					key,
					{ count: counts.get(key) ?? NONE, lastAt: lastAt.get(key) ?? null },
				]),
			);
		});
	}

	public exposureStats(actor: ActorContext, kind: FlagEntryKind, key: string, now: number): Promise<ExposureStats> {
		return this.read(actor, `read the exposures of ${key}`, async (tx) => {
			const window = async (since: number): Promise<ExposureCount[]> => {
				const rows = await tx.$queryRaw(
					Prisma.sql`SELECT "source"::text AS source, "ruleId"::text AS "ruleId", "value", COUNT(*) AS exposures, COUNT(DISTINCT "subjectId") AS subjects
					 FROM public."FeatureFlagExposure"
					 WHERE "kind" = ${kind}::"FlagEntryKind" AND "key" = ${key} AND "occurredAt" >= ${BigInt(since)} AND "isDeleted" = false
					 GROUP BY "source", "ruleId", "value"
					 ORDER BY exposures DESC`,
				);
				return z.array(ExposureCountRowSchema).parse(rows);
			};
			const [last24h, last7d, latest] = await Promise.all([
				window(now - MS_PER_DAY),
				window(now - WEEK_DAYS * MS_PER_DAY),
				tx.featureFlagExposure.aggregate({ where: { kind, key }, _max: { occurredAt: true } }),
			]);
			const lastAt = latest._max.occurredAt;
			return { last24h, last7d, lastExposureAt: lastAt === null ? null : epochMs(Number(lastAt)) };
		});
	}

	public async writeRevision(actor: ActorContext, revision: NewRevision): Promise<RevisionWriteOutcome> {
		const authorUserId = actingUserId(actor);
		try {
			return await this.write(actor, `write a revision of ${revision.key}`, async (tx): Promise<RevisionWriteOutcome> => {
				const heads = await tx.flagRevision.findMany({
					where: { kind: revision.kind, key: revision.key, status: { in: ["LIVE", "PENDING"] } },
					select: { number: true, status: true },
				});
				const live = heads.find((head) => head.status === "LIVE")?.number ?? null;
				const pending = heads.find((head) => head.status === "PENDING")?.number ?? null;
				if (pending !== null) {
					return { kind: "PENDING_EXISTS", pending };
				}
				if (live !== revision.basedOn) {
					return { kind: "CONFLICT", live };
				}
				const highest = await tx.flagRevision.aggregate({ where: { kind: revision.kind, key: revision.key }, _max: { number: true } });
				const number = (highest._max.number ?? NONE) + FIRST_REVISION;
				const goesLive = revision.pendingUntil === null;
				if (goesLive && live !== null) {
					await tx.flagRevision.updateMany({ where: { kind: revision.kind, key: revision.key, status: "LIVE" }, data: { status: "SUPERSEDED" } });
				}
				const row = await tx.flagRevision.create({
					data: {
						kind: revision.kind,
						key: revision.key,
						number,
						status: goesLive ? "LIVE" : "PENDING",
						content: revision.content,
						reason: revision.reason,
						source: revision.source,
						promotedFrom: revision.promotedFrom,
						authorUserId,
						decidedAt: goesLive ? BigInt(revision.at) : null,
						decidedByUserId: goesLive ? authorUserId : null,
						expiresAt: revision.pendingUntil === null ? null : BigInt(revision.pendingUntil),
					},
					select: REVISION_SELECT,
				});
				const version = goesLive ? await bumpCatalogVersion(tx) : null;
				const names = await namesOf(tx, [authorUserId]);
				return { kind: "WRITTEN", written: { value: toRevision(row, names), version } };
			});
		} catch (error) {
			if (error instanceof Error && isRevisionRace(error)) {
				return { kind: "CONFLICT", live: null };
			}
			throw error;
		}
	}

	public decideRevision(actor: ActorContext, decision: RevisionDecision): Promise<RevisionDecisionOutcome> {
		const deciderUserId = actingUserId(actor);
		return this.write(
			actor,
			`${decision.approve ? "approve" : "reject"} revision ${String(decision.number)} of ${decision.key}`,
			async (tx): Promise<RevisionDecisionOutcome> => {
				const row = await tx.flagRevision.findFirst({ where: { kind: decision.kind, key: decision.key, number: decision.number }, select: REVISION_SELECT });
				if (row === null) {
					return { kind: "NOT_FOUND" };
				}
				if (row.status !== "PENDING") {
					return { kind: "NOT_PENDING" };
				}
				if (row.expiresAt !== null && Number(row.expiresAt) <= decision.at) {
					await tx.flagRevision.update({ where: { id: row.id }, data: { status: "EXPIRED", decidedAt: BigInt(decision.at) } });
					return { kind: "NOT_PENDING" };
				}
				if (row.authorUserId !== null && row.authorUserId === deciderUserId) {
					return { kind: "SELF" };
				}
				const decided = { decidedAt: BigInt(decision.at), decidedByUserId: deciderUserId, decisionReason: decision.reason };
				if (decision.approve) {
					await tx.flagRevision.updateMany({ where: { kind: decision.kind, key: decision.key, status: "LIVE" }, data: { status: "SUPERSEDED" } });
				}
				const updated = await tx.flagRevision.update({ where: { id: row.id }, data: { status: decision.approve ? "LIVE" : "REJECTED", ...decided }, select: REVISION_SELECT });
				const version = decision.approve ? await bumpCatalogVersion(tx) : null;
				const names = await namesOf(tx, [updated.authorUserId, updated.decidedByUserId]);
				return { kind: "DECIDED", written: { value: toRevision(updated, names), version } };
			},
		);
	}

	public setKillSwitch(actor: ActorContext, key: FeatureFlagKey, on: boolean, reason: string): Promise<Written<KillSwitchState>> {
		return this.write(actor, `${on ? "throw" : "release"} the kill switch of ${key}`, async (tx) => {
			const existing = await tx.featureFlagKillSwitch.findFirst({ where: { key, isDeleted: false }, select: { id: true } });
			const row =
				existing === null
					? await tx.featureFlagKillSwitch.create({ data: { key, isOn: on, reason } })
					: await tx.featureFlagKillSwitch.update({ where: { id: existing.id }, data: { isOn: on, reason } });
			const version = await bumpCatalogVersion(tx);
			const names = await namesOf(tx, [row.updatedBy]);
			return {
				value: {
					on: row.isOn,
					reason: row.reason,
					changedAt: epochMs(Number(row.updatedAt)),
					changedByName: row.updatedBy === null ? null : (names.get(row.updatedBy) ?? null),
				},
				version,
			};
		});
	}

	public setOverride(actor: ActorContext, key: FeatureFlagKey, change: OverrideChange): Promise<Written<FlagOverride> | null> {
		const { unit, subjectId, on, reason, at } = change;
		return this.write(actor, `set an override of ${key}`, async (tx) => {
			if (!(await this.subjectExists(tx, unit, subjectId))) {
				return null;
			}
			const subject = overrideSubject(unit, subjectId);
			await tx.featureFlagOverride.updateMany({
				where: { key, isDeleted: false, unit, ...subject },
				data: { isDeleted: true, deletedAt: BigInt(at) },
			});
			const row = await tx.featureFlagOverride.create({ data: { key, unit, ...subject, isOn: on, reason }, select: OVERRIDE_SELECT });
			const version = await bumpCatalogVersion(tx);
			const override = toOverride(row, key, await namesOf(tx, [row.updatedBy]));
			return override === null ? null : { value: override, version };
		});
	}

	public removeOverride(actor: ActorContext, key: FeatureFlagKey, overrideId: string, at: number): Promise<Written<true> | null> {
		return this.write(actor, `remove an override of ${key}`, async (tx): Promise<Written<true> | null> => {
			const removed = await tx.featureFlagOverride.updateMany({ where: { id: overrideId, key, isDeleted: false }, data: { isDeleted: true, deletedAt: BigInt(at) } });
			if (removed.count === NONE) {
				return null;
			}
			return { value: true, version: await bumpCatalogVersion(tx) };
		});
	}

	public searchSubjects(actor: ActorContext, unit: FlagOverrideUnit, search: string, limit: number): Promise<readonly FlagSubjectOption[]> {
		return this.read(actor, "search the people and stores an override can name", async (tx): Promise<FlagSubjectOption[]> => {
			const contains = search === "" ? undefined : { contains: search, mode: Prisma.QueryMode.insensitive };
			switch (unit) {
				case "USER": {
					const users = await tx.user.findMany({
						where: { isDeleted: false, ...(contains === undefined ? {} : { OR: [{ fullName: contains }, { email: contains }] }) },
						orderBy: { fullName: "asc" },
						take: limit,
						select: { id: true, fullName: true, email: true },
					});
					return users.map((user) => ({ id: user.id, name: user.fullName, detail: user.email }));
				}
				case "TENANT": {
					const tenants = await tx.tenant.findMany({
						where: { isDeleted: false, ...(contains === undefined ? {} : { displayName: contains }) },
						orderBy: { displayName: "asc" },
						take: limit,
						select: { id: true, displayName: true },
					});
					return tenants.map((tenant) => ({ id: tenant.id, name: tenant.displayName, detail: null }));
				}
				case "LOCATION": {
					const locations = await tx.location.findMany({
						where: { isDeleted: false, ...(contains === undefined ? {} : { OR: [{ name: contains }, { tenant: { displayName: contains } }] }) },
						orderBy: { name: "asc" },
						take: limit,
						select: { id: true, name: true, tenant: { select: { displayName: true } } },
					});
					return locations.map((location) => ({ id: location.id, name: location.name, detail: location.tenant.displayName }));
				}
			}
		});
	}

	private async subjectExists(tx: Prisma.TransactionClient, unit: FlagOverrideUnit, subjectId: string): Promise<boolean> {
		switch (unit) {
			case "USER":
				return (await tx.user.count({ where: { id: subjectId, isDeleted: false } })) > 0;
			case "LOCATION":
				return (await tx.location.count({ where: { id: subjectId, isDeleted: false } })) > 0;
			case "TENANT":
				return (await tx.tenant.count({ where: { id: subjectId, isDeleted: false } })) > 0;
		}
	}

	private read<T>(actor: ActorContext, what: string, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation({ operation: FEATURE_FLAGS_READ_OPERATION, reason: `Feature flags: ${what}`, actorUserId: actingUserId(actor) }, handler);
	}

	private write<T>(actor: ActorContext, what: string, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation({ operation: FEATURE_FLAGS_WRITE_OPERATION, reason: `Feature flags: ${what}`, actorUserId: actingUserId(actor) }, handler);
	}
}
