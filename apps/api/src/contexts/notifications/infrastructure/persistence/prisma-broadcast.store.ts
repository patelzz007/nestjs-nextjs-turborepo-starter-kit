// ============================================
// notifications/infrastructure/persistence/prisma-broadcast.store.ts — broadcasts on one transaction (ADR 073)
// ============================================
// Audiences and results are set-based SQL (one statement each), so a large audience never loads row by
// row through the ORM. Every write runs under a `broadcasts.*` system operation (RLS bypass-only tables).

import { Prisma, type Broadcast, type BroadcastReport } from "@prisma/client";
import {
	BroadcastAudienceSchema,
	BroadcastChannelSchema,
	broadcastListQuery,
	broadcastReportListQuery,
	BroadcastReportReasonSchema,
	BroadcastReportStatusSchema,
	BroadcastSendModeSchema,
	BroadcastStatusSchema,
	epochMs,
	NotificationCategorySchema,
	NotificationDeliveryReasonSchema,
	PLATFORM_DISPLAY_REGION,
	RichTextDocumentSchema,
	tenantCustomerListQuery,
	TenantCustomerUnreachableReasonSchema,
	type BroadcastChannel,
	type BroadcastDraftInput,
	type BroadcastListQuery,
	type BroadcastReportEntry,
	type BroadcastReportListQuery,
	type BroadcastReportReason,
	type BroadcastResults,
	type BroadcastStatus,
	type PaginatedServiceResult,
	type PlatformBroadcastAudience,
	type TenantBroadcastAudience,
	type TenantCustomerEntry,
	type TenantCustomerListQuery,
	type TenantCustomerUnreachableReason,
	maskEmailAddress,
} from "@workspace/shared";
import { z } from "zod";

import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import type {
	AudienceResolution,
	BroadcastMoveFields,
	BroadcastRecipient,
	BroadcastStore,
	StoredBroadcast,
	TenantBroadcastState,
} from "../../application/ports/broadcast-store.port";
import { BROADCAST_STRIKE_WINDOW_MS } from "../../domain/broadcasts/broadcast-policy";

const DAY_MS = 86_400_000;
const BROADCAST_COLUMNS: SortColumns<"createdAt", Prisma.BroadcastOrderByWithRelationInput> = { createdAt: (direction) => ({ createdAt: direction }) };
const REPORT_COLUMNS: SortColumns<"createdAt", Prisma.BroadcastReportOrderByWithRelationInput> = { createdAt: (direction) => ({ createdAt: direction }) };
const BROADCAST_KEYSET: ListKeyset<Broadcast, Prisma.BroadcastWhereInput> = timestampIdKeyset(
	(row: Broadcast) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.BroadcastWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);
