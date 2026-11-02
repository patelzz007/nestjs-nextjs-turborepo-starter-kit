import type { Prisma } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import type { Clock } from "../../../../platform/application/clock.port";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { DEFAULT_NOTIFICATION_LOCALE } from "../../domain/catalog/notification-type";
import { NotificationRequested } from "../../domain/events/notification-requested.event";
import { destinationHash } from "../../domain/policies/mask-destination";
import { NotifyRequestError, type NotifyRequest, type NotifyResult, type NotifyTransactionalPort } from "../../application/ports/notify.port";

/** E.164: `+` and 8–15 digits. */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `notify()` on ONE caller transaction (ADR 070). It writes the notification row only; everything else
 * (preferences, devices, caps, rendering) happens in the fan-out after commit. A repeated request (same
 * recipient, type and dedupe key) writes nothing.
 */
export class TransactionalNotify implements NotifyTransactionalPort {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly events: TransactionalEventCollector,
		private readonly clock: Clock,
	) {}

	public async notify<TPayload>(request: NotifyRequest<TPayload>): Promise<NotifyResult> {
		const type = request.type.declaration;
		const payload = type.payloadSchema.safeParse(type.toJson(request.payload));
		if (!payload.success) {
			throw new NotifyRequestError(`"${type.key}" payload is invalid: ${payload.error.message}`);
		}
		if (request.category !== undefined && !(type.categoryOverridable ?? false)) {
			throw new NotifyRequestError(`"${type.key}" does not take a category from its producer`);
		}
		const recipient = this.recipientFields(request);
		const id = newRowId();
		const inserted = await this.db.notification.createMany({
			data: [
				{
					id,
					...recipient,
					tenantId: request.tenantId,
					typeKey: type.key,
					category: request.category ?? type.category,
					dedupeKey: request.dedupeKey,
					payload: type.toJson(request.payload),
					locale: DEFAULT_NOTIFICATION_LOCALE,
					broadcastId: request.broadcastId ?? null,
					notBefore: request.notBefore === undefined ? null : BigInt(request.notBefore),
				},
			],
			skipDuplicates: true,
		});
		if (inserted.count === 0) {
			return { duplicate: true };
		}
		this.events.collect(new NotificationRequested(epochMs(this.clock.now()), id));
		return { duplicate: false, notificationId: id };
	}

	private recipientFields<TPayload>(request: NotifyRequest<TPayload>): {
		readonly recipientUserId: string | null;
		readonly recipientKey: string;
		readonly contactAddress: string | null;
	} {
		const recipient = request.recipient;
		if (recipient.kind === "user") {
			return { recipientUserId: recipient.userId, recipientKey: recipient.userId, contactAddress: null };
		}
		if (!request.type.allowsContactRecipient) {
			throw new NotifyRequestError(`"${request.type.key}" may only go to a user`);
		}
		const address = recipient.address.trim();
		const valid = recipient.channel === "EMAIL" ? EMAIL_PATTERN.test(address) : E164_PATTERN.test(address);
		if (!valid || !request.type.channels.includes(recipient.channel)) {
			throw new NotifyRequestError(`"${request.type.key}" cannot go to that ${recipient.channel === "EMAIL" ? "email address" : "phone number"}`);
		}
		return { recipientUserId: null, recipientKey: destinationHash(address), contactAddress: recipient.channel === "EMAIL" ? address.toLowerCase() : address };
	}
}
