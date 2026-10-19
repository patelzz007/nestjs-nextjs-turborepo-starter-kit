import type { Prisma } from "@prisma/client";
import { nowEpochMs, type DeliveryEventOutcome, type EmailLogCreate } from "@workspace/shared";

import type { EmailLog } from "../../domain/aggregates/email-log.aggregate";
import type { DeliveryEventRecord, DeliveryEventRecordResult, EmailLogRepository } from "../../domain/repositories/email-log.repository";
import { toEmailLog } from "./email-log.mapper";

/** `EmailLog.error` is TEXT; bound what we store so one huge provider error cannot bloat rows. */
const EMAIL_LOG_ERROR_MAX_LENGTH = 2_000;

/** The outcome stored while the event row is inserted first; replaced in the same transaction once the event is applied. */
const PROVISIONAL_OUTCOME: DeliveryEventOutcome = "ignored";

function boundError(error: string): string {
	return error.slice(0, EMAIL_LOG_ERROR_MAX_LENGTH);
}

/**
 * {@link EmailLogRepository} bound to ONE transaction client (a fresh instance
 * per unit of work, never cached). Every status change is a conditional update.
 */
export class PrismaEmailLogRepository implements EmailLogRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/** `createMany` (no RETURNING): `EmailLog` INSERT is open to every session, SELECT is bypass-only. */
	public async insert(id: string, input: EmailLogCreate): Promise<void> {
		await this.db.emailLog.createMany({
			data: [
				{
					id,
					templateKey: input.templateKey,
					to: input.to,
					subject: input.subject,
					status: input.status,
					...(input.resendId === undefined ? {} : { resendId: input.resendId }),
					...(input.error === undefined ? {} : { error: boundError(input.error) }),
					...(input.metadata === undefined ? {} : { metadata: input.metadata }),
				},
			],
		});
	}

	public async findById(id: string): Promise<EmailLog | null> {
		const row = await this.db.emailLog.findUnique({ where: { id }, select: { id: true, templateKey: true, to: true, status: true } });
		return row === null ? null : toEmailLog(row);
	}

	public async finalizeSent(log: EmailLog, resendId: string | null): Promise<boolean> {
		const now = nowEpochMs();
		const moved = await this.db.emailLog.updateMany({ where: { id: log.id, status: log.concurrencyToken }, data: { status: "sent", resendId, updatedAt: now } });
		if (moved.count > 0) {
			return true;
		}
		// A webhook can advance the row before the send call returns: only the missing provider id is left to store.
		// Without a provider id (Mailpit) there is nothing to store.
		if (resendId === null) {
			return false;
		}
		const filled = await this.db.emailLog.updateMany({ where: { id: log.id, resendId: null, status: { not: "failed" } }, data: { resendId, updatedAt: now } });
		return filled.count > 0;
	}

	public async finalizeFailed(log: EmailLog, error: string): Promise<boolean> {
		const moved = await this.db.emailLog.updateMany({
			where: { id: log.id, status: log.concurrencyToken },
			data: { status: "failed", error: boundError(error), updatedAt: nowEpochMs() },
		});
		return moved.count > 0;
	}

	/**
	 * Records one verified webhook event and applies it, in the caller's transaction:
	 *
	 * - the event row is inserted FIRST with `ON CONFLICT (webhook_id) DO NOTHING`:
	 *   a redelivered webhook inserts nothing and is reported `duplicate` before
	 *   anything is applied (a concurrent duplicate waits on the unique index,
	 *   then sees the committed row);
	 * - the row is matched by the `emailLogId` tag, else by provider id;
	 * - the status is applied only when the transition is forward-allowed AND the
	 *   event is not older than the newest event already applied (`lastEventAt`);
	 * - the event row then records what it did (history).
	 */
	public async recordDeliveryEvent(event: DeliveryEventRecord): Promise<DeliveryEventRecordResult> {
		const inserted = await this.db.emailDeliveryEvent.createMany({
			data: [
				{
					webhookId: event.webhookId,
					eventType: event.eventType,
					resendId: event.resendId,
					status: event.status ?? null,
					detail: event.detail ?? null,
					occurredAt: event.occurredAt,
					outcome: PROVISIONAL_OUTCOME,
				},
			],
			skipDuplicates: true,
		});
		if (inserted.count === 0) {
			return { kind: "duplicate" };
		}
		const target = await this.findWebhookTarget(event);
		const outcome = await this.applyDeliveryEvent(target, event);
		await this.db.emailDeliveryEvent.update({ where: { webhookId: event.webhookId }, data: { emailLogId: target?.id ?? null, outcome } });
		return { kind: "recorded", outcome, emailLogId: target?.id ?? null };
	}

	private async findWebhookTarget(event: DeliveryEventRecord): Promise<{ readonly id: string } | null> {
		if (event.taggedEmailLogId !== undefined) {
			const tagged = await this.db.emailLog.findUnique({ where: { id: event.taggedEmailLogId }, select: { id: true } });
			if (tagged !== null) {
				return tagged;
			}
		}
		return this.db.emailLog.findFirst({ where: { resendId: event.resendId }, select: { id: true } });
	}

	private async applyDeliveryEvent(target: { readonly id: string } | null, event: DeliveryEventRecord): Promise<DeliveryEventOutcome> {
		if (target === null) {
			return "unmatched";
		}
		if (event.status === undefined) {
			return "ignored";
		}
		const occurredAt = BigInt(event.occurredAt);
		const applied = await this.db.emailLog.updateMany({
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
				updatedAt: nowEpochMs(),
			},
		});
		return applied.count > 0 ? "applied" : "stale";
	}
}
