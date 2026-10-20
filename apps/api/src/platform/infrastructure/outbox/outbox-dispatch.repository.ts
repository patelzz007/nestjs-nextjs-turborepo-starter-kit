import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { JsonValueSchema, NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE } from "@workspace/shared";

import type { SystemDatabaseContext } from "../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { ClaimedOutboxRow, OutboxBacklog, OutboxClaimRoute, OutboxDispatchStore } from "./outbox-dispatcher";
import type { OutboxEmailRelayStore } from "./outbox-email-relay";
import { OUTBOX_PUBLISH_OPERATION } from "./outbox-operations";

/** `OutboxEvent.lastError` is TEXT; bound what we store so one huge broker error cannot bloat rows. */
const OUTBOX_LAST_ERROR_MAX_LENGTH = 4_000;

const ClaimedOutboxRowSchema = z
	.object({
		id: z.string().min(1),
		topic: z.string(),
		partitionKey: z.string().nullable(),
		attempts: z.number().int().nonnegative(),
		payload: JsonValueSchema,
		createdAt: z.bigint(),
	})
	.strict();

const OutboxBacklogRowSchema = z
	.object({
		pendingCount: z.bigint(),
		oldestPendingCreatedAt: z.bigint().nullable(),
		deadLetteredCount: z.bigint(),
	})
	.strict();

interface OutboxPublishTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * Persistence for the outbox dispatcher. Every method runs as `outbox.publish`
 * — `OutboxEvent` reads and updates are bypass-only under RLS.
 */
@Injectable()
export class OutboxDispatchRepository implements OutboxDispatchStore, OutboxEmailRelayStore {
	public constructor(@Inject(TenantTransactionService) private readonly transactions: OutboxPublishTransactions) {}

	private run<TResult>(reason: string, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withSystemOperation({ operation: OUTBOX_PUBLISH_OPERATION, reason, actorUserId: null }, work);
	}

	/**
	 * Claim up to `limit` due PENDING rows by pushing their `availableAt` past
	 * a lease. `FOR UPDATE SKIP LOCKED` lets several API instances sweep
	 * concurrently without claiming the same row; a worker that dies mid-publish
	 * simply lets the lease lapse and the row is claimed again (at-least-once).
	 */
	public async claimDue(limit: number, nowMs: number, leaseMs: number, route: OutboxClaimRoute = "any"): Promise<readonly ClaimedOutboxRow[]> {
		const leaseUntil = nowMs + leaseMs;
		const rows = await this.run(
			"Claim due outbox rows",
			(tx) => tx.$queryRaw`
			WITH due AS (
				SELECT id
				FROM public."OutboxEvent"
				WHERE status = 'PENDING' AND "availableAt" <= ${nowMs}::bigint ${routeFilter(route)}
				ORDER BY "createdAt" ASC, id ASC
				LIMIT ${limit}
				FOR UPDATE SKIP LOCKED
			)
			UPDATE public."OutboxEvent" AS o
			SET "availableAt" = ${leaseUntil}::bigint, "updatedAt" = ${nowMs}::bigint
			FROM due
			WHERE o.id = due.id
			RETURNING o.id, o.topic, o."partitionKey" AS "partitionKey", o.attempts, o.payload, o."createdAt" AS "createdAt"`,
		);

		return z
			.array(ClaimedOutboxRowSchema)
			.parse(rows)
			.sort((left, right) => (left.createdAt === right.createdAt ? left.id.localeCompare(right.id) : left.createdAt < right.createdAt ? -1 : 1))
			.map(toClaimedRow);
	}

