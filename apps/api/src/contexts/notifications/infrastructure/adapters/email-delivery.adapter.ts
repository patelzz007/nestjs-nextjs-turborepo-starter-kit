import { Inject, Injectable } from "@nestjs/common";
import { CaughtValueSchema, type CaughtValue, type EmailRenderContext } from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { LogService } from "../../../../platform/infrastructure/logging/logs.service";
import { readCaughtErrorMessage } from "../../../../platform/infrastructure/utils/caught-error";
import { rejectAfter } from "../../../../platform/infrastructure/utils/promise-timeout";
import { EmailDeliveryFailure, type EmailDeliveryPort, type EmailDeliveryReceipt } from "../../application/ports/email-delivery.port";
import { EMAIL_RENDER_CONTEXT } from "../../application/ports/notifications.tokens";
import type { BaseEmailProps, BaseEmailTemplate } from "../../domain/templates/base/base-email-template";
import { maskEmail } from "./mask-email";
import { EmailTransport, EmailTransportError } from "./transports/email-transport";

/** Thrown when one provider call exceeds `EMAIL_TIMEOUT_MS`. */
class EmailTimeoutError extends Error {
	public constructor() {
		super("Email send timed out");
		this.name = "EmailTimeoutError";
	}
}

/**
 * One provider call through the transport `EMAIL_PROVIDER` selects (Resend, or
 * a local Mailpit). Owns everything about the call itself: the `EMAIL_TEST_TO`
 * override, rendering, the per-call timeout, and classifying every failure
 * into an {@link EmailDeliveryFailure}. The email log id travels with the call
 * (Resend uses it as its idempotency key), so a retry after a timeout — by the
 * queue or the inline loop — can never send twice to a real recipient.
 */
@Injectable()
export class EmailDeliveryAdapter implements EmailDeliveryPort {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		private readonly transport: EmailTransport,
		@Inject(EMAIL_RENDER_CONTEXT) private readonly renderContext: EmailRenderContext,
	) {}

	public async deliver(emailLogId: string, template: BaseEmailTemplate<BaseEmailProps>): Promise<EmailDeliveryReceipt> {
		const props = template.props;
		const to = this.effectiveRecipient(template.subject, props.to);
		const delivery = this.transport.deliver({
			emailLogId,
			templateKey: template.key,
			from: this.config.email.fromAddress,
			to,
			subject: template.subject,
			html: template.renderHtml(this.renderContext),
			text: template.renderText(this.renderContext),
			cc: props.cc ?? [],
			bcc: props.bcc ?? [],
			replyTo: props.replyTo ?? this.config.email.replyTo,
		});
		try {
			// Not every provider SDK takes an AbortSignal — a hung call is cut by the timeout branch.
			const receipt = await Promise.race([delivery, rejectAfter<Awaited<typeof delivery>>(this.config.email.timeoutMs, new EmailTimeoutError())]);
			this.logService.info(`Sent "${template.subject}" to ${maskEmail(to)} via ${this.transport.provider} (${receipt.providerMessageId})`, { context: "EmailDelivery" });
			return { providerMessageId: receipt.providerMessageId, resendId: receipt.resendId, deliveredTo: to };
		} catch (error) {
			throw this.classify(CaughtValueSchema.parse(error));
		}
	}

	/** The `EMAIL_TEST_TO` override (development): every email goes to one inbox. */
	public effectiveRecipient(subject: string, to: string): string {
		const override: string | undefined = this.config.email.testTo;
		if (override !== undefined && override !== to) {
			this.logService.info(`EMAIL_TEST_TO override: "${subject}" redirected from ${maskEmail(to)} to ${maskEmail(override)}`, { context: "EmailDelivery" });
		}
		return override ?? to;
	}

	/** Map a provider failure to a reason, and decide whether retrying can help. */
	private classify(value: CaughtValue): EmailDeliveryFailure {
		if (value instanceof EmailTimeoutError) {
			// Safe to retry: the email log id makes a repeated Resend call replay, not resend.
			return new EmailDeliveryFailure("timeout", value.message, true, { cause: value });
		}
		if (value instanceof EmailTransportError) {
			switch (value.kind) {
				case "rate-limited":
					return new EmailDeliveryFailure("rate-limited", `Email provider rate limit exceeded (${this.transport.provider})`, false, { cause: value });
				case "rejected":
					return new EmailDeliveryFailure("api-error", value.message, false, { cause: value });
				case "transient":
					return new EmailDeliveryFailure("api-error", value.message, true, { cause: value });
			}
		}
		return new EmailDeliveryFailure("api-error", readCaughtErrorMessage(value), true);
	}
}
