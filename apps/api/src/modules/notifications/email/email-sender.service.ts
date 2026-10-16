import { Injectable, Optional } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";

import {
	CaughtValueSchema,
	EmailRenderContextSchema,
	EmailSendResultSchema,
	EmailTemplateKeySchema,
	type CaughtValue,
	type EmailRenderContext,
	type EmailSendResult,
} from "@workspace/shared";

import { RequestContextService } from "../../../common/context/request-context";
import { readCaughtErrorMessage } from "../../../common/utils/caught-error";
import { rejectAfter } from "../../../common/utils/promise-timeout";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { BaseEmailTemplate, type BaseEmailProps } from "./base/base-email-template";
import { EmailLogService, type EmailAttemptIdentity } from "./email-log.service";
import { EmailQueueService } from "./email-queue.service";
import { EmailRecipientRateLimiter } from "./email-recipient-rate-limiter";
import { serializeEmailTemplateProps } from "./email-template.factory";
import { EmailTransport, EmailTransportError, type EmailDeliveryReceipt } from "./transports/email-transport";

/** Thrown when one provider call exceeds `EMAIL_TIMEOUT_MS`. */
class EmailTimeoutError extends Error {
	public constructor() {
		super("Email send timed out");
		this.name = "EmailTimeoutError";
	}
}

/** Inline-retry backoff: 300 ms × 2^(n-2), ±40 % jitter. */
const RETRY_BASE_DELAY_MS = 300;
const RETRY_JITTER_MIN_FACTOR = 0.6;
const RETRY_JITTER_SPAN = 0.8;

/** Who triggered a send, recorded on the email log row (the row IS the domain audit record of the send). */
export interface EmailSendAudit {
	readonly trigger: "admin-test-send";
	readonly actorUserId: string;
}

/** Options for {@link EmailSenderService.send}. */
export interface EmailSendOptions {
	readonly audit?: EmailSendAudit;
}

/** Attempt bookkeeping of one queued delivery (from the BullMQ job). */
export interface QueuedDeliveryAttempt {
	/** 1-based number of this execution. */
	readonly attemptNumber: number;
	readonly maxAttempts: number;
}

/** Outcome kinds a failed provider call maps to — mirrors `EmailSendResultSchema`. */
type SendFailureReason = "timeout" | "rate-limited" | "api-error";

interface ClassifiedFailure {
	readonly reason: SendFailureReason;
	readonly detail: string;
	readonly retryable: boolean;
}

/**
 * Delivery engine for every transactional email.
 *
 * Owns everything that is NOT template content: zod re-validation of props,
 * the `EMAIL_MODE` switch, the `EMAIL_TEST_TO` override, the per-recipient
 * rate limit, retries, the per-call timeout, PII-safe logging, and the email
 * log. Templates stay pure renderers (rule 19); the provider call itself is the
 * {@link EmailTransport} that `EMAIL_PROVIDER` selects (Resend, or a local Mailpit).
 *
 * Delivery contract:
 * 1. The email log row is written FIRST (`pending`). If it cannot be written,
 *    nothing is sent (`persistence` failure) — no email leaves unlogged.
 * 2. Every provider call carries the row id (Resend uses it as its
 *    `idempotencyKey`), so a retry after a timeout — inline or by the queue —
 *    can never send twice to a real recipient.
 * 3. Retries have ONE owner: with BullMQ, the queue (one provider call per
 *    job execution, non-retryable failures stop immediately); without it, a
 *    bounded inline loop.
 * 4. The outcome finalizes the row exactly once (conditional update) and
 *    emits one `email.log.updated` event in the same transaction.
 *
 * `send()` never throws: callers (auth flows) inspect the `EmailSendResult`.
 */
@Injectable()
export class EmailSenderService {
	private readonly renderContext: EmailRenderContext;

	public constructor(
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		private readonly emailLogService: EmailLogService,
		private readonly rateLimiter: EmailRecipientRateLimiter,
		private readonly requestContext: RequestContextService,
		private readonly transport: EmailTransport,
		@Optional() private readonly emailQueue?: EmailQueueService,
	) {
		this.renderContext = EmailRenderContextSchema.parse({
			appName: this.config.runtime.appName,
			appUrl: this.config.clientApps.webUrl,
			supportEmail: this.config.email.fromAddress,
		});
	}

	// ── Public API ─────────────────────────────────────────────────────────

