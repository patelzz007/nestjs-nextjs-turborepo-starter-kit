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

/** FCM answers these when the token or installation will never work again (the app was uninstalled, the token rotated). */
const INVALID_TOKEN_CODES: readonly string[] = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"];
/**
 * FCM's answer for an installation ID it doesn't know. Seen on a live, registered phone (2026-11-05): its ID was
 * refused while its token, sent the same push a second later, delivered. The ID is still tried first (FCM's
 * preferred address, firebase-admin 14), and this one answer sends the push by token instead (sendToDevice).
 */
const UNKNOWN_INSTALLATION_CODE = "messaging/installation-id-not-registered";
/** FCM answers these for a passing problem: worth a retry with back-off. */
const RETRYABLE_CODES: readonly string[] = ["messaging/internal-error", "messaging/server-unavailable", "messaging/message-rate-exceeded", "messaging/quota-exceeded"];

const FirebaseErrorSchema = z.object({ code: z.string(), message: z.string() });
const ServiceAccountSchema = z.object({ project_id: z.string(), client_email: z.string(), private_key: z.string() });

/** Who one FCM message goes to: an install by its Firebase Installation ID, or a device by its token. */
export type FcmTarget = { readonly fid: string } | { readonly token: string };

/**
 * Who an FCM message goes to first: the install (its Firebase Installation ID) when the app reported one, else
 * the token, for an app build older than enhancement 5.3. firebase-admin 14 deprecates token addressing.
 */
export function fcmTargetOf(address: { readonly token: string; readonly installationId: string | null }): FcmTarget {
	return address.installationId === null ? { token: address.token } : { fid: address.installationId };
}

/**
 * Sends one push to one device: by its installation ID first, and by its token when FCM answers that it doesn't
 * know the ID (UNKNOWN_INSTALLATION_CODE). Any other failure is the ID's answer and is passed on unchanged.
 */
export async function sendToDevice(
	address: { readonly token: string; readonly installationId: string | null },
	send: (target: FcmTarget) => Promise<string>,
): Promise<string> {
	const first = fcmTargetOf(address);
	try {
		return await send(first);
	} catch (error) {
		if ("fid" in first && FirebaseErrorSchema.safeParse(error).data?.code === UNKNOWN_INSTALLATION_CODE) {
			return send({ token: address.token });
		}
		throw error;
	}
}

/** The FCM message of one push, addressed to its first target (fcmTargetOf). */
export function fcmMessageOf(message: PushMessage): Message {
	return { ...fcmContentOf(message), ...fcmTargetOf(message) };
}

/** What one push says, without its address: the kind's own channel, the time it happened, the badge and the tap data. */
function fcmContentOf(message: PushMessage): Omit<Message, "token" | "topic" | "condition" | "fid"> {
	return {
		notification: { title: message.title, body: message.body, ...(message.imageUrl === null ? {} : { imageUrl: message.imageUrl }) },
		// The picture's address too: with the app open, the app posts the notification itself (ADR 070).
		data: { ...message.data, category: message.category, ...(message.imageUrl === null ? {} : { imageUrl: message.imageUrl }) },
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
		return this.call(async (): Promise<string> =>
			sendToDevice(message, async (target: FcmTarget): Promise<string> => this.messaging.send({ ...fcmContentOf(message), ...target })),
		);
	}

	public async sendSilentSync(address: { readonly token: string; readonly installationId: string | null }, badge: number): Promise<ChannelSendResult> {
		return this.call(async (): Promise<string> =>
			sendToDevice(address, async (target: FcmTarget): Promise<string> =>
				this.messaging.send({ ...target, data: { kind: "sync", badge: String(badge) }, android: { priority: "normal" } }),
			),
		);
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
