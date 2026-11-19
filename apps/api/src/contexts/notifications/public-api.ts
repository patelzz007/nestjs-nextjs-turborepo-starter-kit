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

// ── Notifying a person (ADR 070) ─────────────────────────────────────────────
// PREFERRED over a bare email: `ports.notifications.notify({ type, recipient, payload, dedupeKey, tenantId })`
// in YOUR unit of work's transaction. The types below are the catalog: copy lives in their renderers.
export type { NotificationRecipient, NotifyRequest, NotifyResult, NotifyTransactionalPort } from "./application/ports/notify.port";
export type { LegacyInboxImportPort, LegacyInboxNotice } from "./application/ports/legacy-inbox-import.port";
export {
	alertDetailLinesOf as operationsAlertDetailLinesOf,
	alertTitleOf as operationsAlertTitleOf,
	OPERATIONS_ALERT_NOTIFICATION,
} from "./domain/catalog/types/operations.types";
export {
	REFERRER_CREDITED_NOTIFICATION,
	REWARD_APPROVED_NOTIFICATION,
	REWARD_AUTO_PUBLISHED_NOTIFICATION,
	REWARD_REJECTED_NOTIFICATION,
	SIGNUP_REFERRAL_SUCCESS_NOTIFICATION,
} from "./domain/catalog/types/rewards.types";
export { WEBHOOK_ENDPOINT_AUTO_DISABLED_NOTIFICATION } from "./domain/catalog/types/webhooks.types";
export { TIER_DEMOTED_NOTIFICATION, TIER_DEMOTION_WARNING_NOTIFICATION, TIER_PROMOTED_NOTIFICATION } from "./domain/catalog/types/tiers.types";
export { EMAIL_LOG_ID_TAG } from "./domain/value-objects/email-log-id-tag.value-object";

// Email templates: the message types other contexts request.
export { BaseEmailTemplate, type BaseEmailProps } from "./domain/templates/base/base-email-template";
export { EMAIL_TEMPLATE_REGISTRY, buildEmailPreviewFromTemplate, type EmailTemplateEntry } from "./domain/templates/email-template.registry";
export { AccountLockedEmailTemplate } from "./domain/templates/account-locked-email.template";
export { AdminAlertEmailTemplate } from "./domain/templates/admin-alert-email.template";
export { LoginVerificationEmailTemplate } from "./domain/templates/login-verification-email.template";
export { MerchantInviteEmailTemplate } from "./domain/templates/merchant-invite-email.template";
export { PasswordChangedEmailTemplate } from "./domain/templates/password-changed-email.template";
export { PasswordResetEmailTemplate } from "./domain/templates/password-reset-email.template";
export { ReferrerRewardCreditedEmailTemplate } from "./domain/templates/referrer-reward-credited-email.template";
export { RewardClaimOtpEmailTemplate } from "./domain/templates/reward-claim-otp-email.template";
export { TeamMemberInviteEmailTemplate } from "./domain/templates/team-member-invite-email.template";
export { TwoFactorDisabledEmailTemplate } from "./domain/templates/two-factor-disabled-email.template";
export { PasskeyAddedEmailTemplate } from "./domain/templates/passkey-added-email.template";
export { PasskeyRemovedEmailTemplate } from "./domain/templates/passkey-removed-email.template";
export { TwoFactorEnabledEmailTemplate } from "./domain/templates/two-factor-enabled-email.template";
export { VerificationEmailTemplate } from "./domain/templates/verification-email.template";

// ── The Nest module ─────────────────────────────────────────────────────────
export { NotificationsModule } from "./notifications.module";