	/** Validate, log and deliver one template (queued when BullMQ is on). Never throws — inspect the result. */
	public async send<TProps extends BaseEmailProps>(template: BaseEmailTemplate<TProps>, options?: EmailSendOptions): Promise<EmailSendResult> {
		// 1. Re-validate props — a template constructed with bad props must never reach the network.
		const parsed = template.propsSchema.safeParse(template.props);
		if (!parsed.success) {
			const issue = parsed.error.issues.at(0);
			const detail = issue === undefined ? "props failed validation" : `${issue.path.join(".")}: ${issue.message}`;
			return EmailSendResultSchema.parse({ ok: false, reason: "invalid-props", detail });
		}
		const effectiveTo: string = this.effectiveRecipient(template.subject, parsed.data.to);
		const metadata = this.auditMetadata(options?.audit);

		// 2. Simulated modes (development / test only — refused on a deployed
		//    production environment by the config schema) never touch the network.
		const mode = this.config.email.mode;
		if (mode === "noop" || mode === "log-only") {
			return this.simulate(template, effectiveTo, mode, metadata);
		}

		// 3. Rate limit, then the pending row — before anything is sent or queued.
		if (!(await this.acquireRateLimit(effectiveTo))) {
			return EmailSendResultSchema.parse({ ok: false, reason: "rate-limited" });
		}
		let emailLogId: string;
		try {
			emailLogId = (
				await this.emailLogService.create({
					templateKey: template.key,
					to: effectiveTo,
					subject: template.subject,
					status: "pending",
					metadata: { mode, provider: this.transport.provider, ...metadata },
				})
			).id;
		} catch (error) {
			const detail = readCaughtErrorMessage(CaughtValueSchema.parse(error));
			this.logService.error(`Email log row could not be written — "${template.subject}" NOT sent to ${this.maskEmail(effectiveTo)}: ${detail}`, {
				context: "EmailSenderService",
			});
			return EmailSendResultSchema.parse({ ok: false, reason: "persistence", detail });
		}
		const attempt: EmailAttemptIdentity = { templateKey: template.key, to: effectiveTo };

		// 4. Queue when BullMQ is enabled — the worker delivers via deliverQueued().
		if (this.emailQueue?.isEnabled() === true) {
			return this.enqueue(emailLogId, attempt, template, parsed.data);
		}

		// 5. Inline delivery with a bounded retry loop.
		return this.deliverInline(emailLogId, attempt, template, parsed.data);
	}

	/**
	 * Deliver one queued email: ONE provider call per job execution — BullMQ
	 * owns retries and backoff. A row that is no longer `pending` was already
	 * finalized (redelivered job) and is skipped. Throws to make BullMQ retry;
	 * throws `UnrecoverableError` when retrying cannot help.
	 */
	public async deliverQueued<TProps extends BaseEmailProps>(emailLogId: string, template: BaseEmailTemplate<TProps>, attempt: QueuedDeliveryAttempt): Promise<void> {
		const status = await this.emailLogService.findStatus(emailLogId);
		if (status === null) {
			throw new UnrecoverableError(`Email log row ${emailLogId} does not exist`);
		}
		if (status !== "pending") {
			return;
		}
		const parsed = template.propsSchema.safeParse(template.props);
		if (!parsed.success) {
			await this.emailLogService.finalizeFailed(emailLogId, { templateKey: template.key, to: template.props.to }, "queued props failed validation", null);
			throw new UnrecoverableError(`Queued email ${emailLogId} has invalid props`);
		}
		const identity: EmailAttemptIdentity = { templateKey: template.key, to: this.effectiveRecipient(template.subject, parsed.data.to) };
		const startedAt: number = performance.now();
		try {
			const receipt = await this.callProvider(emailLogId, identity.to, template, parsed.data);
			await this.emailLogService.finalizeSent(emailLogId, identity, receipt.resendId, Math.round(performance.now() - startedAt));
		} catch (error) {
			const failure = this.classify(CaughtValueSchema.parse(error));
			const lastAttempt: boolean = attempt.attemptNumber >= attempt.maxAttempts;
			if (!failure.retryable || lastAttempt) {
				await this.emailLogService.finalizeFailed(emailLogId, identity, failure.detail, Math.round(performance.now() - startedAt));
				this.logService.error(`Failed to send "${template.subject}" to ${this.maskEmail(identity.to)}: ${failure.detail}`, { context: "EmailSenderService" });
				throw new UnrecoverableError(failure.detail);
			}
			throw new Error(failure.detail, { cause: error });
		}
	}

	// ── Delivery internals ─────────────────────────────────────────────────

