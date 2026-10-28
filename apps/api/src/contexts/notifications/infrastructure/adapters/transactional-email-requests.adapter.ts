import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
	CaughtValueSchema,
	type EmailRenderContext,
	type EmailSendResult,
	EmailSendResultSchema,
	EmailTemplateKeySchema,
	isUndeliverableEmail,
	newRowId,
} from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import { LogService } from "../../../../platform/infrastructure/logging/logs.service";
import { PlatformOutboxService } from "../../../../platform/infrastructure/outbox/platform-outbox.service";
import { readCaughtErrorMessage } from "../../../../platform/infrastructure/utils/caught-error";
import type { EmailRequestTransactionalPort, EmailSendAudit, EmailSendOptions, NotificationsTransactionalPorts } from "../../application/ports/email-request.port";
import { EMAIL_RENDER_CONTEXT } from "../../application/ports/notifications.tokens";
import { EmailAttemptFinalized } from "../../domain/events/email-log-updated.event";
import { EmailRequested } from "../../domain/events/email-requested.event";
import type { BaseEmailProps, BaseEmailTemplate } from "../../domain/templates/base/base-email-template";
import { serializeEmailTemplateProps } from "../../domain/templates/email-template-props";
import { PrismaEmailLogRepository } from "../persistence/prisma-email-log.repository";
import { EmailRecipientRateLimiter } from "./email-recipient-rate-limiter.adapter";
import { maskEmail } from "./mask-email";
import { EmailTransport } from "./transports/email-transport";

/** The collaborators every transactional request needs; shared by every scope the factory builds. */
interface EmailRequestDependencies {
	readonly config: TypedConfigService;
	readonly rateLimiter: EmailRecipientRateLimiter;
	readonly outbox: PlatformOutboxService;
	readonly requestContext: RequestContextService;
	readonly logService: LogService;
	readonly transport: EmailTransport;
	readonly renderContext: EmailRenderContext;
	readonly clock: Clock;
}

/**
 * {@link EmailRequestTransactionalPort} bound to ONE caller transaction and
 * its event collector (ADR 060). Everything it writes rolls back with the caller.
 */
