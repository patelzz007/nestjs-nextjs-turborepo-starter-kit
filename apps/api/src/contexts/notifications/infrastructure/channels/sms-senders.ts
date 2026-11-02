// ============================================
// notifications/infrastructure/channels/sms-senders.ts — the SMS sender `SMS_PROVIDER` selects (ADR 070)
// ============================================

import { z } from "zod";

import type { ChannelSendResult, SmsMessage, SmsSender } from "../../application/ports/channel-senders.port";
import type { EmailTransport } from "../adapters/transports/email-transport";

/** `SMS_PROVIDER=none`: records SUPPRESSED (provider-disabled). */
export class DisabledSmsSender implements SmsSender {
	public readonly provider: string = "none";
	public readonly live: boolean = false;

	public send(): Promise<ChannelSendResult> {
		return Promise.resolve({ kind: "disabled" });
	}
}

export const MAILPIT_SMS_DOMAIN = "sms.localhost";
/** Characters of the SMS shown in the Mailpit subject line. */
const SUBJECT_PREVIEW_LENGTH = 60;

/**
 * `SMS_PROVIDER=mailpit` (development): each SMS lands in Mailpit as an email to `<e164>@sms.localhost`,
 * so `pnpm mail:latest --to +60123456789@sms.localhost --code` reads a code.
 */
export class MailpitSmsSender implements SmsSender {
	public readonly provider: string = "mailpit";
	public readonly live: boolean = false;

	public constructor(
		private readonly mailpit: EmailTransport,
		private readonly from: string,
	) {}

	public async send(message: SmsMessage): Promise<ChannelSendResult> {
		try {
			const receipt = await this.mailpit.deliver({
				emailLogId: message.deliveryId,
				templateKey: "sms",
				from: this.from,
				to: `${message.to}@${MAILPIT_SMS_DOMAIN}`,
				subject: `[sms] ${message.text.slice(0, SUBJECT_PREVIEW_LENGTH)}`,
				html: `<pre>${message.text}</pre>`,
				text: message.text,
				cc: [],
				bcc: [],
				replyTo: undefined,
				headers: {},
			});
			return { kind: "sent", providerMessageId: receipt.providerMessageId };
		} catch (error) {
			return { kind: "failed", retryable: true, error: error instanceof Error ? error.message : "Mailpit refused the SMS" };
		}
	}
}

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR_FLOOR = 500;
/** Twilio error codes meaning the number will never take an SMS (invalid, unreachable, a landline, opted out). */
const TWILIO_INVALID_NUMBER_CODES: readonly number[] = [21211, 21214, 21610, 21612, 21614];

const TwilioMessageSchema = z.object({ sid: z.string() });
const TwilioErrorSchema = z.object({ code: z.number(), message: z.string() });

export interface TwilioSettings {
	readonly accountSid: string;
	readonly authToken: string;
	readonly messagingServiceSid: string;
	/** Where Twilio posts delivery status (`/webhooks/twilio/status`). */
	readonly statusCallbackUrl: string;
}

/** `SMS_PROVIDER=twilio`: the REST API through a Messaging Service (sender pool and opt-out handling). */
export class TwilioSmsSender implements SmsSender {
	public readonly provider: string = "twilio";
	public readonly live: boolean = true;

	public constructor(
		private readonly settings: TwilioSettings,
		private readonly fetcher: typeof fetch = fetch,
	) {}

	public async send(message: SmsMessage): Promise<ChannelSendResult> {
		const body = new URLSearchParams({
			To: message.to,
			MessagingServiceSid: this.settings.messagingServiceSid,
			Body: message.text,
			StatusCallback: this.settings.statusCallbackUrl,
		});
		let response: Response;
		try {
			response = await this.fetcher(`${TWILIO_API}/Accounts/${this.settings.accountSid}/Messages.json`, {
				method: "POST",
				headers: {
					authorization: `Basic ${Buffer.from(`${this.settings.accountSid}:${this.settings.authToken}`).toString("base64")}`,
					"content-type": "application/x-www-form-urlencoded",
				},
				body,
			});
		} catch (error) {
			return { kind: "failed", retryable: true, error: error instanceof Error ? error.message : "Twilio unreachable" };
		}
		const json: string = await response.text();
		if (response.ok) {
			return { kind: "sent", providerMessageId: TwilioMessageSchema.parse(JSON.parse(json)).sid };
		}
		const failure = TwilioErrorSchema.safeParse(json === "" ? {} : JSON.parse(json));
		if (failure.success && TWILIO_INVALID_NUMBER_CODES.includes(failure.data.code)) {
			return { kind: "invalid-destination", error: `${String(failure.data.code)}: ${failure.data.message}` };
		}
		return {
			kind: "failed",
			retryable: response.status === HTTP_TOO_MANY || response.status >= HTTP_SERVER_ERROR_FLOOR,
			error: failure.success ? `${String(failure.data.code)}: ${failure.data.message}` : `HTTP ${String(response.status)}`,
		};
	}
}
