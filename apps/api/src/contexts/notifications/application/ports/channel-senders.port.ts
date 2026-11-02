import type { NotificationCategory, PushPlatform } from "@workspace/shared";

export interface PushMessage {
	readonly deliveryId: string;
	readonly deviceId: string;
	readonly platform: PushPlatform;
	readonly token: string;
	readonly title: string;
	/** One line or several (`\n`): an expanded notification shows them all. */
	readonly body: string;
	/** The kind of message: the Android channel it is posted on, and the iOS thread it is grouped in. */
	readonly category: NotificationCategory;
	/** When it happened (the notification's creation): the time the phone shows on it. */
	readonly occurredAt: number;
	/** App path opened on tap, and the ids the app reports back (`POST /notifications/push-opened`). */
	readonly data: Readonly<Record<string, string>>;
	/** A grouped type re-sends under one key, so the device shows one notification. */
	readonly collapseKey: string | null;
	readonly badge: number | null;
}

export type ChannelSendResult =
	| { readonly kind: "sent"; readonly providerMessageId: string }
	/** The destination will never work again (uninstalled app, unregistered token, invalid number). */
	| { readonly kind: "invalid-destination"; readonly error: string }
	| { readonly kind: "failed"; readonly retryable: boolean; readonly error: string }
	| { readonly kind: "disabled" };

export interface PushSender {
	readonly provider: string;
	readonly live: boolean;
	send(message: PushMessage): Promise<ChannelSendResult>;
	/** Data-only message that removes a delivered notification from the tray and updates the badge. */
	sendSilentSync(message: { readonly platform: PushPlatform; readonly token: string; readonly deviceId: string; readonly badge: number }): Promise<ChannelSendResult>;
}

export interface SmsMessage {
	readonly deliveryId: string;
	/** E.164 */
	readonly to: string;
	readonly text: string;
}

export interface SmsSender {
	readonly provider: string;
	readonly live: boolean;
	send(message: SmsMessage): Promise<ChannelSendResult>;
}

export const PUSH_SENDER = Symbol("PUSH_SENDER");
export const SMS_SENDER = Symbol("SMS_SENDER");
