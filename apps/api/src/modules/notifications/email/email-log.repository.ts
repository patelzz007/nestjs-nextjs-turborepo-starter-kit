import { Injectable } from "@nestjs/common";
import { Prisma, type EmailLog } from "@prisma/client";

import {
	emailLogListQuery,
	EmailLogStatusSchema,
	type DeliveryEventOutcome,
	type EmailLogCreate,
	type EmailLogListQuery,
	type EmailLogListSortField,
	type EmailLogStatus,
} from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaComparableFilter, toPrismaEqualityFilter, toPrismaStringFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";

/** Allowlisted system operation for every email_logs / email_delivery_events write (bypass-only updates). */
export const EMAIL_LOG_WRITE_OPERATION = "email.log.write";

/** Prisma: unique constraint violated. */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/** `email_logs.error` is TEXT; bound what we store so one huge provider error cannot bloat rows. */
const EMAIL_LOG_ERROR_MAX_LENGTH = 2_000;

/** The transaction client a write callback receives (the outbox event is appended on it). */
export type EmailLogTransaction = Parameters<Parameters<TenantTransactionService["withSystemOperation"]>[1]>[0];

/** One verified delivery-webhook event, ready to record. */
export interface DeliveryEventRecord {
	/** The signed `webhook-id` header — unique per delivery, the dedupe key. */
	readonly webhookId: string;
	readonly eventType: string;
	readonly resendId: string;
	/** The `email_log_id` tag set at send time, when the event carries it. */
	readonly taggedEmailLogId: string | undefined;
	/** The status the event maps to; `undefined` for events the log ignores (tracking). */
	readonly status: EmailLogStatus | undefined;
	/** Statuses the row may be in for `status` to apply (forward transitions only). */
	readonly allowedFrom: readonly EmailLogStatus[];
	readonly detail: string | undefined;
	/** Epoch ms when the provider observed the event. */
	readonly occurredAt: number;
}

/** Result of recording a delivery event: its outcome, or `duplicate` when this webhook id was already recorded. */
export type DeliveryEventRecordResult = { readonly kind: "recorded"; readonly outcome: DeliveryEventOutcome } | { readonly kind: "duplicate" };

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

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

/**
 * Persistence for the outbound-email lifecycle. Every write runs in its own
 * `email.log.write` system-operation transaction (updates and the delivery
 * event table are bypass-only under RLS), and every status change is a
 * CONDITIONAL update, so concurrent writers (a redelivered queue job, a
 * webhook racing the send outcome) can never double-apply.
 */
