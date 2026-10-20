/**
 * The ONLY file other contexts may import from notifications (plan §6.4).
 *
 * ── Requesting an email (ADR 060) ──────────────────────────────────────────
 *
 * PREFERRED — transactional, in YOUR unit of work's transaction:
 *
 *   `NotificationsTransactionalPortsFactory.create(db: Prisma.TransactionClient, events: TransactionalEventCollector): NotificationsTransactionalPorts`
 *   `ports.emailRequests.request(template, options?): Promise<EmailSendResult>`
 *
 * Inject `NotificationsTransactionalPortsFactory` (exported by `NotificationsModule`)
 * into your context's scope factory and call `create(db, events)` with the SAME
 * `db` and `events` your `PrismaUnitOfWork` hands it. The `pending` email log
 * row and the `notification.email.requested` outbox row then commit or roll
 * back with your business row; after commit the email is handed to the BullMQ
 * `emailSend` queue (jobId = email log id). Only infrastructure (scope factories)
 * may import the factory.
 *
 * There is no non-transactional way to request an email: a request always
 * commits with the business write it belongs to.
 *
 * Ports and templates come first and the Nest module last: the plain values
 * must be initialised before the module class is evaluated.
 */
export { NotificationsTransactionalPortsFactory } from "./infrastructure/adapters/transactional-email-requests.adapter";
export type { EmailRequestTransactionalPort, EmailSendAudit, EmailSendOptions, NotificationsTransactionalPorts } from "./application/ports/email-request.port";
export { EmailRequested } from "./domain/events/email-requested.event";
export { EMAIL_LOG_ID_TAG } from "./domain/value-objects/email-log-id-tag.value-object";
export { NotificationsHealthIndicator } from "./infrastructure/adapters/notifications-health.adapter";

// Email templates: the message types other contexts request.
export { BaseEmailTemplate, type BaseEmailProps } from "./domain/templates/base/base-email-template";
export { EMAIL_TEMPLATE_REGISTRY, buildEmailPreviewFromTemplate, type EmailTemplateEntry } from "./domain/templates/email-template.registry";
export { AccountLockedEmailTemplate } from "./domain/templates/account-locked-email.template";
export { AdminAlertEmailTemplate } from "./domain/templates/admin-alert-email.template";
export { ApiKeyCreatedEmailTemplate } from "./domain/templates/api-key-created-email.template";
export { LoginVerificationEmailTemplate } from "./domain/templates/login-verification-email.template";
export { MerchantInviteEmailTemplate } from "./domain/templates/merchant-invite-email.template";
export { PasswordChangedEmailTemplate } from "./domain/templates/password-changed-email.template";
export { PasswordResetEmailTemplate } from "./domain/templates/password-reset-email.template";
export { ReferrerRewardCreditedEmailTemplate } from "./domain/templates/referrer-reward-credited-email.template";
export { RewardClaimOtpEmailTemplate } from "./domain/templates/reward-claim-otp-email.template";
export { SecurityAlertEmailTemplate } from "./domain/templates/security-alert-email.template";
export { TeamMemberInviteEmailTemplate } from "./domain/templates/team-member-invite-email.template";
export { TwoFactorDisabledEmailTemplate } from "./domain/templates/two-factor-disabled-email.template";
export { TwoFactorEnabledEmailTemplate } from "./domain/templates/two-factor-enabled-email.template";
export { VerificationEmailTemplate } from "./domain/templates/verification-email.template";
export { WelcomeEmailTemplate } from "./domain/templates/welcome-email.template";

// Email-log list translators: the shared list-query grammar → Prisma (cross-context list-translator spec).
export { buildEmailLogListOrder, buildEmailLogListWhere } from "./infrastructure/persistence/prisma-email-log.read-repository";

// ── The Nest module ─────────────────────────────────────────────────────────
export { NotificationsModule } from "./notifications.module";
