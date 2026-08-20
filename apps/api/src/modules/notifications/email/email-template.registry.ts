import { EmailPreviewPropValueSchema, EmailTemplateMetaSchema, type EmailPreview, type EmailTemplateKey, type EmailTemplateMeta } from "@workspace/shared";

import { BaseEmailTemplate, type BaseEmailProps } from "./base/base-email-template";
import type { EmailRenderContext } from "./base/email-render-context";
import { AccountLockedEmailTemplate } from "./templates/account-locked-email.template";
import { AdminAlertEmailTemplate } from "./templates/admin-alert-email.template";
import { ApiKeyCreatedEmailTemplate } from "./templates/api-key-created-email.template";
import { PasswordResetEmailTemplate } from "./templates/password-reset-email.template";
import { SecurityAlertEmailTemplate } from "./templates/security-alert-email.template";
import { VerificationEmailTemplate } from "./templates/verification-email.template";
import { WelcomeEmailTemplate } from "./templates/welcome-email.template";

/** Static metadata + a sample-props factory for one template. */
export interface EmailTemplateEntry {
	/** Registry key — must match `EmailTemplateKeySchema`. */
	readonly key: EmailTemplateKey;
	/** Human label for the admin preview list. */
	readonly label: string;
	/** One-line description for the admin preview list. */
	readonly description: string;
	/** Sample `to` used by the admin preview list (never sent). */
	readonly sampleTo: string;
	/** Builds a template instance with representative props. */
	readonly build: () => BaseEmailTemplate<BaseEmailProps>;
}

/**
 * Single source of truth for "which templates exist". The registry is keyed
 * by the shared `EmailTemplateKeySchema` — the completeness test in
 * `email-template.registry.spec.ts` fails if a key is added to the schema
 * without a registry entry (and vice versa).
 */
export const EMAIL_TEMPLATE_REGISTRY: Readonly<Record<EmailTemplateKey, EmailTemplateEntry>> = {
	verification: {
		key: "verification",
		label: "Email Verification",
		description: "Sent after signup to prove the user owns the inbox.",
		sampleTo: VerificationEmailTemplate.sampleProps.to,
		build: (): BaseEmailTemplate<BaseEmailProps> => new VerificationEmailTemplate(VerificationEmailTemplate.sampleProps),
	},
	"password-reset": {
		key: "password-reset",
		label: "Password Reset",
		description: "Sent when a user requests a password reset.",
		sampleTo: PasswordResetEmailTemplate.sampleProps.to,
		build: (): BaseEmailTemplate<BaseEmailProps> => new PasswordResetEmailTemplate(PasswordResetEmailTemplate.sampleProps),
	},
	"account-locked": {
		key: "account-locked",
		label: "Account Locked",
		description: "Sent after brute-force lockout with the remaining duration.",
		sampleTo: AccountLockedEmailTemplate.sampleProps.to,
		build: (): BaseEmailTemplate<BaseEmailProps> => new AccountLockedEmailTemplate(AccountLockedEmailTemplate.sampleProps),
	},
	welcome: {
		key: "welcome",
		label: "Welcome",
		description: "One-time onboarding email after email verification.",
		sampleTo: WelcomeEmailTemplate.sampleProps.to,
		build: (): BaseEmailTemplate<BaseEmailProps> => new WelcomeEmailTemplate(WelcomeEmailTemplate.sampleProps),
	},
	"security-alert": {
		key: "security-alert",
		label: "Security Alert",
		description: "New-device / new-location sign-in alert.",
		sampleTo: SecurityAlertEmailTemplate.sampleProps.to,
		build: (): BaseEmailTemplate<BaseEmailProps> => new SecurityAlertEmailTemplate(SecurityAlertEmailTemplate.sampleProps),
	},
	"admin-alert": {
		key: "admin-alert",
		label: "Admin Alert",
		description: "Ops alert for admins (webhook failure, quota breach, …).",
		sampleTo: AdminAlertEmailTemplate.sampleProps.to,
		build: (): BaseEmailTemplate<BaseEmailProps> => new AdminAlertEmailTemplate(AdminAlertEmailTemplate.sampleProps),
	},
	"api-key-created": {
		key: "api-key-created",
		label: "API Key Created",
		description: "Confirms a new API key was created (never contains the secret).",
		sampleTo: ApiKeyCreatedEmailTemplate.sampleProps.to,
		build: (): BaseEmailTemplate<BaseEmailProps> => new ApiKeyCreatedEmailTemplate(ApiKeyCreatedEmailTemplate.sampleProps),
	},
};

/** Static metadata list for the admin preview index. */
export function listTemplateMeta(): EmailTemplateMeta[] {
	return Object.values(EMAIL_TEMPLATE_REGISTRY).map((entry: EmailTemplateEntry): EmailTemplateMeta =>
		EmailTemplateMetaSchema.parse({
			key: entry.key,
			label: entry.label,
			description: entry.description,
			sampleTo: entry.sampleTo,
		}),
	);
}

/**
 * Build the preview payload for one template key.
 * Throws when the key is unknown — controllers map that to a 404.
 */
export function buildEmailPreview(key: EmailTemplateKey, context: EmailRenderContext): EmailPreview {
	const entry: EmailTemplateEntry | undefined = Object.values(EMAIL_TEMPLATE_REGISTRY).find((candidate: EmailTemplateEntry): boolean => candidate.key === key);
	if (entry === undefined) {
		throw new Error(`Unknown email template key: ${key}`);
	}
	const template: BaseEmailTemplate<BaseEmailProps> = entry.build();
	// Serialize props through the shared schema (rule 13) — arrays/undefined
	// values are excluded by the schema, never by manual type checks.
	const props: Record<string, string | number | boolean | null> = {};
	for (const [propKey, value] of Object.entries(template.props)) {
		const parsed = EmailPreviewPropValueSchema.safeParse(value);
		if (parsed.success) {
			props[propKey] = parsed.data;
		}
	}
	return {
		key: entry.key,
		label: entry.label,
		description: entry.description,
		subject: template.subject,
		to: entry.sampleTo,
		previewText: template.getPreviewText(context),
		html: template.renderHtml(context),
		text: template.renderText(context),
		props,
	};
}
