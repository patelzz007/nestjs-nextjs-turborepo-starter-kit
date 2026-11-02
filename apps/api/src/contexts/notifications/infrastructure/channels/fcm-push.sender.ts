// ============================================
// notifications/infrastructure/channels/fcm-push.sender.ts — Android push through FCM HTTP v1 (ADR 070)
// ============================================

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Message, type Messaging } from "firebase-admin/messaging";
import { NOTIFICATION_PUSH_CHANNEL_IDS } from "@workspace/shared";
import { z } from "zod";

import type { ChannelSendResult, PushMessage } from "../../application/ports/channel-senders.port";

/** Its own named app, so the storage adapter's Firebase app is never reused or replaced. */
const FCM_APP_NAME = "notifications-fcm";

/** FCM answers these when the token will never work again (the app was uninstalled or the token rotated). */
const INVALID_TOKEN_CODES: readonly string[] = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"];
/** FCM answers these for a passing problem: worth a retry with back-off. */
const RETRYABLE_CODES: readonly string[] = ["messaging/internal-error", "messaging/server-unavailable", "messaging/message-rate-exceeded", "messaging/quota-exceeded"];

const FirebaseErrorSchema = z.object({ code: z.string(), message: z.string() });
const ServiceAccountSchema = z.object({ project_id: z.string(), client_email: z.string(), private_key: z.string() });

/** The FCM message of one push: the kind's own channel, the time it happened, the badge and the tap data. */
export function fcmMessageOf(message: PushMessage): Message {
	return {
		token: message.token,
		notification: { title: message.title, body: message.body },
		data: { ...message.data, category: message.category },
		android: {
			priority: "high",
			...(message.collapseKey === null ? {} : { collapseKey: message.collapseKey }),
			notification: {
				// The kind's own channel (the app creates them); the time it happened, not when it arrived.
				channelId: NOTIFICATION_PUSH_CHANNEL_IDS[message.category],
				eventTimestamp: new Date(message.occurredAt),
				...(message.badge === null ? {} : { notificationCount: message.badge }),
			},
		},
	};
}

export class FcmPushSender {
	private readonly messaging: Messaging;

	public constructor(serviceAccountJson: string) {
		const account = ServiceAccountSchema.parse(JSON.parse(serviceAccountJson));
		const app: App =
			getApps().find((candidate): boolean => candidate.name === FCM_APP_NAME) ??
			initializeApp({ credential: cert({ projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key }) }, FCM_APP_NAME);
		this.messaging = getMessaging(app);
	}

	public async send(message: PushMessage): Promise<ChannelSendResult> {
		return this.call(async (): Promise<string> => this.messaging.send(fcmMessageOf(message)));
	}

	public async sendSilentSync(token: string, badge: number): Promise<ChannelSendResult> {
		return this.call(async (): Promise<string> => this.messaging.send({ token, data: { kind: "sync", badge: String(badge) }, android: { priority: "normal" } }));
	}

	private async call(send: () => Promise<string>): Promise<ChannelSendResult> {
		try {
			return { kind: "sent", providerMessageId: await send() };
		} catch (error) {
			const parsed = FirebaseErrorSchema.safeParse(error);
			if (!parsed.success) {
				return { kind: "failed", retryable: true, error: error instanceof Error ? error.message : "FCM send failed" };
			}
			if (INVALID_TOKEN_CODES.includes(parsed.data.code)) {
				return { kind: "invalid-destination", error: parsed.data.code };
			}
			return { kind: "failed", retryable: RETRYABLE_CODES.includes(parsed.data.code), error: `${parsed.data.code}: ${parsed.data.message}` };
		}
	}
}
