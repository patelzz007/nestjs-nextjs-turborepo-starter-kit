// ============================================
// prisma-docs-sync-run.repository.ts - The sync run log (ADR 084)
// ============================================
// `DocsSyncRun` is bypass-only platform plumbing, reached through `docs_publishing.record` (the sync's reports,
// the retention prune) and `docs_publishing.read` (the console, after its DOCS_SYNC check).

import { Injectable } from "@nestjs/common";
import type { DocsSyncRun as DocsSyncRunRow, Prisma } from "@prisma/client";
import {
	DocsSyncHeldBackPageSchema,
	DocsSyncRunDetailSchema,
	docsSyncRunListQuery,
	DocsSyncRunSummarySchema,
	epochMs,
	type DocsSyncRunDetail,
	type DocsSyncRunListQuery,
	type DocsSyncRunListSortField,
	type DocsSyncRunReport,
	type DocsSyncRunSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { PrismaReadExecutor } from "../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import {
	DOCS_PUBLISHING_READ_OPERATION,
	DOCS_PUBLISHING_RECORD_OPERATION,
	type DocsSyncRunReadPort,
	type DocsSyncRunStorePort,
	type RecordedRun,
} from "../application/ports/docs-publishing.ports";

const SORT_COLUMNS: SortColumns<DocsSyncRunListSortField, Prisma.DocsSyncRunOrderByWithRelationInput> = {
	startedAt: (direction) => ({ startedAt: direction }),
};

/** Keyset for the default order (`startedAt desc, id desc`). */
const LIST_KEYSET: ListKeyset<DocsSyncRunRow, Prisma.DocsSyncRunWhereInput> = timestampIdKeyset(
	(row: DocsSyncRunRow) => ({ at: Number(row.startedAt), id: row.id }),
	({ at, id }): Prisma.DocsSyncRunWhereInput => ({ OR: [{ startedAt: { lt: at } }, { startedAt: at, id: { lt: id } }] }),
);

const DeletedCountSchema = z.number().int().nonnegative();
const HeldBackListSchema = z.array(DocsSyncHeldBackPageSchema);
const NEWEST_FIRST: Prisma.DocsSyncRunOrderByWithRelationInput[] = [{ startedAt: "desc" }, { id: "desc" }];

export function buildDocsSyncRunListWhere(query: DocsSyncRunListQuery): Prisma.DocsSyncRunWhereInput {
	const filter = query.filter;
	return {
		AND: [
			...fieldWhere(toPrismaEqualityFilter(filter?.status), (status) => ({ status })),
			...fieldWhere(toPrismaEqualityFilter(filter?.trigger), (trigger) => ({ trigger })),
			...fieldWhere(toPrismaEqualityFilter(filter?.source), (source) => ({ source })),
		],
	};
}

