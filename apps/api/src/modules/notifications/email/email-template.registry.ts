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

/** Helper: register a template in one line instead of five. */
function registerTemplate(
	key: EmailTemplateKey,
	label: string,
	description: string,
	sampleTo: string,
	build: () => BaseEmailTemplate<BaseEmailProps>,
): EmailTemplateEntry {
	return { key, label, description, sampleTo, build };
}

/**
 * Single source of truth for "which templates exist". The registry is keyed
 * by the shared `EmailTemplateKeySchema` — the completeness test in
 * `email-template.registry.spec.ts` fails if a key is added to the schema
 * without a registry entry (and vice versa).
 *
 * To add a new template: add the class import above, then add one line below.
 */
export const EMAIL_TEMPLATE_REGISTRY: Readonly<Record<EmailTemplateKey, EmailTemplateEntry>> = {
	verification: registerTemplate("verification", "Email Verification", "Sent after signup to prove the user owns the inbox.", VerificationEmailTemplate.sampleProps.to, (): BaseEmailTemplate<BaseEmailProps> => new VerificationEmailTemplate(VerificationEmailTemplate.sampleProps)),
	"password-reset": registerTemplate("password-reset", "Password Reset", "Sent when a user requests a password reset.", PasswordResetEmailTemplate.sampleProps.to, (): BaseEmailTemplate<BaseEmailProps> => new PasswordResetEmailTemplate(PasswordResetEmailTemplate.sampleProps)),
	"account-locked": registerTemplate("account-locked", "Account Locked", "Sent after brute-force lockout with the remaining duration.", AccountLockedEmailTemplate.sampleProps.to, (): BaseEmailTemplate<BaseEmailProps> => new AccountLockedEmailTemplate(AccountLockedEmailTemplate.sampleProps)),
	welcome: registerTemplate("welcome", "Welcome", "One-time onboarding email after email verification.", WelcomeEmailTemplate.sampleProps.to, (): BaseEmailTemplate<BaseEmailProps> => new WelcomeEmailTemplate(WelcomeEmailTemplate.sampleProps)),
	"security-alert": registerTemplate("security-alert", "Security Alert", "New-device / new-location sign-in alert.", SecurityAlertEmailTemplate.sampleProps.to, (): BaseEmailTemplate<BaseEmailProps> => new SecurityAlertEmailTemplate(SecurityAlertEmailTemplate.sampleProps)),
	"admin-alert": registerTemplate("admin-alert", "Admin Alert", "Ops alert for admins (webhook failure, quota breach, …).", AdminAlertEmailTemplate.sampleProps.to, (): BaseEmailTemplate<BaseEmailProps> => new AdminAlertEmailTemplate(AdminAlertEmailTemplate.sampleProps)),
	"api-key-created": registerTemplate("api-key-created", "API Key Created", "Confirms a new API key was created (never contains the secret).", ApiKeyCreatedEmailTemplate.sampleProps.to, (): BaseEmailTemplate<BaseEmailProps> => new ApiKeyCreatedEmailTemplate(ApiKeyCreatedEmailTemplate.sampleProps)),
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
