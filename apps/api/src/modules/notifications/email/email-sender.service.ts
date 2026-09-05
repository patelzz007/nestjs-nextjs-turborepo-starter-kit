import { Injectable, Optional } from "@nestjs/common";
import { Resend } from "resend";

import {
	CaughtValueSchema,
	EmailRenderContextSchema,
	EmailSendResultSchema,
	EmailTemplateKeySchema,
	ResendSendResponseSchema,
	type CaughtValue,
	type EmailRenderContext,
	type EmailSendResult,
	type ResendSendResponse,
} from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { readCaughtErrorCode, readCaughtErrorMessage } from "../../../common/utils/caught-error";
import { rejectAfter } from "../../../common/utils/promise-timeout";
import { EmailQueueService } from "./email-queue.service";
import { LogService } from "../../logs/logs.service";
import { BaseEmailTemplate, type BaseEmailProps } from "./base/base-email-template";
import { serializeEmailTemplateProps } from "./email-template.factory";
import { EmailLogService } from "./email-log.service";

/** Thrown when a send exceeds `EMAIL_TIMEOUT_MS`. */
class TimeoutError extends Error {
	public constructor() {
		super("Email send timed out");
		this.name = "TimeoutError";
	}
}

/**
 * Wraps any non-Error rejection from Resend while preserving its error code
 * (e.g. `rate_limit_exceeded`) so `classifyError` / `isNonRetryable` can still
 * read it — without resorting to type assertions or throwing non-Error values.
 */
class ResendError extends Error {
	public readonly code: string | undefined;

	public constructor(message: string, code: string | undefined) {
		super(message);
		this.name = "ResendError";
		this.code = code;
	}
}

/** Options for {@link EmailSenderService.send}. */
interface EmailSendOptions {
	/** When true, bypasses BullMQ and delivers synchronously (used by the queue worker). */
	readonly skipQueue?: boolean;
}

/** Outcome kinds understood by `send()` — mirrors `EmailSendResultSchema`. */
type SendFailureReason = "invalid-props" | "config" | "timeout" | "rate-limited" | "api-error";

/**
 * Delivery engine for every transactional email.
 *
 * Owns everything that is NOT template content: zod re-validation of props,
 * the `EMAIL_MODE` switch, the `EMAIL_TEST_TO` override, per-recipient rate
 * limiting, retry-with-backoff, per-send timeout, PII-safe logging, and the
 * `EmailLog` persistence. Templates stay pure renderers (rule 19) — they never
 * read the environment or touch the network.
 *
 * `send()` NEVER throws: callers (auth flows) inspect the returned
 * `EmailSendResult` and decide what to surface. This keeps a Resend outage
 * from failing a signup or login.
 */
@Injectable()
export class EmailSenderService {
	private readonly resend: Resend;
	private readonly fromAddress: string;
	private readonly renderContext: EmailRenderContext;
	/** Recipient → timestamps of recent sends (sliding window rate limit). */
	private readonly rateBuckets = new Map<string, readonly number[]>();

	public constructor(
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		private readonly emailLogService: EmailLogService,
		@Optional() private readonly emailQueue?: EmailQueueService,
	) {
		this.resend = new Resend(this.config.resendApiKey);
		this.fromAddress = this.config.emailFromAddress;
		this.renderContext = EmailRenderContextSchema.parse({
			appName: this.config.appName,
			appUrl: this.config.appUrl,
			supportEmail: this.config.emailFromAddress,
		});
	}

	// ── Public API ─────────────────────────────────────────────────────────