	private async simulate<TProps extends BaseEmailProps>(
		template: BaseEmailTemplate<TProps>,
		effectiveTo: string,
		mode: "noop" | "log-only",
		metadata: Readonly<Record<string, string>>,
	): Promise<EmailSendResult> {
		try {
			const row = await this.emailLogService.create({
				templateKey: template.key,
				to: effectiveTo,
				subject: template.subject,
				status: "sent",
				metadata: { mode, ...metadata },
			});
			if (mode === "log-only") {
				this.logService.info(`[log-only] ${template.subject} → ${this.maskEmail(effectiveTo)}\n${template.renderText(this.renderContext)}`, { context: "EmailSenderService" });
			} else {
				this.logService.info(`[noop] Would send "${template.subject}" to ${this.maskEmail(effectiveTo)}`, { context: "EmailSenderService" });
			}
			return EmailSendResultSchema.parse({ ok: true, id: row.id, mode });
		} catch (error) {
			const detail = readCaughtErrorMessage(CaughtValueSchema.parse(error));
			return EmailSendResultSchema.parse({ ok: false, reason: "persistence", detail });
		}
	}

	private async enqueue<TProps extends BaseEmailProps>(
		emailLogId: string,
		attempt: EmailAttemptIdentity,
		template: BaseEmailTemplate<TProps>,
		props: TProps,
	): Promise<EmailSendResult> {
		const queue = this.emailQueue;
		try {
			if (queue === undefined) {
				throw new Error("Email queue is not wired");
			}
			await queue.enqueue({ emailLogId, templateKey: EmailTemplateKeySchema.parse(template.key), props: serializeEmailTemplateProps(props) });
			return EmailSendResultSchema.parse({ ok: true, id: emailLogId, mode: "queued" });
		} catch (error) {
			const detail = readCaughtErrorMessage(CaughtValueSchema.parse(error));
			await this.finalizeFailedSafely(emailLogId, attempt, `queue unavailable: ${detail}`);
			return EmailSendResultSchema.parse({ ok: false, reason: "queue", detail });
		}
	}

	private async deliverInline<TProps extends BaseEmailProps>(
		emailLogId: string,
		attempt: EmailAttemptIdentity,
		template: BaseEmailTemplate<TProps>,
		props: TProps,
	): Promise<EmailSendResult> {
		const startedAt: number = performance.now();
		let failure: ClassifiedFailure | null = null;
		for (let attemptNumber = 1; attemptNumber <= this.config.email.maxAttempts; attemptNumber += 1) {
			if (attemptNumber > 1) {
				await this.backoff(attemptNumber);
			}
			try {
				const receipt = await this.callProvider(emailLogId, attempt.to, template, props);
				await this.finalizeSentSafely(emailLogId, attempt, receipt, Math.round(performance.now() - startedAt));
				this.logService.info(`Sent "${template.subject}" to ${this.maskEmail(attempt.to)} via ${this.transport.provider} (${receipt.providerMessageId})`, {
					context: "EmailSenderService",
				});
				return EmailSendResultSchema.parse({ ok: true, id: receipt.providerMessageId, mode: "send" });
			} catch (error) {
				failure = this.classify(CaughtValueSchema.parse(error));
				if (!failure.retryable) {
					break;
				}
			}
		}
		const final: ClassifiedFailure = failure ?? { reason: "api-error", detail: "Email send failed", retryable: false };
		await this.finalizeFailedSafely(emailLogId, attempt, final.detail, Math.round(performance.now() - startedAt));
		this.logService.error(`Failed to send "${template.subject}" to ${this.maskEmail(attempt.to)}: ${final.detail}`, { context: "EmailSenderService" });
		return EmailSendResultSchema.parse({ ok: false, reason: final.reason, detail: final.detail });
	}

