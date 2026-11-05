// TEST-ONLY real implementations of the notifications ports.
import { epochMs, type EmailLogCreate, type EmailLogStatus, type EmailSendResult, type EpochMs } from "@workspace/shared";

import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import { EmailLog } from "../../../domain/aggregates/email-log.aggregate";
import type { DeliveryEventRecord, DeliveryEventRecordResult, EmailLogRepository } from "../../../domain/repositories/email-log.repository";
import type { BaseEmailProps, BaseEmailTemplate } from "../../../domain/templates/base/base-email-template";
import type { NotificationsScope } from "../../notifications-scope";
import { EmailDeliveryFailure, type EmailDeliveryPort, type EmailDeliveryReceipt } from "../../ports/email-delivery.port";
import type { EmailRequestTransactionalPort, EmailSendOptions } from "../../ports/email-request.port";
import type { NotifyRequest, NotifyResult, NotifyTransactionalPort } from "../../ports/notify.port";
import { InMemoryNotificationAccountStore } from "./in-memory-notification-account.store";
import { InMemoryNotificationStore } from "./in-memory-notification.store";
import { InMemoryBroadcastStore } from "./in-memory-broadcast.store";
import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { BroadcastImageFilesPort, BroadcastImageOwner } from "../../ports/broadcast-image-files.port";
import { ValidationError } from "../../../../../platform/application/errors/app-error";

export const EMAIL_LOG_ID = "6b1f3e2a-9c4d-4e5f-8a7b-1c2d3e4f5a6b";
export const NOW: EpochMs = epochMs(1_800_000_000_000);

interface StoredLog {
	readonly id: string;
	readonly templateKey: string;
	readonly to: string;
	status: string;
	resendId: string | null;
	error: string | null;
}

/** Email log rows with the repository's compare-and-set semantics (`pending` → outcome exactly once). */
export class InMemoryEmailLogs implements EmailLogRepository {
	public readonly rows = new Map<string, StoredLog>();
	public readonly deliveryEvents: DeliveryEventRecord[] = [];
	/** A concurrent writer finalizes the row between load and finalize. */
	public finalizedBehindOurBack = false;
	public failFinalize = false;

	public seed(id: string, status: string, templateKey = "admin-alert"): void {
		this.rows.set(id, { id, templateKey, to: "ops@example.com", status, resendId: null, error: null });
	}

	public insert(id: string, input: EmailLogCreate): Promise<void> {
		this.rows.set(id, { id, templateKey: input.templateKey, to: input.to, status: input.status, resendId: input.resendId ?? null, error: input.error ?? null });
		return Promise.resolve();
	}

	public findById(id: string): Promise<EmailLog | null> {
		const row = this.rows.get(id);
		return Promise.resolve(row === undefined ? null : EmailLog.rehydrate(row));
	}

	public finalizeSent(log: EmailLog, resendId: string | null): Promise<boolean> {
		return this.finalize(log, "sent", { resendId });
	}

	public finalizeFailed(log: EmailLog, error: string): Promise<boolean> {
		return this.finalize(log, "failed", { error });
	}

	public recordDeliveryEvent(event: DeliveryEventRecord): Promise<DeliveryEventRecordResult> {
		if (this.deliveryEvents.some((recorded) => recorded.webhookId === event.webhookId)) {
			return Promise.resolve({ kind: "duplicate" });
		}
		this.deliveryEvents.push(event);
		const row = event.taggedEmailLogId === undefined ? undefined : this.rows.get(event.taggedEmailLogId);
		if (row === undefined) {
			return Promise.resolve({ kind: "recorded", outcome: "unmatched", emailLogId: null });
		}
		if (event.status === undefined) {
			return Promise.resolve({ kind: "recorded", outcome: "ignored", emailLogId: row.id });
		}
		if (!event.allowedFrom.some((status: EmailLogStatus): boolean => status === row.status)) {
			return Promise.resolve({ kind: "recorded", outcome: "stale", emailLogId: row.id });
		}
		row.status = event.status;
		return Promise.resolve({ kind: "recorded", outcome: "applied", emailLogId: row.id });
	}

	public status(id: string): string | undefined {
		return this.rows.get(id)?.status;
	}

	private finalize(log: EmailLog, status: "sent" | "failed", fields: { readonly resendId?: string | null; readonly error?: string }): Promise<boolean> {
		if (this.failFinalize) {
			return Promise.reject(new Error("database unavailable"));
		}
		const row = this.rows.get(log.id);
		if (this.finalizedBehindOurBack || row?.status !== log.concurrencyToken) {
			return Promise.resolve(false);
		}
		row.status = status;
		row.resendId = fields.resendId ?? row.resendId;
		row.error = fields.error ?? row.error;
		return Promise.resolve(true);
	}
}

/** The provider: answers with the queued outcomes, in order; records every call (the email log id is the idempotency key). */
export class ScriptedDelivery implements EmailDeliveryPort {
	public readonly calls: { readonly emailLogId: string; readonly templateKey: string }[] = [];

