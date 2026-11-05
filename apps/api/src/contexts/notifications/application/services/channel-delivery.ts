// ============================================
// notifications/application/services/channel-delivery.ts — one push or SMS delivery (ADR 070)
// ============================================
// The worker re-reads its delivery and acts only on QUEUED, moving it to SENDING with a conditional
// update (a repeated job does nothing). The provider is called OUTSIDE any transaction. The one duplicate
// left — the provider accepted, the process died before SENT was written — is accepted: FCM, APNs and
// Twilio take no idempotency key, and a rare repeat beats a lost message.

import type { NotificationChannel } from "@workspace/shared";

import { systemActor } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { findNotificationType } from "../../domain/catalog/notification-catalog";
import type { NotificationRenderContext } from "../../domain/catalog/notification-type";
import type { NotificationsScope } from "../notifications-scope";
import type { ChannelSendResult, PushMessage, PushSender, SmsMessage, SmsSender } from "../ports/channel-senders.port";
import type { PushTokenCipher } from "../ports/push-token-cipher.port";
import { pushAddressOf } from "./push-address";

export const NOTIFICATIONS_DELIVER_OPERATION = "notifications.deliver";

/** Attempts before a retryable failure becomes FAILED (BullMQ backs off between them). */
export const CHANNEL_DELIVERY_MAX_ATTEMPTS = 5;

/** A retryable provider failure: the job throws it so the queue retries with back-off. */
export class RetryableChannelFailure extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "RetryableChannelFailure";
	}
}

type Prepared =
	| { readonly kind: "skip" }
	| { readonly kind: "push"; readonly message: PushMessage; readonly notificationId: string; readonly sensitive: boolean; readonly attempts: number }
	| { readonly kind: "sms"; readonly message: SmsMessage; readonly notificationId: string; readonly sensitive: boolean; readonly attempts: number }
	| { readonly kind: "failed"; readonly reason: string };

export interface ChannelDeliveryDependencies {
	readonly uow: UnitOfWork<NotificationsScope>;
	readonly clock: Clock;
	readonly push: PushSender;
	readonly sms: SmsSender;
	readonly cipher: PushTokenCipher;
	readonly renderContext: Omit<NotificationRenderContext, "groupCount">;
}

export class ChannelDelivery {
	public constructor(private readonly deps: ChannelDeliveryDependencies) {}

	/** Sends one delivery; throws {@link RetryableChannelFailure} when the queue should try again. */
	public async deliver(channel: Extract<NotificationChannel, "PUSH" | "SMS">, deliveryId: string): Promise<void> {
		const prepared = await this.inTransaction(async (scope) => this.prepare(scope, channel, deliveryId));
		if (prepared.kind === "skip") {
			return;
		}
		if (prepared.kind === "failed") {
			await this.inTransaction(async (scope) => {
				await scope.notificationStore.completeDelivery(deliveryId, { status: "FAILED", reason: null, providerMessageId: null, error: prepared.reason }, this.deps.clock.now());
			});
			return;
		}
		const result: ChannelSendResult = prepared.kind === "push" ? await this.deps.push.send(prepared.message) : await this.deps.sms.send(prepared.message);
		await this.inTransaction(async (scope) => {
			const store = scope.notificationStore;
			const now = this.deps.clock.now();
			switch (result.kind) {
				case "sent":
					await store.completeDelivery(deliveryId, { status: "SENT", reason: null, providerMessageId: result.providerMessageId, error: null }, now);
					break;
				case "disabled":
					await store.completeDelivery(deliveryId, { status: "SUPPRESSED", reason: "provider-disabled", providerMessageId: null, error: null }, now);
					break;
				case "invalid-destination":
					await store.completeDelivery(
						deliveryId,
						{ status: "FAILED", reason: prepared.kind === "push" ? "no-device" : "suppressed-destination", providerMessageId: null, error: result.error },
						now,
					);
					if (prepared.kind === "push") {
						await store.revokePushDevice(prepared.message.deviceId, "invalid-token", now);
					}
					break;
				case "failed":
					if (result.retryable && prepared.attempts < CHANNEL_DELIVERY_MAX_ATTEMPTS) {
						await store.completeDelivery(deliveryId, { status: "QUEUED", reason: null, providerMessageId: null, error: result.error }, now);
						break;
					}
					await store.completeDelivery(deliveryId, { status: "FAILED", reason: null, providerMessageId: null, error: result.error }, now);
					break;
			}
			if (prepared.sensitive) {
				await store.scrubPayloadWhenDone(prepared.notificationId, now);
			}
		});
		if (result.kind === "failed" && result.retryable && prepared.attempts < CHANNEL_DELIVERY_MAX_ATTEMPTS) {
			throw new RetryableChannelFailure(result.error);
		}
	}