const REPORT_KEYSET: ListKeyset<BroadcastReport, Prisma.BroadcastReportWhereInput> = timestampIdKeyset(
	(row: BroadcastReport) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.BroadcastReportWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** One audience row: a customer or user, with every reason they may be left out. */
const AudienceRowSchema = z.object({
	userId: z.string(),
	timeZone: z.string().nullable(),
	left: z.boolean(),
	banned: z.boolean(),
	staff: z.boolean(),
	consent: z.boolean(),
	deleted: z.boolean(),
});
type AudienceRow = z.output<typeof AudienceRowSchema>;

const ResultRowSchema = z.object({
	channel: BroadcastChannelSchema,
	status: z.string(),
	reason: NotificationDeliveryReasonSchema.nullable(),
	opened: z.boolean(),
	n: z.number().int(),
});
const InAppReadSchema = z.object({ read: z.number().int(), total: z.number().int() });
const CustomerRowSchema = z.object({
	userId: z.string(),
	fullName: z.string(),
	email: z.string().nullable(),
	firstClaimedAt: z.string(),
	lastClaimedAt: z.string(),
	claimCount: z.number().int(),
	lastRedeemedAt: z.string().nullable(),
	unreachableReason: TenantCustomerUnreachableReasonSchema.nullable(),
});
const CountSchema = z.object({ n: z.number().int() });

/** Delivery statuses that mean "it arrived" for results. */
const DELIVERED_STATUSES: readonly string[] = ["SENT", "DELIVERED"];

function toStored(row: Broadcast): StoredBroadcast {
	return {
		id: row.id,
		tenantId: row.tenantId,
		authorUserId: row.authorUserId,
		approverUserId: row.approverUserId,
		status: BroadcastStatusSchema.parse(row.status),
		category: NotificationCategorySchema.parse(row.category),
		title: row.title,
		body: RichTextDocumentSchema.parse(row.body),
		audience: BroadcastAudienceSchema.parse(row.audienceFilter),
		channels: row.channels.map((channel) => BroadcastChannelSchema.parse(channel)),
		sendMode: BroadcastSendModeSchema.parse(row.sendMode),
		sendAt: row.sendAt === null ? null : Number(row.sendAt),
		localSendAt: row.localSendAt === null ? null : Number(row.localSendAt),
		startsAt: row.startsAt === null ? null : Number(row.startsAt),
		sendingWeek: row.sendingWeek,
		audienceCount: row.audienceCount,
		sendingStartedAt: row.sendingStartedAt === null ? null : Number(row.sendingStartedAt),
		completedAt: row.completedAt === null ? null : Number(row.completedAt),
		cancelledAt: row.cancelledAt === null ? null : Number(row.cancelledAt),
		pausedAt: row.pausedAt === null ? null : Number(row.pausedAt),
		pauseReason: row.pauseReason,
		approvedAt: row.approvedAt === null ? null : Number(row.approvedAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

function draftColumns(
	draft: BroadcastDraftInput,
): Pick<Prisma.BroadcastUncheckedCreateInput, "category" | "title" | "body" | "audienceFilter" | "channels" | "sendMode" | "sendAt" | "localSendAt"> {
	return {
		category: draft.category,
		title: draft.title,
		body: draft.body,
		audienceFilter: draft.audience,
		channels: [...draft.channels],
		sendMode: draft.sendMode,
		sendAt: draft.sendAt === null ? null : BigInt(draft.sendAt),
		localSendAt: draft.localSendAt === null ? null : BigInt(draft.localSendAt),
	};
}

/** Who the audience keeps, and the counts of who it leaves out (a deleted account first, then the reasons in order). */
function resolve(rows: readonly AudienceRow[], requireConsent: boolean): AudienceResolution {
	const recipients: BroadcastRecipient[] = [];
	const leftOut = new Map<TenantCustomerUnreachableReason | "deleted", number>();
	const leave = (reason: TenantCustomerUnreachableReason | "deleted"): void => {
		leftOut.set(reason, (leftOut.get(reason) ?? 0) + 1);
	};
	for (const row of rows) {
		if (row.deleted) {
			leave("deleted");
		} else if (row.staff) {
			leave("staff");
		} else if (row.banned) {
			leave("banned");
		} else if (row.left) {
			leave("left");
		} else if (requireConsent && !row.consent) {
			leave("no-consent");
		} else {
			recipients.push({ userId: row.userId, timeZone: row.timeZone ?? PLATFORM_DISPLAY_REGION.timeZone });
		}
	}
	return { recipients, matched: rows.length, leftOut };
}

export class PrismaBroadcastStore implements BroadcastStore {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async create(tenantId: string | null, authorUserId: string, draft: BroadcastDraftInput, now: number): Promise<StoredBroadcast> {
		const row = await this.db.broadcast.create({
			data: {
				tenantId,
				authorUserId,
				status: "DRAFT",
				...draftColumns(draft),
				createdAt: BigInt(now),
				updatedAt: BigInt(now),
				createdBy: authorUserId,
				updatedBy: authorUserId,
			},
		});
		return toStored(row);
	}

	public async updateDraft(broadcastId: string, draft: BroadcastDraftInput, now: number): Promise<StoredBroadcast | null> {
		const updated = await this.db.broadcast.updateMany({
			where: { id: broadcastId, status: "DRAFT", isDeleted: false },
			data: { ...draftColumns(draft), updatedAt: BigInt(now) },
		});
		return updated.count === 1 ? this.find(broadcastId) : null;
	}

	public async find(broadcastId: string): Promise<StoredBroadcast | null> {
		const row = await this.db.broadcast.findFirst({ where: { id: broadcastId, isDeleted: false } });
		return row === null ? null : toStored(row);
	}

	public async list(tenantId: string | null, query: BroadcastListQuery): Promise<PaginatedServiceResult<StoredBroadcast>> {
		const where: Prisma.BroadcastWhereInput = {
			AND: [
				{ isDeleted: false, ...(tenantId === null ? {} : { tenantId }) },
				...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status): Prisma.BroadcastWhereInput => ({ status })),
				...(tenantId === null
					? fieldWhere(toPrismaEqualityFilter(query.filter?.tenantId), (filterTenantId): Prisma.BroadcastWhereInput => ({ tenantId: filterTenantId }))
					: []),
			],
		};
		const page = await fetchListPage(query, {
			where,
			order: buildListOrder(broadcastListQuery.resolveSort(query.sort), {
				columns: BROADCAST_COLUMNS,
				tieBreaker: (direction): Prisma.BroadcastOrderByWithRelationInput => ({ id: direction }),
			}),
			keyset: BROADCAST_KEYSET,
			and: (left, right): Prisma.BroadcastWhereInput => ({ AND: [left, right] }),
			count: (filter): Promise<number> => this.db.broadcast.count({ where: filter }),
			findMany: (args): Promise<Broadcast[]> => this.db.broadcast.findMany(args),
		});
		return toPaginatedServiceResult(mapListResult(page, toStored), query);
	}

	public async move(broadcastId: string, from: readonly BroadcastStatus[], to: BroadcastStatus, fields: BroadcastMoveFields, now: number): Promise<boolean> {
		const data: Prisma.BroadcastUncheckedUpdateManyInput = { status: to, updatedAt: BigInt(now) };
		if (fields.approverUserId !== undefined) {
			data.approverUserId = fields.approverUserId;
		}
		if (fields.approvedAt !== undefined) {
			data.approvedAt = BigInt(fields.approvedAt);
		}
		if (fields.startsAt !== undefined) {
			data.startsAt = fields.startsAt === null ? null : BigInt(fields.startsAt);
		}
		if (fields.sendingWeek !== undefined) {
			data.sendingWeek = fields.sendingWeek;
		}
		if (fields.sendingStartedAt !== undefined) {
			data.sendingStartedAt = BigInt(fields.sendingStartedAt);
		}
		if (fields.audienceCount !== undefined) {
			data.audienceCount = fields.audienceCount;
		}
		if (fields.completedAt !== undefined) {
			data.completedAt = BigInt(fields.completedAt);
		}
		if (fields.cancelledAt !== undefined) {
			data.cancelledAt = BigInt(fields.cancelledAt);
		}
		if (fields.pausedAt !== undefined) {
			data.pausedAt = fields.pausedAt === null ? null : BigInt(fields.pausedAt);
		}
		if (fields.pauseReason !== undefined) {
			data.pauseReason = fields.pauseReason;
		}
		const moved = await this.db.broadcast.updateMany({ where: { id: broadcastId, status: { in: [...from] }, isDeleted: false }, data });
		return moved.count === 1;
	}

	public startedInWeek(tenantId: string, week: string): Promise<number> {
		return this.db.broadcast.count({ where: { tenantId, sendingWeek: week, sendingStartedAt: { not: null }, isDeleted: false } });
	}

	public async dueToStart(now: number, limit: number): Promise<readonly string[]> {
		const rows = await this.db.broadcast.findMany({
			where: { status: "SCHEDULED", isDeleted: false, startsAt: { lte: BigInt(now) } },
			orderBy: [{ startsAt: "asc" }, { id: "asc" }],
			take: limit,
			select: { id: true },
		});
		return rows.map((row) => row.id);
	}

	public async tenantAudience(tenantId: string, audience: TenantBroadcastAudience, now: number): Promise<AudienceResolution> {
		const since = BigInt(now - audience.claimedWithinDays * DAY_MS);
		const redeemed =
			audience.redeemed === "redeemed"
				? Prisma.sql`AND tc."lastRedeemedAt" IS NOT NULL`
				: audience.redeemed === "not-redeemed"
					? Prisma.sql`AND tc."lastRedeemedAt" IS NULL`
					: Prisma.empty;
		const location =
			audience.locationId === null
				? Prisma.empty
				: Prisma.sql`AND EXISTS (SELECT 1 FROM public."RewardRedemption" rr WHERE rr."tenantId" = tc."tenantId" AND rr."userId" = tc."userId" AND rr."locationId" = ${audience.locationId} AND rr."isDeleted" = false)`;
		const chosen = audience.customerIds === null ? Prisma.empty : Prisma.sql`AND tc."userId" IN (${Prisma.join(audience.customerIds)})`;
		const rows = await this.db.$queryRaw`
			SELECT tc."userId" AS "userId", ns."timeZone" AS "timeZone",
			       (tc."leftAt" IS NOT NULL) AS "left",
			       EXISTS (SELECT 1 FROM public."TenantCustomerBan" b WHERE b."tenantId" = tc."tenantId" AND b."customerUserId" = tc."userId" AND b."isDeleted" = false AND b."liftedAt" IS NULL) AS banned,
			       EXISTS (SELECT 1 FROM public."Membership" m WHERE m."tenantId" = tc."tenantId" AND m."userId" = tc."userId" AND m."isDeleted" = false) AS staff,
			       COALESCE((SELECT mc.granted FROM public."MarketingConsent" mc WHERE mc."userId" = tc."userId" AND mc.scope = 'TENANT' AND mc."tenantId" = tc."tenantId" ORDER BY mc."occurredAt" DESC LIMIT 1), false) AS consent,
			       u."isDeleted" AS deleted
			FROM public."TenantCustomer" tc
			JOIN public."User" u ON u.id = tc."userId"
			LEFT JOIN public."NotificationSchedule" ns ON ns."userId" = tc."userId" AND ns."isDeleted" = false
			WHERE tc."tenantId" = ${tenantId} AND tc."isDeleted" = false AND tc."lastClaimedAt" >= ${since} ${redeemed} ${location} ${chosen}
			ORDER BY tc."userId"`;
		return resolve(z.array(AudienceRowSchema).parse(rows), true);
	}

	public async platformAudience(audience: PlatformBroadcastAudience): Promise<AudienceResolution> {
		const wantsCustomers = audience.surfaces.includes("CUSTOMER");
		const wantsMerchants = audience.surfaces.includes("MERCHANT");
		const wantsAdmins = audience.surfaces.includes("ADMIN");
		const signedUp = audience.signedUpAfter === null ? Prisma.empty : Prisma.sql`AND u."createdAt" >= ${BigInt(audience.signedUpAfter)}`;
		const states = audience.tenantStates === null ? null : [...audience.tenantStates];
		const merchantClause =
			states === null
				? Prisma.sql`EXISTS (SELECT 1 FROM public."Membership" m WHERE m."userId" = u.id AND m."isDeleted" = false AND m.status = 'ACTIVE')`
				: Prisma.sql`EXISTS (SELECT 1 FROM public."Membership" m JOIN public."Tenant" t ON t.id = m."tenantId" WHERE m."userId" = u.id AND m."isDeleted" = false AND m.status = 'ACTIVE' AND t."lifecycleState"::text IN (${Prisma.join(states)}))`;
		const adminClause = Prisma.sql`EXISTS (SELECT 1 FROM public."UserRole" ur JOIN public."Role" r ON r.id = ur."roleId" WHERE ur."userId" = u.id AND ur."isDeleted" = false AND r."isSystem" = true AND r."isDeleted" = false)`;
		const customerClause = Prisma.sql`NOT EXISTS (SELECT 1 FROM public."Membership" m WHERE m."userId" = u.id AND m."isDeleted" = false)`;
		const clauses = [...(wantsCustomers ? [customerClause] : []), ...(wantsMerchants ? [merchantClause] : []), ...(wantsAdmins ? [adminClause] : [])];
		const rows = await this.db.$queryRaw`
			SELECT u.id AS "userId", ns."timeZone" AS "timeZone", false AS "left", false AS banned, false AS staff, true AS consent, u."isDeleted" AS deleted
			FROM public."User" u
			LEFT JOIN public."NotificationSchedule" ns ON ns."userId" = u.id AND ns."isDeleted" = false
			WHERE (${Prisma.join(clauses, " OR ")}) ${signedUp}
			ORDER BY u.id`;
		// A platform notice is product or account news, not marketing: its own category preference decides (ADR 070).
		return resolve(z.array(AudienceRowSchema).parse(rows), false);
	}

	public async tenantState(tenantId: string): Promise<TenantBroadcastState | null> {
		const tenant = await this.db.tenant.findFirst({
			where: { id: tenantId, isDeleted: false },
			select: { displayName: true, lifecycleState: true, broadcastsDisabledAt: true },
		});
		return tenant === null
			? null
			: {
					displayName: tenant.displayName,
					active: tenant.lifecycleState === "ACTIVE",
					broadcastsDisabledAt: tenant.broadcastsDisabledAt === null ? null : Number(tenant.broadcastsDisabledAt),
				};
	}

	public async results(broadcastId: string): Promise<readonly BroadcastResults[]> {
		const rows = z.array(ResultRowSchema).parse(
			await this.db.$queryRaw`
				SELECT d.channel::text AS channel, d.status::text AS status, d.reason AS reason, (d."openedAt" IS NOT NULL) AS opened, COUNT(*)::int AS n
				FROM public."NotificationDelivery" d JOIN public."Notification" n ON n.id = d."notificationId"
				WHERE n."broadcastId" = ${broadcastId}
				GROUP BY d.channel, d.status, d.reason, (d."openedAt" IS NOT NULL)`,
		);
		const [inApp] = z.tuple([InAppReadSchema]).parse(
			await this.db.$queryRaw`
					SELECT COUNT(*) FILTER (WHERE "readAt" IS NOT NULL)::int AS read, COUNT(*)::int AS total FROM public."InAppNotification" WHERE "broadcastId" = ${broadcastId}`,
		);
		return BroadcastChannelSchema.options.map((channel: BroadcastChannel): BroadcastResults => {
			const own = rows.filter((row) => row.channel === channel);
			const sum = (keep: (row: (typeof own)[number]) => boolean): number => own.filter(keep).reduce((total, row) => total + row.n, 0);
			const suppressed = new Map<string, number>();
			for (const row of own.filter((candidate) => candidate.status === "SUPPRESSED")) {
				const reason = row.reason ?? "suppressed-destination";
				suppressed.set(reason, (suppressed.get(reason) ?? 0) + row.n);
			}
			return {
				channel,
				targeted: sum(() => true),
				delivered: sum((row) => DELIVERED_STATUSES.includes(row.status)),
				failed: sum((row) => row.status === "FAILED"),
				suppressed: [...suppressed.entries()].map(([reason, count]) => ({ reason: NotificationDeliveryReasonSchema.parse(reason), count })),
				engaged: channel === "PUSH" ? sum((row) => row.opened) : channel === "IN_APP" ? inApp.read : null,
			};
		});
	}

	public async openReportCounts(broadcastIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
		if (broadcastIds.length === 0) {
			return new Map();
		}
		const groups = await this.db.broadcastReport.groupBy({
			by: ["broadcastId"],
			where: { broadcastId: { in: [...broadcastIds] }, status: "OPEN", isDeleted: false },
			_count: { _all: true },
		});
		return new Map(groups.map((group) => [group.broadcastId, group._count._all]));
	}

	public async receivedBy(broadcastId: string, userId: string): Promise<boolean> {
		return (await this.db.inAppNotification.count({ where: { broadcastId, userId, isDeleted: false } })) > 0;
	}

	public async addReport(
		broadcastId: string,
		tenantId: string | null,
		reporterUserId: string,
		reason: BroadcastReportReason,
		note: string | null,
		now: number,
	): Promise<boolean> {
		const created = await this.db.broadcastReport.createMany({
			data: [{ broadcastId, tenantId, reporterUserId, reason, note, status: "OPEN", createdAt: BigInt(now), updatedAt: BigInt(now), createdBy: reporterUserId }],
			skipDuplicates: true,
		});
		return created.count === 1;
	}

	public async listReports(query: BroadcastReportListQuery, now: number): Promise<PaginatedServiceResult<BroadcastReportEntry>> {
		const where: Prisma.BroadcastReportWhereInput = {
			AND: [{ isDeleted: false }, ...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status): Prisma.BroadcastReportWhereInput => ({ status }))],
		};
		const page = await fetchListPage(query, {
			where,
			order: buildListOrder(broadcastReportListQuery.resolveSort(query.sort), {
				columns: REPORT_COLUMNS,
				tieBreaker: (direction): Prisma.BroadcastReportOrderByWithRelationInput => ({ id: direction }),
			}),
			keyset: REPORT_KEYSET,
			and: (left, right): Prisma.BroadcastReportWhereInput => ({ AND: [left, right] }),
			count: (filter): Promise<number> => this.db.broadcastReport.count({ where: filter }),
			findMany: (args): Promise<BroadcastReport[]> => this.db.broadcastReport.findMany(args),
		});
		const broadcastIds = [...new Set(page.items.map((report) => report.broadcastId))];
		const tenantIds = [...new Set(page.items.flatMap((report) => (report.tenantId === null ? [] : [report.tenantId])))];
		const [broadcasts, tenants] = await Promise.all([
			this.db.broadcast.findMany({ where: { id: { in: broadcastIds } }, select: { id: true, title: true } }),
			this.db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, displayName: true } }),
		]);
		const titles = new Map(broadcasts.map((broadcast) => [broadcast.id, broadcast.title]));
		const names = new Map(tenants.map((tenant) => [tenant.id, tenant.displayName]));
		const since = BigInt(now - BROADCAST_STRIKE_WINDOW_MS);
		const strikes = new Map<string, number>();
		for (const tenantId of tenantIds) {
			strikes.set(tenantId, await this.db.tenantBroadcastStrike.count({ where: { tenantId, issuedAt: { gte: since }, isDeleted: false } }));
		}
		return toPaginatedServiceResult(
			mapListResult(page, (report: BroadcastReport): BroadcastReportEntry => ({
				id: report.id,
				broadcastId: report.broadcastId,
				broadcastTitle: titles.get(report.broadcastId) ?? "",
				tenantId: report.tenantId,
				tenantName: report.tenantId === null ? null : (names.get(report.tenantId) ?? null),
				reason: BroadcastReportReasonSchema.parse(report.reason),
				note: report.note,
				status: BroadcastReportStatusSchema.parse(report.status),
				reviewedAt: report.reviewedAt === null ? null : epochMs(Number(report.reviewedAt)),
				tenantStrikesInWindow: report.tenantId === null ? 0 : (strikes.get(report.tenantId) ?? 0),
				createdAt: epochMs(Number(report.createdAt)),
				updatedAt: epochMs(Number(report.updatedAt)),
				isDeleted: report.isDeleted,
				deletedAt: report.deletedAt === null ? null : epochMs(Number(report.deletedAt)),
			})),
			query,
		);
	}

	public async reportTarget(reportId: string): Promise<{ readonly broadcastId: string; readonly tenantId: string | null } | null> {
		const report = await this.db.broadcastReport.findFirst({ where: { id: reportId, isDeleted: false }, select: { broadcastId: true, tenantId: true } });
		return report;
	}

	public async closeReports(broadcastId: string, status: "DISMISSED" | "UPHELD", reviewedBy: string, now: number): Promise<void> {
		await this.db.broadcastReport.updateMany({
			where: { broadcastId, status: "OPEN", isDeleted: false },
			data: { status, reviewedBy, reviewedAt: BigInt(now), updatedAt: BigInt(now) },
		});
	}

	public async addStrike(tenantId: string, broadcastId: string, issuedBy: string, now: number): Promise<void> {
		await this.db.tenantBroadcastStrike.createMany({
			data: [{ tenantId, broadcastId, issuedBy, issuedAt: BigInt(now), createdAt: BigInt(now), updatedAt: BigInt(now), createdBy: issuedBy }],
			skipDuplicates: true,
		});
	}

	public strikesSince(tenantId: string, since: number): Promise<number> {
		return this.db.tenantBroadcastStrike.count({ where: { tenantId, issuedAt: { gte: BigInt(since) }, isDeleted: false } });
	}

	public async disableTenantBroadcasting(tenantId: string, now: number): Promise<void> {
		await this.db.tenant.updateMany({ where: { id: tenantId, broadcastsDisabledAt: null }, data: { broadcastsDisabledAt: BigInt(now), updatedAt: BigInt(now) } });
	}

	public async pauseScheduledOfTenant(tenantId: string, reason: string, now: number): Promise<number> {
		const paused = await this.db.broadcast.updateMany({
			where: { tenantId, status: "SCHEDULED", isDeleted: false },
			data: { status: "PAUSED", pausedAt: BigInt(now), pauseReason: reason, updatedAt: BigInt(now) },
		});
		return paused.count;
	}

	public async customers(tenantId: string, query: TenantCustomerListQuery): Promise<PaginatedServiceResult<TenantCustomerEntry>> {
		const search =
			query.search === undefined || query.search.length === 0
				? Prisma.empty
				: Prisma.sql`AND (u."fullName" ILIKE ${`%${query.search}%`} OR u.email ILIKE ${`%${query.search}%`})`;
		const [sort] = tenantCustomerListQuery.resolveSort(query.sort).terms;
		const column = sort?.field ?? "lastClaimedAt";
		const direction = sort?.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
		const order = column === "firstClaimedAt" ? Prisma.sql`"firstClaimedAt"` : column === "claimCount" ? Prisma.sql`"claimCount"` : Prisma.sql`"lastClaimedAt"`;
		const offset = (query.page - 1) * query.limit;
		const base = Prisma.sql`
			SELECT * FROM (
				SELECT tc."userId" AS "userId", u."fullName" AS "fullName", u.email AS email,
				       tc."firstClaimedAt"::text AS "firstClaimedAt", tc."lastClaimedAt"::text AS "lastClaimedAt", tc."claimCount" AS "claimCount", tc."lastRedeemedAt"::text AS "lastRedeemedAt",
				       CASE
				         WHEN EXISTS (SELECT 1 FROM public."Membership" m WHERE m."tenantId" = tc."tenantId" AND m."userId" = tc."userId" AND m."isDeleted" = false) THEN 'staff'
				         WHEN EXISTS (SELECT 1 FROM public."TenantCustomerBan" b WHERE b."tenantId" = tc."tenantId" AND b."customerUserId" = tc."userId" AND b."isDeleted" = false AND b."liftedAt" IS NULL) THEN 'banned'
				         WHEN tc."leftAt" IS NOT NULL THEN 'left'
				         WHEN COALESCE((SELECT mc.granted FROM public."MarketingConsent" mc WHERE mc."userId" = tc."userId" AND mc.scope = 'TENANT' AND mc."tenantId" = tc."tenantId" ORDER BY mc."occurredAt" DESC LIMIT 1), false) = false THEN 'no-consent'
				       END AS "unreachableReason"
				FROM public."TenantCustomer" tc JOIN public."User" u ON u.id = tc."userId"
				WHERE tc."tenantId" = ${tenantId} AND tc."isDeleted" = false AND u."isDeleted" = false ${search}
			) customers`;
		const reachableOnly = query.reachableOnly === true || query.reachableOnly === "true";
		const filtered = reachableOnly ? Prisma.sql`${base} WHERE "unreachableReason" IS NULL` : base;
		const rows = z
			.array(CustomerRowSchema)
			.parse(await this.db.$queryRaw`${filtered} ORDER BY ${order} ${direction}, "userId" ${direction} LIMIT ${query.limit} OFFSET ${offset}`);
		const [{ n: total }] = z.tuple([CountSchema]).parse(await this.db.$queryRaw`SELECT COUNT(*)::int AS n FROM (${filtered}) counted`);
		const items = rows.map((row): TenantCustomerEntry => ({
			userId: row.userId,
			fullName: row.fullName,
			maskedEmail: row.email === null ? null : maskEmailAddress(row.email),
			firstClaimedAt: epochMs(Number(row.firstClaimedAt)),
			lastClaimedAt: epochMs(Number(row.lastClaimedAt)),
			claimCount: row.claimCount,
			lastRedeemedAt: row.lastRedeemedAt === null ? null : epochMs(Number(row.lastRedeemedAt)),
			unreachableReason: row.unreachableReason,
		}));
		const totalPages = Math.max(1, Math.ceil(total / query.limit));
		return { items, limit: query.limit, total, page: query.page, totalPages, nextCursor: null, hasNext: query.page < totalPages, hasPrevious: query.page > 1 };
	}
}