	/**
	 * Validate + deliver one template. Never throws — inspect the result.
	 * The recipient override + mode switch happen here, transparently.
	 */
	public async send<TProps extends BaseEmailProps>(template: BaseEmailTemplate<TProps>, options?: EmailSendOptions): Promise<EmailSendResult> {
		// 1. Re-validate props — the sender is the last line of defense; a
		//    template constructed with bad props must never reach the network.
		const parsed = template.propsSchema.safeParse(template.props);
		if (!parsed.success) {
			const issue = parsed.error.issues.at(0);
			const detail = issue === undefined ? "props failed validation" : `${issue.path.join(".")}: ${issue.message}`;
			return EmailSendResultSchema.parse({ ok: false, reason: "invalid-props", detail });
		}

		// 2. Resolve the effective recipient (dev override first).
		const effectiveTo: string = this.config.emailTestTo ?? parsed.data.to;
		if (this.config.emailTestTo !== undefined && this.config.emailTestTo !== parsed.data.to) {
			this.logService.info(
				`EMAIL_TEST_TO override: "${template.subject}" redirected from ${this.maskEmail(parsed.data.to)} to ${this.maskEmail(effectiveTo)}`,
				{ context: "EmailSenderService" },
			);
		}

		// 3. Mode switch — noop / log-only never touch the network.
		const mode: "send" | "log-only" | "noop" = this.config.emailMode;
		if (mode === "noop") {
			await this.persist(template, effectiveTo, "sent", undefined);
			this.logService.info(`[noop] Would send "${template.subject}" to ${this.maskEmail(effectiveTo)}`, {
				context: "EmailSenderService",
			});
			return EmailSendResultSchema.parse({ ok: true, id: "noop", mode });
		}
		if (mode === "log-only") {
			const text: string = template.renderText(this.renderContext);
			this.logService.info(`[log-only] ${template.subject} → ${this.maskEmail(effectiveTo)}\n${text}`, {
				context: "EmailSenderService",
			});
			await this.persist(template, effectiveTo, "sent", undefined);
			return EmailSendResultSchema.parse({ ok: true, id: "log-only", mode });
		}

		// 3b. Queue real sends when BullMQ is enabled (worker calls back with skipQueue).
		if (options?.skipQueue !== true && this.emailQueue?.isEnabled() === true) {
			const keyParsed = EmailTemplateKeySchema.safeParse(template.key);
			if (keyParsed.success) {
				const jobId = await this.emailQueue.enqueue({
					templateKey: keyParsed.data,
					props: serializeEmailTemplateProps(parsed.data),
				});
				return EmailSendResultSchema.parse({ ok: true, id: jobId, mode: "queued" });
			}
		}

		// 4. Real send: rate limit → retry/backoff/timeout → persistence.
		if (!this.allowSend(effectiveTo)) {
			this.logService.warn(`Rate limit hit for ${this.maskEmail(effectiveTo)}`, { context: "EmailSenderService" });
			return EmailSendResultSchema.parse({ ok: false, reason: "rate-limited" });
		}

		// 4b. The shared render context (branding + public URL) was built once in
		//     the constructor — templates stay pure renderers (rule 19).
		const html: string = template.renderHtml(this.renderContext);
		const text: string = template.renderText(this.renderContext);

		try {
			// The send duration is carried on the EmailLog attempt event.
			const sendStartedAt: number = performance.now();
			const resendId: string = await this.sendWithRetry({
				to: effectiveTo,
				subject: template.subject,
				html,
				text,
				cc: parsed.data.cc,
				bcc: parsed.data.bcc,
				replyTo: parsed.data.replyTo ?? this.config.emailReplyTo,
			});
			await this.persist(template, effectiveTo, "sent", resendId, undefined, Math.round(performance.now() - sendStartedAt));
			this.logService.info(`Sent "${template.subject}" to ${this.maskEmail(effectiveTo)} (${resendId})`, {
				context: "EmailSenderService",
			});
			return EmailSendResultSchema.parse({ ok: true, id: resendId, mode: "send" });
		} catch (error) {
			const failure = this.classifyError(CaughtValueSchema.parse(error));
			await this.persist(template, effectiveTo, "failed", undefined, failure.detail);
			this.logService.error(`Failed to send "${template.subject}" to ${this.maskEmail(effectiveTo)}: ${failure.detail}`, {
				context: "EmailSenderService",
			});
			return EmailSendResultSchema.parse({ ok: false, reason: failure.reason, detail: failure.detail });
		}
	}

	// ── Delivery internals ─────────────────────────────────────────────────