	/**
	 * One provider call through the configured transport, idempotent by the
	 * email log id, cut off after `EMAIL_TIMEOUT_MS`.
	 */
	private async callProvider<TProps extends BaseEmailProps>(
		emailLogId: string,
		to: string,
		template: BaseEmailTemplate<TProps>,
		props: TProps,
	): Promise<EmailDeliveryReceipt> {
		const delivery: Promise<EmailDeliveryReceipt> = this.transport.deliver({
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
		// Not every provider SDK takes an AbortSignal — a hung call is cut by the timeout branch.
		return Promise.race([delivery, rejectAfter<EmailDeliveryReceipt>(this.config.email.timeoutMs, new EmailTimeoutError())]);
	}

	private async backoff(attemptNumber: number): Promise<void> {
		const baseDelay: number = RETRY_BASE_DELAY_MS * 2 ** (attemptNumber - 2);
		const delay: number = baseDelay * (RETRY_JITTER_MIN_FACTOR + Math.random() * RETRY_JITTER_SPAN);
		await new Promise<void>((resolve): void => {
			setTimeout(resolve, delay);
		});
	}

	/**
	 * The email WAS sent; failing to record that must not report a failure
	 * (the caller would resend). The row stays `pending` and the delivery
	 * webhook (matched by the `email_log_id` tag) moves it forward later.
	 */
	private async finalizeSentSafely(emailLogId: string, attempt: EmailAttemptIdentity, receipt: EmailDeliveryReceipt, durationMs: number): Promise<void> {
		try {
			await this.emailLogService.finalizeSent(emailLogId, attempt, receipt.resendId, durationMs);
		} catch (error) {
			this.logService.error(
				`Email ${emailLogId} was sent (${receipt.providerMessageId}) but its log row could not be finalized: ${readCaughtErrorMessage(CaughtValueSchema.parse(error))}`,
				{
					context: "EmailSenderService",
				},
			);
		}
	}

	/** Like {@link finalizeSentSafely}: the failure result still reaches the caller; the stuck row is logged as an error. */
	private async finalizeFailedSafely(emailLogId: string, attempt: EmailAttemptIdentity, detail: string, durationMs: number | null = null): Promise<void> {
		try {
			await this.emailLogService.finalizeFailed(emailLogId, attempt, detail, durationMs);
		} catch (error) {
			this.logService.error(`Email ${emailLogId} failed (${detail}) and its log row could not be finalized: ${readCaughtErrorMessage(CaughtValueSchema.parse(error))}`, {
				context: "EmailSenderService",
			});
		}
	}

	private async acquireRateLimit(recipient: string): Promise<boolean> {
		try {
			const allowed = await this.rateLimiter.tryAcquire(recipient);
			if (!allowed) {
				this.logService.warn(`Rate limit hit for ${this.maskEmail(recipient)}`, { context: "EmailSenderService" });
			}
			return allowed;
		} catch (error) {
			// Fails closed: an unavailable limiter must not turn into unlimited sends.
			this.logService.error(`Email rate limiter unavailable — send refused: ${readCaughtErrorMessage(CaughtValueSchema.parse(error))}`, { context: "EmailSenderService" });
			return false;
		}
	}

	private effectiveRecipient(subject: string, to: string): string {
		const override: string | undefined = this.config.email.testTo;
		if (override !== undefined && override !== to) {
			this.logService.info(`EMAIL_TEST_TO override: "${subject}" redirected from ${this.maskEmail(to)} to ${this.maskEmail(override)}`, { context: "EmailSenderService" });
		}
		return override ?? to;
	}

	/** Audit fields stored on the email log row for a send someone triggered explicitly. */
	private auditMetadata(audit: EmailSendAudit | undefined): Readonly<Record<string, string>> {
		if (audit === undefined) {
			return {};
		}
		const context = this.requestContext.current();
		return {
			trigger: audit.trigger,
			actorUserId: audit.actorUserId,
			...(context === undefined ? {} : { correlationId: context.correlationId }),
			...(context?.ip === undefined ? {} : { ipAddress: context.ip }),
			...(context?.userAgent === undefined ? {} : { userAgent: context.userAgent }),
			...(context?.principal?.impersonatorId === undefined ? {} : { impersonatorUserId: context.principal.impersonatorId }),
		};
	}

	/** Map a provider failure to a reason, and decide whether retrying can help. */
	private classify(value: CaughtValue): ClassifiedFailure {
		if (value instanceof EmailTimeoutError) {
			// Safe to retry: the email log id makes a repeated Resend call replay, not resend.
			return { reason: "timeout", detail: value.message, retryable: true };
		}
		if (value instanceof EmailTransportError) {
			switch (value.kind) {
				case "rate-limited":
					return { reason: "rate-limited", detail: `Email provider rate limit exceeded (${this.transport.provider})`, retryable: false };
				case "rejected":
					return { reason: "api-error", detail: value.message, retryable: false };
				case "transient":
					return { reason: "api-error", detail: value.message, retryable: true };
			}
		}
		return { reason: "api-error", detail: readCaughtErrorMessage(value), retryable: true };
	}

	/** PII-safe recipient for logs: "jamie@example.com" → "jam***@example.com". */
	private maskEmail(email: string): string {
		const atIndex: number = email.indexOf("@");
		if (atIndex <= 0) {
			return "***";
		}
		const local: string = email.slice(0, atIndex);
		const domain: string = email.slice(atIndex);
		const visible: string = local.length <= 3 ? local.slice(0, 1) : local.slice(0, 3);
		return `${visible}***${domain}`;
	}
}