class TransactionalEmailRequests implements EmailRequestTransactionalPort {
	private readonly emailLogs: PrismaEmailLogRepository;

	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly events: TransactionalEventCollector,
		private readonly deps: EmailRequestDependencies,
	) {
		this.emailLogs = new PrismaEmailLogRepository(db);
	}

	public async request<TProps extends BaseEmailProps>(template: BaseEmailTemplate<TProps>, options?: EmailSendOptions): Promise<EmailSendResult> {
		// 1. Re-validate props — a template constructed with bad props must never be requested.
		const parsed = template.propsSchema.safeParse(template.props);
		if (!parsed.success) {
			const issue = parsed.error.issues.at(0);
			const detail = issue === undefined ? "props failed validation" : `${issue.path.join(".")}: ${issue.message}`;
			return EmailSendResultSchema.parse({ ok: false, reason: "invalid-props", detail });
		}
		// 1b. A reserved `.invalid` address (every load-test user's, ADR 068) can never receive mail:
		//     dropped before anything is written, and counted in the log.
		if (isUndeliverableEmail(parsed.data.to)) {
			this.deps.logService.info(`Dropped "${template.subject}" to an undeliverable address`, {
				context: "EmailRequest",
				metadata: { event: "email.dropped_undeliverable", templateKey: template.key },
			});
			return EmailSendResultSchema.parse({ ok: false, reason: "undeliverable" });
		}
		const effectiveTo = this.effectiveRecipient(template.subject, parsed.data.to);
		const metadata = this.auditMetadata(options?.audit);
		const emailLogId = newRowId();

		// 2. Simulated modes (development / test only — refused on a deployed production
		//    environment by the config schema): the row is written final, nothing is queued.
		const mode = this.deps.config.email.mode;
		if (mode === "noop" || mode === "log-only") {
			await this.emailLogs.insert(emailLogId, { templateKey: template.key, to: effectiveTo, subject: template.subject, status: "sent", metadata: { mode, ...metadata } });
			this.events.collect(
				new EmailAttemptFinalized(this.deps.clock.now(), emailLogId, { templateKey: template.key, status: "sent", resendId: null, error: null, durationMs: null }),
			);
			if (mode === "log-only") {
				this.deps.logService.info(`[log-only] ${template.subject} → ${maskEmail(effectiveTo)}\n${template.renderText(this.deps.renderContext)}`, { context: "EmailRequest" });
			} else {
				this.deps.logService.info(`[noop] Would send "${template.subject}" to ${maskEmail(effectiveTo)}`, { context: "EmailRequest" });
			}
			return EmailSendResultSchema.parse({ ok: true, id: emailLogId, mode });
		}

		// 3. Rate limit before anything is written. Counting a request whose transaction later
		//    rolls back is deliberate: the limiter fails closed, never open.
		if (!(await this.acquireRateLimit(effectiveTo))) {
			return EmailSendResultSchema.parse({ ok: false, reason: "rate-limited" });
		}

		// 4. The pending row and the durable request, in the caller's transaction.
		await this.emailLogs.insert(emailLogId, {
			templateKey: template.key,
			to: effectiveTo,
			subject: template.subject,
			status: "pending",
			metadata: { mode, provider: this.deps.transport.provider, ...metadata },
		});
		const outboxEventId = await this.deps.outbox.enqueueEmailRequestInTransaction(this.db, {
			emailLogId,
			templateKey: EmailTemplateKeySchema.parse(template.key),
			props: serializeEmailTemplateProps(parsed.data),
		});
		this.events.collect(new EmailRequested(this.deps.clock.now(), emailLogId, outboxEventId));
		return EmailSendResultSchema.parse({ ok: true, id: emailLogId, mode: "queued" });
	}

	private effectiveRecipient(subject: string, to: string): string {
		const override: string | undefined = this.deps.config.email.testTo;
		if (override !== undefined && override !== to) {
			this.deps.logService.info(`EMAIL_TEST_TO override: "${subject}" redirected from ${maskEmail(to)} to ${maskEmail(override)}`, { context: "EmailRequest" });
		}
		return override ?? to;
	}

	private async acquireRateLimit(recipient: string): Promise<boolean> {
		try {
			const allowed = await this.deps.rateLimiter.tryAcquire(recipient);
			if (!allowed) {
				this.deps.logService.warn(`Rate limit hit for ${maskEmail(recipient)}`, { context: "EmailRequest" });
			}
			return allowed;
		} catch (error) {
			// Fails closed: an unavailable limiter must not turn into unlimited sends.
			this.deps.logService.error(`Email rate limiter unavailable — request refused: ${readCaughtErrorMessage(CaughtValueSchema.parse(error))}`, {
				context: "EmailRequest",
			});
			return false;
		}
	}

	/** Audit fields stored on the email log row for a send someone triggered explicitly. */
	private auditMetadata(audit: EmailSendAudit | undefined): Readonly<Record<string, string>> {
		if (audit === undefined) {
			return {};
		}
		const context = this.deps.requestContext.current();
		return {
			trigger: audit.trigger,
			actorUserId: audit.actorUserId,
			...(context === undefined ? {} : { correlationId: context.correlationId }),
			...(context?.ip === undefined ? {} : { ipAddress: context.ip }),
			...(context?.userAgent === undefined ? {} : { userAgent: context.userAgent }),
			...(context?.principal?.impersonatorId === undefined ? {} : { impersonatorUserId: context.principal.impersonatorId }),
		};
	}
}

/**
 * The notifications TRANSACTIONAL PORT FACTORY (plan §5.4, ADR 060), exported
 * through `public-api.ts`. Another context's scope factory calls
 * `create(db, events)` with ITS unit-of-work transaction and collector, so the
 * email request commits atomically with its business row:
 *
 * ```ts
 * // contexts/<ctx>/infrastructure/persistence/<ctx>-scope.factory.ts
 * create(db, events) {
 *   const notifications = this.notifications.create(db, events);
 *   return { ..., emailRequests: notifications.emailRequests, events };
 * }
 * // in the handler, inside uow.run(...):
 * await scope.emailRequests.request(new PasswordResetEmailTemplate({ ... }));
 * ```
 */
@Injectable()
export class NotificationsTransactionalPortsFactory {
	private readonly deps: EmailRequestDependencies;

	public constructor(
		config: TypedConfigService,
		rateLimiter: EmailRecipientRateLimiter,
		outbox: PlatformOutboxService,
		requestContext: RequestContextService,
		logService: LogService,
		transport: EmailTransport,
		@Inject(EMAIL_RENDER_CONTEXT) renderContext: EmailRenderContext,
		@Inject(CLOCK) clock: Clock,
	) {
		this.deps = { config, rateLimiter, outbox, requestContext, logService, transport, renderContext, clock };
	}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): NotificationsTransactionalPorts {
		return { emailRequests: new TransactionalEmailRequests(db, events, this.deps) };
	}
}