	private inTransaction<T>(work: (scope: NotificationsScope) => Promise<T>): Promise<T> {
		const actor = systemActor(NOTIFICATIONS_DELIVER_OPERATION, "job", null, "Send one push or SMS delivery", null);
		return this.deps.uow.runSystemOperation(NOTIFICATIONS_DELIVER_OPERATION, actor, work);
	}

	private async prepare(scope: NotificationsScope, channel: Extract<NotificationChannel, "PUSH" | "SMS">, deliveryId: string): Promise<Prepared> {
		const store = scope.notificationStore;
		const delivery = await store.findDelivery(deliveryId);
		if (delivery?.channel !== channel || !(await store.transitionDelivery(deliveryId, "QUEUED", "SENDING", this.deps.clock.now()))) {
			return { kind: "skip" };
		}
		const notification = await store.findNotification(delivery.notificationId);
		const type = notification === null ? null : findNotificationType(notification.typeKey);
		if (notification === null || type === null) {
			return { kind: "failed", reason: "The notification or its type no longer exists" };
		}
		const profile = notification.recipientUserId === null ? null : await store.recipientProfile(notification.recipientUserId);
		const locale = profile?.locale ?? notification.locale;
		const context: NotificationRenderContext = { ...this.deps.renderContext, groupCount: 1 };
		const attempts = delivery.attempts + 1;
		if (channel === "SMS") {
			const to = notification.contactAddress ?? (profile?.phoneVerified === true ? profile.phone : null);
			const rendering = type.renderSms(notification.payload, locale, context);
			if (to === null || rendering === null) {
				return { kind: "failed", reason: to === null ? "The recipient has no verified phone number any more" : "The type renders no SMS" };
			}
			return { kind: "sms", message: { deliveryId, to, text: rendering.text }, notificationId: notification.id, sensitive: type.sensitive, attempts };
		}
		const device = delivery.pushDeviceId === null ? null : await store.findPushDevice(delivery.pushDeviceId);
		const rendering = type.renderPush(notification.payload, locale, context);
		const removed = device?.revokedAt !== null;
		if (device === null || removed || rendering === null || !this.deps.cipher.available) {
			return { kind: "failed", reason: removed ? "The device was removed" : "Push cannot be rendered or decrypted" };
		}
		const unread = notification.recipientUserId === null ? null : await store.unreadCount(notification.recipientUserId, device.surface);
		const groupKey = type.groupKey(notification.payload);
		return {
			kind: "push",
			message: {
				deliveryId,
				deviceId: device.id,
				platform: device.platform,
				...pushAddressOf(this.deps.cipher, device),
				// A sensitive notification never shows its content on a lock screen (ADR 070).
				title: type.sensitive ? this.deps.renderContext.appName : rendering.title,
				body: type.sensitive ? "You have a new security message." : rendering.body,
				category: notification.category,
				occurredAt: notification.createdAt,
				data: { deliveryId, notificationId: notification.id, ...(rendering.link === null ? {} : { link: rendering.link }) },
				collapseKey: groupKey,
				badge: unread,
			},
			notificationId: notification.id,
			sensitive: type.sensitive,
			attempts,
		};
	}
}
