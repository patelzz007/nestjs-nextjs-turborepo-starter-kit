import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { EmailLogEntrySchema, EmailLogStatusSchema, type EmailLogEntry, type EmailLogStatus } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service.js";

import { EmailLogEventsService } from "./email-log-events.service.js";

/** Payload used to create a new EmailLog row. */
export const EmailLogCreateSchema = z
	.object({
		templateKey: z.string().min(1),
		to: z.email(),
		subject: z.string().min(1),
		status: EmailLogStatusSchema,
		resendId: z.string().optional(),
		error: z.string().optional(),
		metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
	})
	.strict();

export type EmailLogCreate = z.output<typeof EmailLogCreateSchema>;

/**
 * Result of applying a webhook delivery event to an EmailLog row.
 *
 * - `"updated"`  — the row moved forward (or the same status was re-applied).
 * - `"not_found"` — no row has this resend id — the event references an email
 *   this system never sent (spoofed / sent from the Resend dashboard / another
 *   app sharing the account). Acknowledged, nothing written.
 * - `"stale"`   — the row exists but the event would REGRESS its status
 *   (e.g. a replayed `email.sent` arriving after the row was `delivered`).
 *   Ignored so a captured, still-valid webhook can never undo an outcome.
 */
export type WebhookUpdateResult = "updated" | "not_found" | "stale";

/**
 * Allowed source statuses for each incoming event status. The webhook may
 * only move a row FORWARD (or keep it idempotent):
 *
 * - `sent` is the first event — a replayed/out-of-order `email.sent` can never
 *   regress a row that already progressed.
 * - `delivered` may also override `bounced`: Resend retries SOFT (transient)
 *   bounces and emits `email.delivered` when a later attempt succeeds — the
 *   row must reflect the eventual outcome, not the intermediate rejection.
 * - `bounced` / `complained` / `failed` are (effectively) terminal outcomes
 *   and can only be reached going forward.
 */
const ALLOWED_FROM: Readonly<Record<EmailLogStatus, readonly EmailLogStatus[]>> = {
	sent: ["sent"],
	delivered: ["sent", "delivered", "bounced"],
	bounced: ["sent", "delivered", "bounced"],
	complained: ["sent", "delivered", "bounced", "complained"],
	failed: ["sent", "delivered", "bounced", "complained", "failed"],
};

/**
 * Persistence for the outbound-email lifecycle.
 *
 * One row per `send()` attempt (including log-only / noop sends, so the admin
 * can audit what "would have" been sent in dev). The Resend webhook later
 * flips rows to `delivered` / `bounced` / `complained` / `failed` via
 * `updateStatusByResendId`. Open/click tracking was deliberately removed from
 * the system, so the webhook's tracking events (`email.opened` /
 * `email.clicked`) are acknowledged and ignored — only delivery outcomes
 * update the log.
 */
@Injectable()
export class EmailLogService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly events: EmailLogEventsService,
	) {}

	/** Insert a new EmailLog row. Returns the generated id. */
	public async create(input: EmailLogCreate): Promise<{ readonly id: string }> {
		const parsed: EmailLogCreate = EmailLogCreateSchema.parse(input);
		const row = await this.prisma.emailLog.create({
			data: {
				templateKey: parsed.templateKey,
				to: parsed.to,
				subject: parsed.subject,
				status: parsed.status,
				resendId: parsed.resendId,
				error: parsed.error,
				metadata: parsed.metadata ?? undefined,
			},
			select: { id: true },
		});
		this.events.emitUpdated();
		return { id: row.id };
	}

	/**
	 * Apply a webhook delivery event to a row, by its Resend id.
	 *
	 * Two spoof/regression guards live here (see {@link WebhookUpdateResult}):
	 *
	 * 1. Only rows that EXIST are touched — an event referencing an unknown
	 *    `email_id` (never sent by this system) updates nothing and never
	 *    creates a row.
	 * 2. Only FORWARD transitions are applied — the `where` clause restricts
	 *    the update to rows whose current status is at or before the incoming
	 *    one, so a replayed/out-of-order event can never regress a status.
	 */
	public async updateStatusByResendId(resendId: string, status: EmailLogStatus, error?: string): Promise<WebhookUpdateResult> {
		const parsedStatus: EmailLogStatus = EmailLogStatusSchema.parse(status);
		const allowedCurrentStatuses: EmailLogStatus[] = [...ALLOWED_FROM[parsedStatus]];
		const result = await this.prisma.emailLog.updateMany({
			where: { resendId, status: { in: allowedCurrentStatuses } },
			data: { status: parsedStatus, error },
		});
		if (result.count > 0) {
			this.events.emitUpdated();
			return "updated";
		}
		// Nothing matched: either no row has this resend id, or the row exists
		// but the event is not an allowed forward transition. The follow-up
		// count is a best-effort LOG classification only — a concurrent create
		// between the two queries could at worst mislabel not_found vs stale;
		// it can never cause a wrong write (the write is the atomic updateMany).
		const exists: number = await this.prisma.emailLog.count({ where: { resendId } });
		return exists > 0 ? "stale" : "not_found";
	}

	/**
	 * Most recent rows, newest first — used by the admin log page / audits.
	 *
	 * Prisma returns `Date` objects, but the wire contract wants ISO strings —
	 * so the rows are mapped here before the strict schema validates them.
	 */
	public async listRecent(limit = 100): Promise<EmailLogEntry[]> {
		const rows = await this.prisma.emailLog.findMany({
			orderBy: { createdAt: "desc" },
			take: limit,
		});
		const mapped = rows.map((row) => ({
			id: row.id,
			templateKey: row.templateKey,
			to: row.to,
			subject: row.subject,
			status: row.status,
			resendId: row.resendId ?? undefined,
			error: row.error ?? undefined,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		}));
		return EmailLogEntrySchema.array().parse(mapped);
	}
}
