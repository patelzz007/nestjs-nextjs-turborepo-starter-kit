import type { EmailProvider } from "../../../../../config/api-env.fields";

/** One fully rendered email, ready to hand to a provider. */
export interface OutboundEmail {
	/** Email log row id — the idempotency key of the send, and the tag that links provider events back to the row. */
	readonly emailLogId: string;
	/** Template key (e.g. `login-verification`) — lets a local inbox be searched by template. */
	readonly templateKey: string;
	readonly from: string;
	readonly to: string;
	readonly subject: string;
	readonly html: string;
	readonly text: string;
	readonly cc: readonly string[];
	readonly bcc: readonly string[];
	readonly replyTo: string | undefined;
}

/** What a provider returns for an accepted email. */
export interface EmailDeliveryReceipt {
	/** The provider's own message id (logged, and returned to the caller as the send id). */
	readonly providerMessageId: string;
	/** Set only by Resend — stored on the email log row so delivery webhooks can match it. */
	readonly resendId: string | null;
}

/**
 * How a rejected delivery should be handled:
 * - `transient`    — retrying can help (network failure, provider 5xx);
 * - `rejected`     — the provider refused this email or our credentials; retrying cannot help;
 * - `rate-limited` — the provider's own sending quota is exhausted; not retried.
 */
export type EmailTransportFailureKind = "transient" | "rejected" | "rate-limited";

/** A provider-specific failure translated into the application's terms. */
export class EmailTransportError extends Error {
	public constructor(
		message: string,
		public readonly kind: EmailTransportFailureKind,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "EmailTransportError";
	}
}

/**
 * Delivers one rendered email through one provider. Implementations translate
 * every provider failure into an {@link EmailTransportError}; the timeout,
 * retries and email-log bookkeeping stay in `EmailSenderService`.
 */
export abstract class EmailTransport {
	public abstract readonly provider: EmailProvider;

	/** Hand the email to the provider. Resolves once the provider accepted it. */
	public abstract deliver(email: OutboundEmail): Promise<EmailDeliveryReceipt>;
}
