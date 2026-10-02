import { Injectable } from "@nestjs/common";
import type { EmailLog, Prisma } from "@prisma/client";

import { emailLogListQuery, type EmailLogCreate, type EmailLogListQuery, type EmailLogListSortField, type EmailLogStatus } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaComparableFilter, toPrismaEqualityFilter, toPrismaStringFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

// ── List query → Prisma (explicit field → column mapping; see docs/list-queries.md) ──

const EMAIL_LOG_SORT_COLUMNS: SortColumns<EmailLogListSortField, Prisma.EmailLogOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	subject: (direction) => ({ subject: direction }),
	to: (direction) => ({ to: direction }),
	status: (direction) => ({ status: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const EMAIL_LOG_LIST_KEYSET: ListKeyset<EmailLog, Prisma.EmailLogWhereInput> = timestampIdKeyset(
	(row: EmailLog) => ({ at: Number(row.createdAt), id: row.id }),
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

@Injectable()
export class EmailLogRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Insert the row, then run `withinTransaction` (the caller's outbox event)
	 * in the same transaction — the row and its event commit or roll back together.
	 */
	public async create(input: EmailLogCreate, withinTransaction: (tx: Prisma.TransactionClient) => Promise<void>): Promise<{ readonly id: string }> {
		return this.prisma.$transaction(async (tx): Promise<{ readonly id: string }> => {
			const row = await tx.emailLog.create({
				data: {
					templateKey: input.templateKey,
					to: input.to,
					subject: input.subject,
					status: input.status,
					...(input.resendId === undefined ? {} : { resendId: input.resendId }),
					...(input.error === undefined ? {} : { error: input.error }),
					...(input.metadata === undefined ? {} : { metadata: input.metadata }),
				},
				select: { id: true },
			});
			await withinTransaction(tx);
			return { id: row.id };
		});
	}

	public async updateStatusByResendId(resendId: string, status: EmailLogStatus, allowedCurrentStatuses: readonly EmailLogStatus[], error?: string): Promise<number> {
		const result = await this.prisma.emailLog.updateMany({
			where: { resendId, status: { in: [...allowedCurrentStatuses] } },
			// An absent `error` leaves the stored error untouched.
			data: { status, ...(error === undefined ? {} : { error }), updatedAt: Date.now() },
		});
		return result.count;
	}

	public async countByResendId(resendId: string): Promise<number> {
		return this.prisma.emailLog.count({ where: { resendId } });
	}

	/** One page of email-log rows for the (already validated) list query. */
	public async list(query: EmailLogListQuery): Promise<RepositoryListResult<EmailLog>> {
		return fetchListPage(query, {
			where: buildEmailLogListWhere(query),
			order: buildEmailLogListOrder(query),
			keyset: EMAIL_LOG_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.emailLog.count({ where }),
			findMany: (args) => this.prisma.emailLog.findMany(args),
		});
	}
}