@Injectable()
export class EmailLogRepository {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly transactions: TenantTransactionService,
	) {}

	/**
	 * Insert an attempt row, then run `withinTransaction` (e.g. the caller's
	 * outbox event) in the same transaction — both commit or neither does.
	 */
	public async create(input: EmailLogCreate, withinTransaction: (tx: EmailLogTransaction) => Promise<void>): Promise<{ readonly id: string }> {
		return this.write("Record an outbound email attempt", async (tx): Promise<{ readonly id: string }> => {
			const row = await tx.emailLog.create({
				data: {
					templateKey: input.templateKey,
					to: input.to,
					subject: input.subject,
					status: input.status,
					...(input.resendId === undefined ? {} : { resendId: input.resendId }),
					...(input.error === undefined ? {} : { error: boundError(input.error) }),
					...(input.metadata === undefined ? {} : { metadata: input.metadata }),
				},
				select: { id: true },
			});
			await withinTransaction(tx);
			return { id: row.id };
		});
	}

	/** Current status of one row, or `null` when it does not exist. */
	public async findStatus(id: string): Promise<EmailLogStatus | null> {
		return this.write("Read an email attempt's status", async (tx): Promise<EmailLogStatus | null> => {
			const row = await tx.emailLog.findUnique({ where: { id }, select: { status: true } });
			return row === null ? null : parseStoredStatus(row.status);
		});
	}

	/**
	 * Record a successful provider send. Moves `pending → sent` and stores the
	 * provider id; when a webhook already advanced the row (it can arrive
	 * before the send call returns), only the missing provider id is stored.
	 * `onFinalized` runs (same transaction) only for the writer that actually
	 * finalized the attempt — a duplicate finalize is a no-op returning false.
	 */
	public async finalizeSent(id: string, resendId: string, onFinalized: (tx: EmailLogTransaction) => Promise<void>): Promise<boolean> {
		return this.write("Record an email send success", async (tx): Promise<boolean> => {
			const now = Date.now();
			const moved = await tx.emailLog.updateMany({ where: { id, status: "pending" }, data: { status: "sent", resendId, updatedAt: now } });
			const finalized =
				moved.count > 0 ? true : (await tx.emailLog.updateMany({ where: { id, resendId: null, status: { not: "failed" } }, data: { resendId, updatedAt: now } })).count > 0;
			if (finalized) {
				await onFinalized(tx);
			}
			return finalized;
		});
	}

	/** Record a final send failure (`pending → failed`). Same once-only contract as {@link finalizeSent}. */
	public async finalizeFailed(id: string, error: string, onFinalized: (tx: EmailLogTransaction) => Promise<void>): Promise<boolean> {
		return this.write("Record an email send failure", async (tx): Promise<boolean> => {
			const moved = await tx.emailLog.updateMany({ where: { id, status: "pending" }, data: { status: "failed", error: boundError(error), updatedAt: Date.now() } });
			if (moved.count > 0) {
				await onFinalized(tx);
			}
			return moved.count > 0;
		});
	}

	/**
	 * Record one verified delivery-webhook event and apply it to its row, in
	 * ONE transaction:
	 *
	 * - the row is matched by the `email_log_id` tag, else by provider id;
	 * - the status is applied only when the transition is forward-allowed AND
	 *   the event is not older than the newest event already applied
	 *   (`last_event_at`) — so a late, older event never overrides a newer one;
	 * - the event row is inserted with its outcome (history). Its `webhook_id`
	 *   is UNIQUE: a redelivered webhook rolls the whole transaction back and
	 *   reports `duplicate`, so it can never apply twice.
	 */
	public async recordDeliveryEvent(event: DeliveryEventRecord): Promise<DeliveryEventRecordResult> {
		try {
			const outcome = await this.write("Apply a verified delivery webhook event", async (tx): Promise<DeliveryEventOutcome> => {
				const target = await this.findWebhookTarget(tx, event);
				const outcome: DeliveryEventOutcome = await this.applyDeliveryEvent(tx, target, event);
				await tx.emailDeliveryEvent.create({
					data: {
						webhookId: event.webhookId,
						eventType: event.eventType,
						resendId: event.resendId,
						emailLogId: target?.id ?? null,
						status: event.status ?? null,
						detail: event.detail ?? null,
						occurredAt: event.occurredAt,
						outcome,
					},
				});
				return outcome;
			});
			return { kind: "recorded", outcome };
		} catch (error) {
			const uniqueViolation = error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION;
			if (uniqueViolation && (await this.isRecordedWebhook(event.webhookId))) {
				return { kind: "duplicate" };
			}
			throw error;
		}
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

	private async findWebhookTarget(tx: EmailLogTransaction, event: DeliveryEventRecord): Promise<{ readonly id: string } | null> {
		if (event.taggedEmailLogId !== undefined) {
			const tagged = await tx.emailLog.findUnique({ where: { id: event.taggedEmailLogId }, select: { id: true } });
			if (tagged !== null) {
				return tagged;
			}
		}
		return tx.emailLog.findFirst({ where: { resendId: event.resendId }, select: { id: true } });
	}

	private async applyDeliveryEvent(tx: EmailLogTransaction, target: { readonly id: string } | null, event: DeliveryEventRecord): Promise<DeliveryEventOutcome> {
		if (target === null) {
			return "unmatched";
		}
		if (event.status === undefined) {
			return "ignored";
		}
		const occurredAt = BigInt(event.occurredAt);
		const applied = await tx.emailLog.updateMany({
			where: {
				id: target.id,
				status: { in: [...event.allowedFrom] },
				OR: [{ lastEventAt: null }, { lastEventAt: { lte: occurredAt } }],
			},
			data: {
				status: event.status,
				lastEventAt: occurredAt,
				// The webhook may arrive before the send call returned: fill the provider id it names.
				resendId: event.resendId,
				...(event.detail === undefined ? {} : { error: boundError(event.detail) }),
				updatedAt: Date.now(),
			},
		});
		return applied.count > 0 ? "applied" : "stale";
	}

	private async isRecordedWebhook(webhookId: string): Promise<boolean> {
		return this.write("Check a delivery webhook id", async (tx): Promise<boolean> => (await tx.emailDeliveryEvent.count({ where: { webhookId } })) > 0);
	}

	private async write<T>(reason: string, handler: (tx: EmailLogTransaction) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation({ operation: EMAIL_LOG_WRITE_OPERATION, reason, actorUserId: null }, handler);
	}
}

function boundError(error: string): string {
	return error.slice(0, EMAIL_LOG_ERROR_MAX_LENGTH);
}

/** `email_logs.status` is a text column written only through EmailLogStatus — parse it back at the boundary. */
function parseStoredStatus(status: string): EmailLogStatus {
	return EmailLogStatusSchema.parse(status);
}