	public constructor(private readonly outcomes: (EmailDeliveryReceipt | EmailDeliveryFailure)[] = []) {}

	public deliver(emailLogId: string, template: BaseEmailTemplate<BaseEmailProps>): Promise<EmailDeliveryReceipt> {
		this.calls.push({ emailLogId, templateKey: template.key });
		const outcome = this.outcomes.shift() ?? { providerMessageId: "msg-1", resendId: "resend-1", deliveredTo: template.props.to };
		return outcome instanceof EmailDeliveryFailure ? Promise.reject(outcome) : Promise.resolve(outcome);
	}
}

/** Records every transactional request and answers it as queued. */
export class RecordingEmailRequests implements EmailRequestTransactionalPort {
	public readonly requests: { readonly templateKey: string; readonly options: EmailSendOptions | undefined }[] = [];

	public request<TProps extends BaseEmailProps>(template: BaseEmailTemplate<TProps>, options?: EmailSendOptions): Promise<EmailSendResult> {
		this.requests.push({ templateKey: template.key, options });
		return Promise.resolve({ ok: true, id: EMAIL_LOG_ID, mode: "queued" });
	}
}

/** Records every `notify()` and answers it as new. */
export class RecordingNotify implements NotifyTransactionalPort {
	public readonly requests: {
		readonly typeKey: string;
		readonly dedupeKey: string;
		readonly recipientUserId: string | null;
		readonly broadcastId: string | null;
		readonly notBefore: number | null;
		readonly category: string | null;
	}[] = [];

	public notify<TPayload>(request: NotifyRequest<TPayload>): Promise<NotifyResult> {
		const recipientUserId = request.recipient.kind === "user" ? request.recipient.userId : null;
		const repeat = this.requests.some(
			(existing) => existing.typeKey === request.type.key && existing.dedupeKey === request.dedupeKey && existing.recipientUserId === recipientUserId,
		);
		if (repeat) {
			return Promise.resolve({ duplicate: true });
		}
		this.requests.push({
			typeKey: request.type.key,
			dedupeKey: request.dedupeKey,
			recipientUserId,
			broadcastId: request.broadcastId ?? null,
			notBefore: request.notBefore ?? null,
			category: request.category ?? null,
		});
		return Promise.resolve({ duplicate: false, notificationId: EMAIL_LOG_ID });
	}
}

/** Runs each unit of work on one fixed scope and records the system operation it ran under. */
export class RecordingNotificationsUnitOfWork implements UnitOfWork<NotificationsScope> {
	public readonly operations: (SystemOperationName | null)[] = [];

	public constructor(public readonly scope: NotificationsScope) {}

	public run<TResult>(_actor: ActorContext, work: (scope: NotificationsScope) => Promise<TResult>): Promise<TResult> {
		this.operations.push(null);
		return work(this.scope);
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, _actor: ActorContext, work: (scope: NotificationsScope) => Promise<TResult>): Promise<TResult> {
		this.operations.push(operation);
		return work(this.scope);
	}
}

/** Broadcast pictures (enhancement 5.4): the ones a test registers are ready; locking records what was asked. */
export class InMemoryBroadcastImages implements BroadcastImageFilesPort {
	public readonly locked: { readonly owner: BroadcastImageOwner; readonly fileIds: readonly string[] }[] = [];

	public constructor(private readonly ready: ReadonlyMap<string, string> = new Map()) {}

	public lockUsable(owner: BroadcastImageOwner, fileIds: readonly string[]): Promise<void> {
		this.locked.push({ owner, fileIds });
		const refused = fileIds.filter((fileId) => !this.ready.has(fileId));
		return refused.length === 0 ? Promise.resolve() : Promise.reject(new ValidationError({ message: "not ready", details: { fileIds: refused } }));
	}

	public sources(fileIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return Promise.resolve(
			new Map(
				fileIds.flatMap((fileId): [string, string][] => {
					const src = this.ready.get(fileId);
					return src === undefined ? [] : [[fileId, src]];
				}),
			),
		);
	}
}

export function notificationsScope(
	emailLogs: InMemoryEmailLogs,
	emailRequests: EmailRequestTransactionalPort = new RecordingEmailRequests(),
	notificationStore: InMemoryNotificationStore = new InMemoryNotificationStore((): number => NOW),
	accountStore: InMemoryNotificationAccountStore = new InMemoryNotificationAccountStore(),
	broadcasts: InMemoryBroadcastStore = new InMemoryBroadcastStore(),
	notify: RecordingNotify = new RecordingNotify(),
	broadcastImages: InMemoryBroadcastImages = new InMemoryBroadcastImages(),
): NotificationsScope {
	return { emailLogs, emailRequests, notify, notificationStore, accountStore, broadcasts, broadcastImages, events: new TransactionalEventCollector() };
}

export function failure(retryable: boolean, message = "provider error"): EmailDeliveryFailure {
	return new EmailDeliveryFailure("api-error", message, retryable);
}
