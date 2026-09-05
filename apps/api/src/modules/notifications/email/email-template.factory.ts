import {
	AccountLockedEmailPropsSchema,
	AdminAlertEmailPropsSchema,
	ApiKeyCreatedEmailPropsSchema,
	EmailPreviewPropValueSchema,
	MerchantInviteEmailPropsSchema,
	LoginVerificationEmailPropsSchema,
	PasswordChangedEmailPropsSchema,
	PasswordResetEmailPropsSchema,
	ReferrerRewardCreditedEmailPropsSchema,
	RewardClaimOtpEmailPropsSchema,
	SecurityAlertEmailPropsSchema,
	TwoFactorStatusEmailPropsSchema,
	VerificationEmailPropsSchema,
	WelcomeEmailPropsSchema,
	type EmailTemplateKey,
} from "@workspace/shared";

import { BaseEmailTemplate, type BaseEmailProps } from "./base/base-email-template";
import { AccountLockedEmailTemplate } from "./templates/account-locked-email.template";
import { AdminAlertEmailTemplate } from "./templates/admin-alert-email.template";
import { ApiKeyCreatedEmailTemplate } from "./templates/api-key-created-email.template";
import { MerchantInviteEmailTemplate } from "./templates/merchant-invite-email.template";
import { LoginVerificationEmailTemplate } from "./templates/login-verification-email.template";
import { PasswordChangedEmailTemplate } from "./templates/password-changed-email.template";
import { PasswordResetEmailTemplate } from "./templates/password-reset-email.template";
import { ReferrerRewardCreditedEmailTemplate } from "./templates/referrer-reward-credited-email.template";
import { RewardClaimOtpEmailTemplate } from "./templates/reward-claim-otp-email.template";
import { SecurityAlertEmailTemplate } from "./templates/security-alert-email.template";
import { TwoFactorDisabledEmailTemplate } from "./templates/two-factor-disabled-email.template";
import { TwoFactorEnabledEmailTemplate } from "./templates/two-factor-enabled-email.template";
import { VerificationEmailTemplate } from "./templates/verification-email.template";
import { WelcomeEmailTemplate } from "./templates/welcome-email.template";

type EmailJobProps = Record<string, string | number | boolean | null>;

/** Rebuild a concrete template instance from a queued job payload. */

export function buildEmailTemplateFromJobData(templateKey: EmailTemplateKey, props: EmailJobProps): BaseEmailTemplate<BaseEmailProps> {
	switch (templateKey) {
		case "verification":
			return new VerificationEmailTemplate(VerificationEmailPropsSchema.parse(props));
		case "password-reset":
			return new PasswordResetEmailTemplate(PasswordResetEmailPropsSchema.parse(props));
		case "password-changed":
			return new PasswordChangedEmailTemplate(PasswordChangedEmailPropsSchema.parse(props));
		case "account-locked":
			return new AccountLockedEmailTemplate(AccountLockedEmailPropsSchema.parse(props));
		case "welcome":
			return new WelcomeEmailTemplate(WelcomeEmailPropsSchema.parse(props));
		case "security-alert":
			return new SecurityAlertEmailTemplate(SecurityAlertEmailPropsSchema.parse(props));
		case "two-factor-enabled":
			return new TwoFactorEnabledEmailTemplate(TwoFactorStatusEmailPropsSchema.parse(props));
		case "two-factor-disabled":
			return new TwoFactorDisabledEmailTemplate(TwoFactorStatusEmailPropsSchema.parse(props));
		case "login-verification":
			return new LoginVerificationEmailTemplate(LoginVerificationEmailPropsSchema.parse(props));
		case "admin-alert":
			return new AdminAlertEmailTemplate(AdminAlertEmailPropsSchema.parse(props));
		case "api-key-created":
			return new ApiKeyCreatedEmailTemplate(ApiKeyCreatedEmailPropsSchema.parse(props));
		case "reward-claim-otp":
			return new RewardClaimOtpEmailTemplate(RewardClaimOtpEmailPropsSchema.parse(props));
		case "referrer-reward-credited":
			return new ReferrerRewardCreditedEmailTemplate(ReferrerRewardCreditedEmailPropsSchema.parse(props));
		case "merchant-invite":
			return new MerchantInviteEmailTemplate(MerchantInviteEmailPropsSchema.parse(props));
		default: {
			const exhaustive: never = templateKey;
			throw new Error(`Unknown email template key: ${String(exhaustive)}`);
		}
	}
}

/** Coerce template props into a JSON-safe record for BullMQ. */
export function serializeEmailTemplateProps(props: BaseEmailProps): EmailJobProps {
	const serialized: EmailJobProps = {};
	for (const [key, value] of Object.entries(props)) {
		const parsed = EmailPreviewPropValueSchema.safeParse(value);
		if (parsed.success) {
			serialized[key] = parsed.data;
		}
	}
	return serialized;
}
