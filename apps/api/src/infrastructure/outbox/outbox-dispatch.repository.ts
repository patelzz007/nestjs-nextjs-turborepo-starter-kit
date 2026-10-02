import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { JsonValueSchema } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service";
import type { ClaimedOutboxRow, OutboxBacklog, OutboxDispatchStore } from "./outbox-dispatcher";

/** `outbox_events.last_error` is TEXT; bound what we store so one huge broker error cannot bloat rows. */
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

/**
 * Persistence for the outbox dispatcher. Every method must run inside the
 * `outbox.publish` system operation (bypass session) — `outbox_events` reads
 * and updates are bypass-only under RLS.
 */
@Injectable()
export class OutboxDispatchRepository implements OutboxDispatchStore {
	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Claim up to `limit` due PENDING rows by pushing their `available_at` past
	 * a lease. `FOR UPDATE SKIP LOCKED` lets several API instances sweep
	 * concurrently without claiming the same row; a worker that dies mid-publish
	 * simply lets the lease lapse and the row is claimed again (at-least-once).
	 */
	public async claimDue(limit: number, nowMs: number, leaseMs: number): Promise<readonly ClaimedOutboxRow[]> {
		const leaseUntil = nowMs + leaseMs;
		const rows = await this.prisma.$queryRaw`
			WITH due AS (
				SELECT id
				FROM public.outbox_events
				WHERE status = 'PENDING' AND available_at <= ${nowMs}::bigint
				ORDER BY created_at ASC, id ASC
				LIMIT ${limit}
				FOR UPDATE SKIP LOCKED
			)
			UPDATE public.outbox_events AS o
			SET available_at = ${leaseUntil}::bigint, updated_at = ${nowMs}::bigint
			FROM due
			WHERE o.id = due.id
			RETURNING o.id, o.topic, o.partition_key AS "partitionKey", o.attempts, o.payload, o.created_at AS "createdAt"`;

		return z
			.array(ClaimedOutboxRowSchema)
			.parse(rows)
			.sort((left, right) => (left.createdAt === right.createdAt ? left.id.localeCompare(right.id) : left.createdAt < right.createdAt ? -1 : 1))
			.map((row) => ({ id: row.id, topic: row.topic, partitionKey: row.partitionKey, attempts: row.attempts, payload: row.payload }));
	}

	public async markPublished(id: string, nowMs: number): Promise<void> {
		await this.prisma.outboxEvent.updateMany({
			where: { id, status: "PENDING" },
			data: { status: "PUBLISHED", publishedAt: nowMs, lastError: null, updatedAt: nowMs },
		});
	}

	public async scheduleRetry(id: string, attempts: number, error: string, availableAtMs: number, nowMs: number): Promise<void> {
		await this.prisma.outboxEvent.updateMany({
			where: { id, status: "PENDING" },
			data: { attempts, lastError: error.slice(0, OUTBOX_LAST_ERROR_MAX_LENGTH), availableAt: availableAtMs, updatedAt: nowMs },
		});
	}

	public async release(ids: readonly string[], availableAtMs: number, nowMs: number): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		await this.prisma.outboxEvent.updateMany({
			where: { id: { in: [...ids] }, status: "PENDING" },
			data: { availableAt: availableAtMs, updatedAt: nowMs },
		});
	}

	public async markDeadLettered(id: string, attempts: number, error: string, nowMs: number): Promise<void> {
		await this.prisma.outboxEvent.updateMany({
			where: { id, status: "PENDING" },
			data: { status: "FAILED", attempts, lastError: error.slice(0, OUTBOX_LAST_ERROR_MAX_LENGTH), updatedAt: nowMs },
		});
	}

	public async readBacklog(): Promise<OutboxBacklog> {
		const rows = await this.prisma.$queryRaw`
			SELECT
				COUNT(*) FILTER (WHERE status = 'PENDING') AS "pendingCount",
				MIN(created_at) FILTER (WHERE status = 'PENDING') AS "oldestPendingCreatedAt",
				COUNT(*) FILTER (WHERE status = 'FAILED') AS "deadLetteredCount"
			FROM public.outbox_events`;
		const [row] = z.tuple([OutboxBacklogRowSchema]).parse(rows);
		return {
			pendingCount: Number(row.pendingCount),
			oldestPendingCreatedAt: row.oldestPendingCreatedAt === null ? null : Number(row.oldestPendingCreatedAt),
			deadLetteredCount: Number(row.deadLetteredCount),
		};
	}
}