	/** One retrying send attempt. Throws on final failure. */
	private async sendWithRetry(payload: {
		readonly to: string;
		readonly subject: string;
		readonly html: string;
		readonly text: string;
		readonly cc?: readonly string[];
		readonly bcc?: readonly string[];
		readonly replyTo?: string;
	}): Promise<string> {
		const maxAttempts: number = this.config.emailMaxAttempts;
		const timeoutMs: number = this.config.emailTimeoutMs;

		let lastError: Error | null = null;
		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			if (attempt > 1) {
				// Exponential backoff with jitter: 300ms * 2^(attempt-2) ± 40%.
				const baseDelay: number = 300 * 2 ** (attempt - 2);
				const jitter: number = baseDelay * (0.6 + Math.random() * 0.8);
				await new Promise<void>((resolve): void => {
					setTimeout(resolve, jitter);
				});
			}

			// Timeout via Promise.race: Resend's send() takes no AbortSignal,
			// so a hung network call is cut with a synthetic TimeoutError.
			try {
				const sendPromise: Promise<ResendSendResponse> = this.resend.emails
					.send({
						from: this.fromAddress,
						to: payload.to,
						subject: payload.subject,
						html: payload.html,
						text: payload.text,
						cc: payload.cc !== undefined && payload.cc.length > 0 ? [...payload.cc] : undefined,
						bcc: payload.bcc !== undefined && payload.bcc.length > 0 ? [...payload.bcc] : undefined,
						replyTo: payload.replyTo,
					})
					.then((response) => ResendSendResponseSchema.parse(response));
				const result: ResendSendResponse = await Promise.race([sendPromise, rejectAfter<ResendSendResponse>(timeoutMs, new TimeoutError())]);
				if (result.error !== null) {
					throw this.normalizeError(CaughtValueSchema.parse(result.error));
				}
				const id: string | undefined = result.data?.id;
				if (id === undefined) {
					throw new Error("Resend returned no email id");
				}
				return id;
			} catch (error) {
				lastError = this.normalizeError(CaughtValueSchema.parse(error));
				// Non-retryable: invalid payloads and auth failures never recover.
				if (this.isNonRetryable(lastError)) {
					break;
				}
			}
		}
		// lastError is always an Error (normalized in the catch) — preserve the
		// original message + code so classifyError keeps its decision power. The
		// `?? new Error` fallback is unreachable but satisfies the throw contract.
		throw lastError ?? new Error("Email send failed");
	}

	/** Coerce any rejection into an Error, preserving a Resend error code. */
	private normalizeError(value: CaughtValue): Error {
		if (value instanceof Error) {
			return value;
		}
		const code: string | undefined = readCaughtErrorCode(value);
		const message: string = readCaughtErrorMessage(value);
		return new ResendError(message, code);
	}

	/** Map a thrown send error to a user-facing `SendFailureReason`. */
	private classifyError(value: CaughtValue): { readonly reason: SendFailureReason; readonly detail: string } {
		if (value instanceof TimeoutError) {
			return { reason: "timeout", detail: value.message };
		}
		if (value instanceof ResendError && value.code === "rate_limit_exceeded") {
			return { reason: "rate-limited", detail: "Resend rate limit exceeded" };
		}
		const message: string = readCaughtErrorMessage(value);
		return { reason: "api-error", detail: message };
	}

	/** 4xx validation/auth errors are pointless to retry. */
	private isNonRetryable(error: Error): boolean {
		const code: string | undefined = error instanceof ResendError ? error.code : undefined;
		const nonRetryableCodes: readonly string[] = [
			"validation_error",
			"missing_api_key",
			"invalid_api_key",
			"restricted_api_key",
			"invalid_from_address",
			"missing_required_field",
			"invalid_parameter",
			"rate_limit_exceeded",
		];
		return code !== undefined && nonRetryableCodes.includes(code);
	}

	/** Sliding-window per-recipient rate limit. 0 disables the check. */
	private allowSend(recipient: string): boolean {
		const limit: number = this.config.emailRateLimitPerMinute;
		if (limit <= 0) {
			return true;
		}
		const now: number = Date.now();
		const windowStart: number = now - 60_000;
		const recent: readonly number[] = (this.rateBuckets.get(recipient) ?? []).filter((timestamp: number): boolean => timestamp > windowStart);
		if (recent.length >= limit) {
			this.rateBuckets.set(recipient, recent);
			return false;
		}
		this.rateBuckets.set(recipient, [...recent, now]);
		return true;
	}

	/** Persist one row in EmailLog. Fire-and-forget on persistence errors. */
	private async persist(
		template: BaseEmailTemplate<BaseEmailProps>,
		to: string,
		status: "sent" | "failed",
		resendId: string | undefined,
		error?: string,
		durationMs?: number,
	): Promise<void> {
		try {
			await this.emailLogService.create({
				templateKey: template.key,
				to,
				subject: template.subject,
				status,
				resendId,
				error,
				durationMs,
			});
		} catch (persistError) {
			const caught = CaughtValueSchema.parse(persistError);
			this.logService.warn(`Failed to persist EmailLog row: ${readCaughtErrorMessage(caught)}`, {
				context: "EmailSenderService",
			});
		}
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
