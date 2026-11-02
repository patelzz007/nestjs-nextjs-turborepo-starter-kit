// ============================================
// notifications/infrastructure/channels/push-senders.ts — the push sender `PUSH_PROVIDER` selects (ADR 070)
// ============================================

import type { PushPlatform } from "@workspace/shared";

import type { ChannelSendResult, PushMessage, PushSender } from "../../application/ports/channel-senders.port";
import type { EmailTransport } from "../adapters/transports/email-transport";
import type { ApnsPushSender } from "./apns-push.sender";
import type { FcmPushSender } from "./fcm-push.sender";

/** `PUSH_PROVIDER=none`: records SUPPRESSED (provider-disabled), never a fake send. */
export class DisabledPushSender implements PushSender {
	public readonly provider: string = "none";
	public readonly live: boolean = false;

	public send(): Promise<ChannelSendResult> {
		return Promise.resolve({ kind: "disabled" });
	}

	public sendSilentSync(): Promise<ChannelSendResult> {
		return Promise.resolve({ kind: "disabled" });
	}
}

/** `PUSH_PROVIDER=native`: FCM for Android, APNs for iOS. A platform without credentials is disabled. */
export class NativePushSender implements PushSender {
	public readonly provider: string = "native";
	public readonly live: boolean = true;

	public constructor(
		private readonly fcm: FcmPushSender | null,
		private readonly apns: ApnsPushSender | null,
	) {}

	public send(message: PushMessage): Promise<ChannelSendResult> {
		if (message.platform === "ANDROID") {
			return this.fcm === null ? Promise.resolve({ kind: "disabled" }) : this.fcm.send(message);
		}
		return this.apns === null ? Promise.resolve({ kind: "disabled" }) : this.apns.send(message);
	}

	public sendSilentSync(message: { readonly platform: PushPlatform; readonly token: string; readonly badge: number }): Promise<ChannelSendResult> {
		if (message.platform === "ANDROID") {
			return this.fcm === null ? Promise.resolve({ kind: "disabled" }) : this.fcm.sendSilentSync(message.token, message.badge);
		}
		return this.apns === null ? Promise.resolve({ kind: "disabled" }) : this.apns.sendSilentSync(message.token, message.badge);
	}
}

/** The local sink domain push previews are delivered to (`<device id>@push.localhost`). */
export const MAILPIT_PUSH_DOMAIN = "push.localhost";

/**
 * `PUSH_PROVIDER=mailpit` (development): each push lands in Mailpit as a small email to
 * `<device-id>@push.localhost`, so every channel is visible in one inbox. Nothing leaves the machine.
 */
export class MailpitPushSender implements PushSender {
	public readonly provider: string = "mailpit";
	public readonly live: boolean = false;

	public constructor(
		private readonly mailpit: EmailTransport,
		private readonly from: string,
	) {}

	public async send(message: PushMessage): Promise<ChannelSendResult> {
		const lines = [
			message.body,
			"",
			`category: ${message.category}`,
			...Object.entries(message.data).map(([key, value]): string => `${key}: ${value}`),
			...(message.badge === null ? [] : [`badge: ${String(message.badge)}`]),
		];
		try {
			const receipt = await this.mailpit.deliver({
				emailLogId: message.deliveryId,
				templateKey: "push",
				from: this.from,
				to: `${message.deviceId}@${MAILPIT_PUSH_DOMAIN}`,
				subject: `[push ${message.platform.toLowerCase()}] ${message.title}`,
				html: `<p><strong>${message.title}</strong></p><pre>${lines.join("\n")}</pre>`,
				text: lines.join("\n"),
				cc: [],
				bcc: [],
				replyTo: undefined,
				headers: {},
			});
			return { kind: "sent", providerMessageId: receipt.providerMessageId };
		} catch (error) {
			return { kind: "failed", retryable: true, error: error instanceof Error ? error.message : "Mailpit refused the push" };
		}
	}

	public sendSilentSync(): Promise<ChannelSendResult> {
		return Promise.resolve({ kind: "sent", providerMessageId: "mailpit-silent" });
	}
}
