import type { OnApplicationBootstrap } from "@nestjs/common";

import {
	CaughtValueSchema,
	JsonValueSchema,
	MailpitErrorResponseSchema,
	MailpitSendRequestSchema,
	MailpitSendResponseSchema,
	type JsonValue,
	type MailpitAddress,
	type MailpitSendRequest,
} from "@workspace/shared";

import { readCaughtErrorMessage } from "../../../../../platform/infrastructure/utils/caught-error";
import type { EmailProvider } from "../../../../../config/api-env.fields";
import type { EmailConfig } from "../../../../../config/api-config.schema";
import type { LogService } from "../../../../../platform/infrastructure/logging/logs.service";
import { EmailTransport, EmailTransportError, type EmailDeliveryReceipt, type OutboundEmail } from "./email-transport";

/** Mailpit's HTTP send endpoint (https://mailpit.axllent.org/docs/api-v1/). */
const MAILPIT_SEND_PATH = "/api/v1/send";
/** Mailpit's readiness endpoint — probed once at boot. */
const MAILPIT_READY_PATH = "/readyz";
/** Header carrying the email log id, so a message in the inbox can be traced back to its row. */
export const MAILPIT_EMAIL_LOG_ID_HEADER = "X-Email-Log-Id";
/** The boot probe only answers "is it running?" — a local process replies at once or not at all. */
const MAILPIT_PROBE_TIMEOUT_MS = 2_000;
const HTTP_SERVER_ERROR_MIN_STATUS = 500;

/**
 * Delivers into a local Mailpit inbox (`EMAIL_PROVIDER=mailpit`, local
 * development only — refused on any deployed environment at boot). Nothing
 * leaves the machine; the web inbox and its HTTP API (`pnpm mail:latest`) let
 * a developer — or an AI agent driving the app — read one-time codes and links.
 *
 * Mailpit has no idempotency keys: a retry after a timeout can store a second
 * copy. That is harmless in a local inbox and the reason this transport is never
 * allowed where real recipients exist.
 */
export class MailpitEmailTransport extends EmailTransport implements OnApplicationBootstrap {
	public readonly provider: EmailProvider = "mailpit";

	public constructor(
		private readonly config: EmailConfig,
		private readonly logService: LogService,
	) {
		super();
	}

	/** Warn once at boot when Mailpit is not running — every send would fail until it is started. */
	public async onApplicationBootstrap(): Promise<void> {
		if (this.config.mode !== "send") {
			return;
		}
		if (!(await this.isReachable())) {
			this.logService.warn(
				`EMAIL_PROVIDER=mailpit but no Mailpit answers at ${this.config.mailpitUrl} — emails will fail until it runs. Start it with \`pnpm mailpit\` (install: \`brew install mailpit\`), or set EMAIL_PROVIDER=resend.`,
				{ context: "MailpitEmailTransport" },
			);
		}
	}

	public async deliver(email: OutboundEmail): Promise<EmailDeliveryReceipt> {
		const body: MailpitSendRequest = MailpitSendRequestSchema.parse({
			From: { Email: email.from },
			To: [{ Email: email.to }],
			Cc: email.cc.map((address: string): MailpitAddress => ({ Email: address })),
			Bcc: [...email.bcc],
			ReplyTo: email.replyTo === undefined ? [] : [{ Email: email.replyTo }],
			Subject: email.subject,
			Text: email.text,
			HTML: email.html,
			Tags: [email.templateKey],
			Headers: { [MAILPIT_EMAIL_LOG_ID_HEADER]: email.emailLogId },
		});
		let response: Response;
		try {
			response = await fetch(`${this.config.mailpitUrl}${MAILPIT_SEND_PATH}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.config.timeoutMs),
			});
		} catch (error) {
			const detail = readCaughtErrorMessage(CaughtValueSchema.parse(error));
			throw new EmailTransportError(`Mailpit is not reachable at ${this.config.mailpitUrl} (${detail}) — start it with \`pnpm mailpit\``, "transient", { cause: error });
		}
		const payload: JsonValue | null = parseJsonBody(await response.text());
		if (!response.ok) {
			const error = MailpitErrorResponseSchema.safeParse(payload);
			const detail: string = error.success ? error.data.Error : `HTTP ${String(response.status)}`;
			throw new EmailTransportError(`Mailpit refused the email: ${detail}`, response.status >= HTTP_SERVER_ERROR_MIN_STATUS ? "transient" : "rejected");
		}
		const accepted = MailpitSendResponseSchema.safeParse(payload);
		if (!accepted.success) {
			throw new EmailTransportError("Mailpit returned no message id", "transient");
		}
		return { providerMessageId: accepted.data.ID, resendId: null };
	}

	private async isReachable(): Promise<boolean> {
		try {
			const response = await fetch(`${this.config.mailpitUrl}${MAILPIT_READY_PATH}`, { signal: AbortSignal.timeout(MAILPIT_PROBE_TIMEOUT_MS) });
			return response.ok;
		} catch {
			return false;
		}
	}
}

/** Mailpit answers JSON, except for some proxy/transport errors — those carry no detail worth parsing. */
function parseJsonBody(text: string): JsonValue | null {
	try {
		const parsed = JsonValueSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}
