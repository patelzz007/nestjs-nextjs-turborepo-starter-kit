import { Injectable } from "@nestjs/common";
import type { EmailLog as EmailLogRow, Prisma } from "@prisma/client";
import { emailLogListQuery, type EmailLogEntry, type EmailLogListQuery, type EmailLogListSortField, type PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaComparableFilter, toPrismaEqualityFilter, toPrismaStringFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { EmailLogReadPort } from "../../application/ports/email-log-read.port";
import { EMAIL_LOG_LIST_OPERATION } from "../../application/ports/notifications.tokens";
import { toEmailLogEntry } from "./email-log.mapper";

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const EMAIL_LOG_SORT_COLUMNS: SortColumns<EmailLogListSortField, Prisma.EmailLogOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	subject: (direction) => ({ subject: direction }),
	to: (direction) => ({ to: direction }),
	status: (direction) => ({ status: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const EMAIL_LOG_LIST_KEYSET: ListKeyset<EmailLogRow, Prisma.EmailLogWhereInput> = timestampIdKeyset(
	(row: EmailLogRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.EmailLogWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** The filter AST + search (recipient / subject / template), one explicit column per whitelisted field. */
export function buildEmailLogListWhere(query: EmailLogListQuery): Prisma.EmailLogWhereInput {
	const filter = query.filter;
	return {
		AND: [
			...fieldWhere(toPrismaEqualityFilter(filter?.status), (status) => ({ status })),
			...fieldWhere(toPrismaStringFilter(filter?.templateKey), (templateKey) => ({ templateKey })),
			...fieldWhere(toPrismaComparableFilter(filter?.createdAt), (createdAt) => ({ createdAt })),
			...(query.search !== undefined
				? [
						{
							OR: [
								{ to: { contains: query.search, mode: "insensitive" } },
								{ subject: { contains: query.search, mode: "insensitive" } },
								{ templateKey: { contains: query.search, mode: "insensitive" } },
							],
						} satisfies Prisma.EmailLogWhereInput,
					]
				: []),
		],
	};
}

export function buildEmailLogListOrder(query: EmailLogListQuery): ListOrder<Prisma.EmailLogOrderByWithRelationInput> {
	return buildListOrder(emailLogListQuery.resolveSort(query.sort), {
		columns: EMAIL_LOG_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/**
 * The admin email log projection. `EmailLog` SELECT is bypass-only, so the list
 * runs as `notifications.email_log.list` (that table alone) after the EMAIL
 * permission check. One count + one page query per request, whatever the page size (no N+1).
 */
@Injectable()
export class PrismaEmailLogReadRepository implements EmailLogReadPort {
	private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>;

	public constructor(transactions: TenantTransactionService) {
		this.reads = new PrismaReadExecutor(transactions);
	}

	public async list(actor: ActorContext, query: EmailLogListQuery): Promise<PaginatedServiceResult<EmailLogEntry>> {
		const result = await this.reads.readAsSystemOperation(EMAIL_LOG_LIST_OPERATION, actor, async (db) =>
			fetchListPage(query, {
				where: buildEmailLogListWhere(query),
				order: buildEmailLogListOrder(query),
				keyset: EMAIL_LOG_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.emailLog.count({ where }),
				findMany: (args) => db.emailLog.findMany(args),
			}),
		);
		return toPaginatedServiceResult(mapListResult(result, toEmailLogEntry), query);
	}
}