	/**
	 * Claims ONE due PENDING email-request row by id (the after-commit nudge,
	 * ADR 060). `SKIP LOCKED` plus the lease make a nudge and a concurrent sweep
	 * race safely: exactly one of them gets the row, the other gets `null`.
	 */
	public async claimById(id: string, nowMs: number, leaseMs: number): Promise<ClaimedOutboxRow | null> {
		const leaseUntil = nowMs + leaseMs;
		const rows = await this.run(
			"Claim one due email outbox row",
			(tx) => tx.$queryRaw`
			WITH due AS (
				SELECT id
				FROM public."OutboxEvent"
				WHERE id = ${id} AND status = 'PENDING' AND "availableAt" <= ${nowMs}::bigint AND "eventType" = ${NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE}
				FOR UPDATE SKIP LOCKED
			)
			UPDATE public."OutboxEvent" AS o
			SET "availableAt" = ${leaseUntil}::bigint, "updatedAt" = ${nowMs}::bigint
			FROM due
			WHERE o.id = due.id
			RETURNING o.id, o.topic, o."partitionKey" AS "partitionKey", o.attempts, o.payload, o."createdAt" AS "createdAt"`,
		);
		const [row] = z.array(ClaimedOutboxRowSchema).max(1).parse(rows);
		return row === undefined ? null : toClaimedRow(row);
	}

	public async markPublished(ids: readonly string[], nowMs: number): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		await this.run("Mark published outbox rows", (tx) =>
			tx.outboxEvent.updateMany({
				where: { id: { in: [...ids] }, status: "PENDING" },
				data: { status: "PUBLISHED", publishedAt: nowMs, lastError: null, updatedAt: nowMs },
			}),
		);
	}

	public async scheduleRetry(id: string, attempts: number, error: string, availableAtMs: number, nowMs: number): Promise<void> {
		await this.run("Schedule an outbox retry", (tx) =>
			tx.outboxEvent.updateMany({
				where: { id, status: "PENDING" },
				data: { attempts, lastError: error.slice(0, OUTBOX_LAST_ERROR_MAX_LENGTH), availableAt: availableAtMs, updatedAt: nowMs },
			}),
		);
	}

	public async release(ids: readonly string[], availableAtMs: number, nowMs: number): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		await this.run("Release claimed outbox rows", (tx) =>
			tx.outboxEvent.updateMany({
				where: { id: { in: [...ids] }, status: "PENDING" },
				data: { availableAt: availableAtMs, updatedAt: nowMs },
			}),
		);
	}

	public async markDeadLettered(id: string, attempts: number, error: string, nowMs: number): Promise<void> {
		await this.run("Dead-letter an outbox row", (tx) =>
			tx.outboxEvent.updateMany({
				where: { id, status: "PENDING" },
				data: { status: "FAILED", attempts, lastError: error.slice(0, OUTBOX_LAST_ERROR_MAX_LENGTH), updatedAt: nowMs },
			}),
		);
	}

	public async readBacklog(): Promise<OutboxBacklog> {
		const rows = await this.run(
			"Read the outbox backlog",
			(tx) => tx.$queryRaw`
			SELECT
				COUNT(*) FILTER (WHERE status = 'PENDING') AS "pendingCount",
				MIN("createdAt") FILTER (WHERE status = 'PENDING') AS "oldestPendingCreatedAt",
				COUNT(*) FILTER (WHERE status = 'FAILED') AS "deadLetteredCount"
			FROM public."OutboxEvent"`,
		);
		const [row] = z.tuple([OutboxBacklogRowSchema]).parse(rows);
		return {
			pendingCount: Number(row.pendingCount),
			oldestPendingCreatedAt: row.oldestPendingCreatedAt === null ? null : Number(row.oldestPendingCreatedAt),
			deadLetteredCount: Number(row.deadLetteredCount),
		};
	}
}

function toClaimedRow(row: z.output<typeof ClaimedOutboxRowSchema>): ClaimedOutboxRow {
	return { id: row.id, topic: row.topic, partitionKey: row.partitionKey, attempts: row.attempts, payload: row.payload };
}

/** The SQL condition that keeps one relay's claim on its own route (see {@link OutboxClaimRoute}). */
function routeFilter(route: OutboxClaimRoute): Prisma.Sql {
	switch (route) {
		case "any":
			return Prisma.empty;
		case "kafka":
			return Prisma.sql`AND "eventType" <> ${NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE}`;
		case "email":
			return Prisma.sql`AND "eventType" = ${NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE}`;
	}
}
