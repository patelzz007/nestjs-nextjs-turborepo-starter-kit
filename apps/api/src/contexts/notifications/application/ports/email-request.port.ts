import type { EmailSendResult } from "@workspace/shared";

import type { BaseEmailProps, BaseEmailTemplate } from "../../domain/templates/base/base-email-template";
import type { LegacyInboxImportPort } from "./legacy-inbox-import.port";
import type { NotifyTransactionalPort } from "./notify.port";

/** Who triggered a send, recorded on the email log row (the row IS the domain audit record of the send). */
export interface EmailSendAudit {
	readonly trigger: "admin-test-send";
	readonly actorUserId: string;
}

/** Options for one email request. */
export interface EmailSendOptions {
	readonly audit?: EmailSendAudit;
}

/**
 * TRANSACTIONAL email request (ADR 060) — the form every caller should use.
 *
 * `request` writes, in the CALLER'S open transaction:
 * - an `EmailLog` row in `pending` (send mode), and
 * - an `OutboxEvent` row of type `notification.email.requested`
 *   (payload = the `emailSend` job, jobId = email log id),
 * and records an `EmailRequested` event on the caller's collector. Both rows
 * commit or roll back with the business row. After commit the notifications
 * context hands the request to the BullMQ `emailSend` queue (or delivers it
 * inline when Redis is off); the outbox sweep is the crash backstop.
 *
 * Results (it never throws for an expected refusal; a database error throws
 * and rolls the caller back, which is the point):
 * - `{ ok: true, id: <emailLogId>, mode: "queued" }` — durably requested;
 * - `{ ok: true, id, mode: "noop" | "log-only" }` — simulated modes (row written `sent`);
 * - `{ ok: false, reason: "invalid-props" | "rate-limited" }` — nothing written.
 */
export interface EmailRequestTransactionalPort {
	request<TProps extends BaseEmailProps>(template: BaseEmailTemplate<TProps>, options?: EmailSendOptions): Promise<EmailSendResult>;
}

/** What `NotificationsTransactionalPortsFactory.create(db, events)` returns. */
export interface NotificationsTransactionalPorts {
	readonly emailRequests: EmailRequestTransactionalPort;
	/** `notify()` (ADR 070): the preferred way to tell a person something, on any channel. */
	readonly notifications: NotifyTransactionalPort;
	/** The one-time move of the earlier reward inbox (ADR 070); only claims, which owns that inbox, calls it. */
	readonly legacyInbox: LegacyInboxImportPort;
}
