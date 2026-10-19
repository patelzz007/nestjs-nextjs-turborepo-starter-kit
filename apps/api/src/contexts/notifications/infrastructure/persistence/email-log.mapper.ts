import type { EmailLog as EmailLogRow } from "@prisma/client";
import { EmailLogEntrySchema, epochMs, type EmailLogEntry } from "@workspace/shared";

import { EmailLog } from "../../domain/aggregates/email-log.aggregate";

/** The columns a command needs to rehydrate an email log. */
export type EmailLogAggregateRow = Pick<EmailLogRow, "id" | "templateKey" | "to" | "status">;

/** Row → aggregate (command loads). An unknown stored status throws `CORRUPT_AGGREGATE_STATE` (D32). */
export function toEmailLog(row: EmailLogAggregateRow): EmailLog {
	return EmailLog.rehydrate({ id: row.id, templateKey: row.templateKey, to: row.to, status: row.status });
}

/**
 * Row → the public `EmailLogEntry` contract (the admin list projection).
 * Same rule as commands: an unknown stored status throws `CORRUPT_AGGREGATE_STATE`
 * — the shared contract has no "unknown" status to show it with (see ListEmailLogHandler).
 */
export function toEmailLogEntry(row: EmailLogRow): EmailLogEntry {
	return EmailLogEntrySchema.parse({
		id: row.id,
		templateKey: row.templateKey,
		to: row.to,
		subject: row.subject,
		status: EmailLog.parseStoredStatus(row.id, row.status),
		resendId: row.resendId ?? undefined,
		error: row.error ?? undefined,
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	});
}
