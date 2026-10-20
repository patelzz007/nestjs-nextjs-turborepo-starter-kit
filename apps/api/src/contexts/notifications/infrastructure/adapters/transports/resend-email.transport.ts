import { Resend } from "resend";

import { CaughtValueSchema, ResendSendResponseSchema, type CaughtValue, type ResendSendResponse } from "@workspace/shared";

import { readCaughtErrorCode, readCaughtErrorMessage } from "../../../../../platform/infrastructure/utils/caught-error";
import type { EmailProvider } from "../../../../../config/api-env.fields";
import { EmailTransport, EmailTransportError, type EmailDeliveryReceipt, type EmailTransportFailureKind, type OutboundEmail } from "./email-transport";

/** Resend tag that carries the email log id — webhooks echo it, so they match the row before the send call returns. */
export const EMAIL_LOG_ID_TAG = "email_log_id";

const RATE_LIMIT_EXCEEDED_CODE = "rate_limit_exceeded";

/**
 * Resend error codes that never succeed on retry: invalid payload, credentials,
 * account limits, or an idempotency key reused for a different payload. Every
 * other code (`application_error`, `internal_server_error`,
 * `concurrent_idempotent_requests`, network failures) is retried.
 */
const NON_RETRYABLE_RESEND_CODES: ReadonlySet<string> = new Set([
	"validation_error",
	"missing_api_key",
	"invalid_api_key",
	"restricted_api_key",
	"invalid_from_address",
	"missing_required_field",
	"invalid_parameter",
	"invalid_attachment",
	"invalid_access",
	"invalid_region",
	"not_found",
	"method_not_allowed",
	"security_error",
	"invalid_idempotency_key",
	"invalid_idempotent_request",
	"monthly_quota_exceeded",
	"daily_quota_exceeded",
]);

/**
 * Delivers through the Resend API — the provider of every deployed
 * environment. Each call carries the email log id as Resend `idempotencyKey`,
 * so a retry after a timeout replays the original result instead of sending twice.
 */
export class ResendEmailTransport extends EmailTransport {
	public readonly provider: EmailProvider = "resend";
	/** `null` when RESEND_API_KEY is unset — only allowed with EMAIL_MODE=log-only/noop (enforced at boot). */
	private readonly client: Resend | null;

	public constructor(apiKey: string | null) {
		super();
		this.client = apiKey === null ? null : new Resend(apiKey);
	}

	public async deliver(email: OutboundEmail): Promise<EmailDeliveryReceipt> {
		const client: Resend | null = this.client;
		if (client === null) {
			// Unreachable in a valid deployment: EMAIL_MODE=send with EMAIL_PROVIDER=resend requires RESEND_API_KEY at boot.
			throw new EmailTransportError("RESEND_API_KEY is not configured — set it, or use EMAIL_PROVIDER=mailpit / EMAIL_MODE=log-only", "rejected");
		}
		let result: ResendSendResponse;
		try {
			result = ResendSendResponseSchema.parse(
				await client.emails.send(
					{
						from: email.from,
						to: email.to,
						subject: email.subject,
						html: email.html,
						text: email.text,
						tags: [{ name: EMAIL_LOG_ID_TAG, value: email.emailLogId }],
						...(email.cc.length > 0 ? { cc: [...email.cc] } : {}),
						...(email.bcc.length > 0 ? { bcc: [...email.bcc] } : {}),
						...(email.replyTo === undefined ? {} : { replyTo: email.replyTo }),
					},
					{ idempotencyKey: `email-log/${email.emailLogId}` },
				),
			);
		} catch (error) {
			throw this.translateRejection(CaughtValueSchema.parse(error));
		}
		if (result.error !== null) {
			// Resend reports its error code in `name`.
			throw new EmailTransportError(result.error.message, failureKindOf(result.error.name));
		}
		const id: string | undefined = result.data?.id;
		if (id === undefined) {
			throw new EmailTransportError("Resend returned no email id", "transient");
		}
		return { providerMessageId: id, resendId: id };
	}

	/** A thrown SDK call (network failure, non-Error rejection) → transport error, keeping any Resend error code. */
	private translateRejection(value: CaughtValue): EmailTransportError {
		const code: string | undefined = readCaughtErrorCode(value);
		return new EmailTransportError(readCaughtErrorMessage(value), code === undefined ? "transient" : failureKindOf(code), { cause: value });
	}
}

function failureKindOf(code: string): EmailTransportFailureKind {
	if (code === RATE_LIMIT_EXCEEDED_CODE) {
		return "rate-limited";
	}
	return NON_RETRYABLE_RESEND_CODES.has(code) ? "rejected" : "transient";
}
