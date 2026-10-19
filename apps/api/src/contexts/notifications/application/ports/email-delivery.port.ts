import type { BaseEmailProps, BaseEmailTemplate } from "../../domain/templates/base/base-email-template";

/** What a provider returned for an accepted email. */
export interface EmailDeliveryReceipt {
	readonly providerMessageId: string;
	/** Set only by Resend — stored on the row so delivery webhooks can match it. */
	readonly resendId: string | null;
	/** The address it actually went to (after the `EMAIL_TEST_TO` override). */
	readonly deliveredTo: string;
}

/** Mirrors the failure reasons of `EmailSendResultSchema`. */
export type EmailDeliveryFailureReason = "timeout" | "rate-limited" | "api-error";

/** A provider call failed, classified: whether retrying (same idempotency key) can help. */
export class EmailDeliveryFailure extends Error {
	public constructor(
		public readonly reason: EmailDeliveryFailureReason,
		message: string,
		public readonly retryable: boolean,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "EmailDeliveryFailure";
	}
}

/**
 * ONE provider call for one email log row, idempotent by the row id (Resend
 * uses it as its idempotency key), cut off after `EMAIL_TIMEOUT_MS`. Throws
 * {@link EmailDeliveryFailure} for every provider failure.
 */
export interface EmailDeliveryPort {
	deliver(emailLogId: string, template: BaseEmailTemplate<BaseEmailProps>): Promise<EmailDeliveryReceipt>;
}
