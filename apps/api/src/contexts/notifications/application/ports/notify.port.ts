import type { NotificationCategory } from "@workspace/shared";

import type { TypedNotificationType } from "../../domain/catalog/notification-type";

/** Who a notification is for: a user, or a bare address with no account (only types that allow it). */
export type NotificationRecipient =
	| { readonly kind: "user"; readonly userId: string }
	| { readonly kind: "contact-point"; readonly channel: "EMAIL" | "SMS"; readonly address: string };

export interface NotifyRequest<TPayload> {
	readonly type: TypedNotificationType<TPayload>;
	readonly recipient: NotificationRecipient;
	readonly payload: TPayload;
	/** The producer's retry key: a repeated request with the same key is the same notification. */
	readonly dedupeKey: string;
	/** The tenant the message is about; null for platform messages. */
	readonly tenantId: string | null;
	/** Only for a type declared `categoryOverridable` (broadcasts). */
	readonly category?: NotificationCategory;
	readonly broadcastId?: string;
	/** Not delivered before this instant (a broadcast at the recipient's own local time). */
	readonly notBefore?: number;
}

export type NotifyResult =
	| { readonly duplicate: false; readonly notificationId: string }
	/** This request repeated an earlier one (same recipient, type and dedupe key): nothing new was written. */
	| { readonly duplicate: true };

/**
 * `notify()` (ADR 070), bound to the CALLER'S transaction: the notification row commits or rolls back
 * with the business change that caused it, and is fanned out after commit (a sweep is the crash backstop).
 */
export interface NotifyTransactionalPort {
	notify<TPayload>(request: NotifyRequest<TPayload>): Promise<NotifyResult>;
}

export class NotifyRequestError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "NotifyRequestError";
	}
}