export function buildDocsSyncRunListOrder(query: DocsSyncRunListQuery): ListOrder<Prisma.DocsSyncRunOrderByWithRelationInput> {
	return buildListOrder(docsSyncRunListQuery.resolveSort(query.sort), { columns: SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

/** Row → the list contract. */
export function toDocsSyncRunSummary(row: DocsSyncRunRow): DocsSyncRunSummary {
	return DocsSyncRunSummarySchema.parse({
		id: row.id,
		runId: row.runId,
		source: row.source,
		trigger: row.trigger,
		status: row.status,
		converterVersion: row.converterVersion,
		pagesProcessed: row.pagesProcessed,
		pagesUnchanged: row.pagesUnchanged,
		pagesRemoved: row.pagesRemoved,
		pagesHeldBack: row.pagesHeldBack,
		warnings: row.warnings,
		errorSummary: row.errorSummary,
		pullRequestUrl: row.pullRequestUrl,
		commitSha: row.commitSha,
		startedAt: epochMs(Number(row.startedAt)),
		finishedAt: epochMs(Number(row.finishedAt)),
	});
}

/** Row → the detail contract. The stored JSON is re-validated: a row is never trusted to be well-formed. */
export function toDocsSyncRunDetail(row: DocsSyncRunRow): DocsSyncRunDetail {
	return DocsSyncRunDetailSchema.parse({ ...toDocsSyncRunSummary(row), heldBack: HeldBackListSchema.parse(row.heldBack) });
}

function rowOf(report: DocsSyncRunReport): Omit<Prisma.DocsSyncRunCreateInput, "runId"> {
	return {
		source: report.source,
		trigger: report.trigger,
		status: report.status,
		converterVersion: report.converterVersion,
		pagesProcessed: report.pagesProcessed,
		pagesUnchanged: report.pagesUnchanged,
		pagesRemoved: report.pagesRemoved,
		pagesHeldBack: report.pagesHeldBack,
		warnings: report.warnings,
		heldBack: report.heldBack,
		errorSummary: report.errorSummary,
		pullRequestUrl: report.pullRequestUrl,
		commitSha: report.commitSha,
		startedAt: BigInt(report.startedAt),
		finishedAt: BigInt(report.finishedAt),
	};
}

@Injectable()
export class PrismaDocsSyncRunRepository implements DocsSyncRunStorePort, DocsSyncRunReadPort {
	private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>;

	public constructor(private readonly tenantTx: TenantTransactionService) {
		this.reads = new PrismaReadExecutor(tenantTx);
	}

	public async record(report: DocsSyncRunReport): Promise<RecordedRun> {
		return this.tenantTx.withSystemOperation(
			{ operation: DOCS_PUBLISHING_RECORD_OPERATION, reason: "Record a docs sync run", actorUserId: null },
			async (tx): Promise<RecordedRun> => {
				const existing = await tx.docsSyncRun.findUnique({ where: { runId: report.runId }, select: { id: true } });
				const previous = await tx.docsSyncRun.findFirst({ where: { runId: { not: report.runId } }, orderBy: NEWEST_FIRST, select: { status: true } });
				const row = rowOf(report);
				await tx.docsSyncRun.upsert({ where: { runId: report.runId }, create: { runId: report.runId, ...row }, update: row, select: { id: true } });
				return { isNew: existing === null, previousStatus: previous?.status ?? null };
			},
		);
	}

	public async prune(beforeMs: number): Promise<number> {
		return this.tenantTx.withSystemOperation(
			{ operation: DOCS_PUBLISHING_RECORD_OPERATION, reason: "Prune docs sync runs past their retention", actorUserId: null },
			async (tx) => DeletedCountSchema.parse((await tx.docsSyncRun.deleteMany({ where: { startedAt: { lt: BigInt(beforeMs) } } })).count),
		);
	}

	public async list(actor: ActorContext, query: DocsSyncRunListQuery): Promise<PaginatedServiceResult<DocsSyncRunSummary>> {
		const result = await this.reads.readAsSystemOperation(DOCS_PUBLISHING_READ_OPERATION, actor, async (db) =>
			fetchListPage(query, {
				where: buildDocsSyncRunListWhere(query),
				order: buildDocsSyncRunListOrder(query),
				keyset: LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.docsSyncRun.count({ where }),
				findMany: (args) => db.docsSyncRun.findMany(args),
			}),
		);
		return toPaginatedServiceResult(mapListResult(result, toDocsSyncRunSummary), query);
	}

	public async findById(actor: ActorContext, id: string): Promise<DocsSyncRunDetail | null> {
		const row = await this.reads.readAsSystemOperation(DOCS_PUBLISHING_READ_OPERATION, actor, async (db) => db.docsSyncRun.findUnique({ where: { id } }));
		return row === null ? null : toDocsSyncRunDetail(row);
	}

	public async latest(actor: ActorContext): Promise<{ readonly latestRun: DocsSyncRunSummary | null; readonly latestGoodRun: DocsSyncRunSummary | null }> {
		return this.reads.readAsSystemOperation(DOCS_PUBLISHING_READ_OPERATION, actor, async (db) => {
			const latestRun = await db.docsSyncRun.findFirst({ orderBy: NEWEST_FIRST });
			const latestGoodRun = await db.docsSyncRun.findFirst({ where: { status: "SUCCEEDED" }, orderBy: NEWEST_FIRST });
			return { latestRun: latestRun === null ? null : toDocsSyncRunSummary(latestRun), latestGoodRun: latestGoodRun === null ? null : toDocsSyncRunSummary(latestGoodRun) };
		});
	}
}
