// ============================================
// notifications/infrastructure/channels/apns-push.sender.ts — iOS push straight to APNs (ADR 070)
// ============================================
// An in-house client over `node:http2` with token auth: an ES256 JWT signed with the `.p8` key, renewed
// every 50 minutes (APNs refuses one older than an hour, and one renewed more often than every 20).

import { createPrivateKey, sign } from "node:crypto";
import { connect, constants, type ClientHttp2Session } from "node:http2";

import type { JsonObject } from "@workspace/shared";
import { z } from "zod";

import type { ChannelSendResult, PushMessage } from "../../application/ports/channel-senders.port";

const APNS_HOSTS: Readonly<Record<"sandbox" | "production", string>> = { sandbox: "https://api.sandbox.push.apple.com", production: "https://api.push.apple.com" };
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1_000;
/** A new token every 50 minutes. */
export const APNS_TOKEN_LIFETIME_MS = 50 * MS_PER_MINUTE;
const HTTP_OK = 200;
const HTTP_GONE = 410;
const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR_FLOOR = 500;
/** APNs reasons that mean the token will never work again. */
const INVALID_TOKEN_REASONS: readonly string[] = ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"];

const ApnsErrorSchema = z.object({ reason: z.string() });

export interface ApnsSettings {
	readonly keyId: string;
	readonly teamId: string;
	readonly bundleId: string;
	readonly privateKey: string;
	readonly environment: "sandbox" | "production";
}

function base64Url(value: Buffer | string): string {
	return Buffer.from(value).toString("base64url");
}

/** The APNs body of one push: the alert, a thread per kind of message, the badge and the tap data. */
export function apnsPayloadOf(message: PushMessage): JsonObject {
	return {
		aps: {
			alert: { title: message.title, body: message.body },
			sound: "default",
			// One thread per kind of message in Notification Centre.
			"thread-id": message.category.toLowerCase(),
			...(message.badge === null ? {} : { badge: message.badge }),
			// iOS shows a picture only through a Notification Service Extension, which downloads `imageUrl`.
			...(message.imageUrl === null ? {} : { "mutable-content": 1 }),
		},
		...message.data,
		...(message.imageUrl === null ? {} : { imageUrl: message.imageUrl }),
	};
}

export class ApnsPushSender {
	private session: ClientHttp2Session | null = null;
	private token: { readonly value: string; readonly issuedAt: number } | null = null;

	public constructor(
		private readonly settings: ApnsSettings,
		private readonly now: () => number = Date.now,
	) {}

	public async send(message: PushMessage): Promise<ChannelSendResult> {
		const payload = apnsPayloadOf(message);
		return this.post(message.token, payload, {
			"apns-push-type": "alert",
			"apns-priority": "10",
			...(message.collapseKey === null ? {} : { "apns-collapse-id": message.collapseKey }),
		});
	}

	public async sendSilentSync(token: string, badge: number): Promise<ChannelSendResult> {
		return this.post(token, { aps: { "content-available": 1, badge } }, { "apns-push-type": "background", "apns-priority": "5" });
	}

	/** The provider token (ES256 JWT), reused for {@link APNS_TOKEN_LIFETIME_MS}. */
	public providerToken(): string {
		const now = this.now();
		if (this.token !== null && now - this.token.issuedAt < APNS_TOKEN_LIFETIME_MS) {
			return this.token.value;
		}
		const header = base64Url(JSON.stringify({ alg: "ES256", kid: this.settings.keyId }));
		const claims = base64Url(JSON.stringify({ iss: this.settings.teamId, iat: Math.floor(now / MS_PER_SECOND) }));
		const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key: createPrivateKey(this.settings.privateKey.replace(/\\n/g, "\n")), dsaEncoding: "ieee-p1363" });
		const value = `${header}.${claims}.${base64Url(signature)}`;
		this.token = { value, issuedAt: now };
		return value;
	}

	private client(): ClientHttp2Session {
		if (this.session === null || this.session.closed || this.session.destroyed) {
			this.session = connect(APNS_HOSTS[this.settings.environment]);
			this.session.on("error", (): void => {
				this.session = null;
			});
		}
		return this.session;
	}

	private post(deviceToken: string, body: object, headers: Readonly<Record<string, string>>): Promise<ChannelSendResult> {
		return new Promise<ChannelSendResult>((resolve): void => {
			const request = this.client().request({
				[constants.HTTP2_HEADER_METHOD]: "POST",
				[constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
				authorization: `bearer ${this.providerToken()}`,
				"apns-topic": this.settings.bundleId,
				...headers,
			});
			let status = 0;
			let response = "";
			request.setEncoding("utf8");
			request.on("response", (incoming): void => {
				status = Number(incoming[constants.HTTP2_HEADER_STATUS]);
			});
			request.on("data", (chunk: string): void => {
				response += chunk;
			});
			request.on("end", (): void => {
				resolve(this.outcome(status, response));
			});
			request.on("error", (error: Error): void => {
				resolve({ kind: "failed", retryable: true, error: error.message });
			});
			request.end(JSON.stringify(body));
		});
	}

	private outcome(status: number, body: string): ChannelSendResult {
		if (status === HTTP_OK) {
			return { kind: "sent", providerMessageId: "apns" };
		}
		const reason = ApnsErrorSchema.safeParse(body === "" ? {} : JSON.parse(body));
		const why = reason.success ? reason.data.reason : `HTTP ${String(status)}`;
		if (status === HTTP_GONE || INVALID_TOKEN_REASONS.includes(why)) {
			return { kind: "invalid-destination", error: why };
		}
		return { kind: "failed", retryable: status === HTTP_TOO_MANY || status >= HTTP_SERVER_ERROR_FLOOR, error: why };
	}
}
