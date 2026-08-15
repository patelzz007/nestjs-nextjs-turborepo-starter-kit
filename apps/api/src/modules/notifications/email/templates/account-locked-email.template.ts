import { z } from "zod";

import { EpochMsSchema, epochMs } from "@workspace/shared";

import { BaseEmailPropsSchema, BaseEmailTemplate } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/** Locked-until epoch-ms timestamp. */
export const AccountLockedEmailPropsSchema = BaseEmailPropsSchema.extend({
	lockedUntil: EpochMsSchema,
});

export type AccountLockedEmailProps = z.output<typeof AccountLockedEmailPropsSchema>;

/**
 * Sent after brute-force lockout. Uses the red accent and a soft chip to make
 * the "locked for N minutes" fact impossible to miss.
 */
export class AccountLockedEmailTemplate extends BaseEmailTemplate<AccountLockedEmailProps> {
	/** Sample props used by the admin preview + screenshot pipeline. */
	public static readonly sampleProps: AccountLockedEmailProps = {
		to: "jamie@example.com",
		lockedUntil: epochMs(Date.now() + 15 * 60 * 1000),
	};

	public readonly key: string = "account-locked";
	public readonly propsSchema = AccountLockedEmailPropsSchema;
	public readonly subject: string = "Your account was temporarily locked";
	protected readonly accent = "red" as const;
	protected readonly eyebrow: string = "Security Notice";
	protected readonly heading: string = "Account temporarily locked";

	public getPreviewText(context: EmailRenderContext): string {
		return `Too many failed sign-in attempts on your ${context.appName} account.`;
	}

	/** Remaining lock duration in whole minutes (min 1). */
	private get remainingMinutes(): number {
		const remainingMs: number = this.props.lockedUntil - Date.now();
		return Math.max(1, Math.ceil(remainingMs / 60_000));
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		const minutes: number = this.remainingMinutes;
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">Your <strong>${this.escape(context.appName)}</strong> account was <strong style="color: #dc2626;">temporarily locked</strong> after too many failed sign-in attempts.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 20px 0;">
          <tr>
            <td class="email-chip" style="background: ${this.palette.chipBg}; border: 1px solid ${this.palette.chipBorder}; border-radius: 10px; padding: 18px 20px; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: ${this.palette.chipText};">Locked for ${String(minutes)} minute${minutes === 1 ? "" : "s"}</p>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${this.palette.chipText};">You'll be able to try again after this period ends.</p>
            </td>
          </tr>
        </table>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">Forgot your password? You can <a href="${this.escape(this.buildUrl(context, "/auth/forgot-password"))}" style="color: #2563eb; text-decoration: underline;">request a reset</a> on the sign-in page.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">If this wasn't you, someone else may be trying to access your account — please contact support.</p>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		const minutes: number = this.remainingMinutes;
		return [
			`Your ${context.appName} account was temporarily locked after too many failed sign-in attempts.`,
			"",
			`Locked for ${String(minutes)} minute${minutes === 1 ? "" : "s"}.`,
			"You'll be able to try again after this period ends.",
			"",
			`Forgot your password? Request a reset at ${context.appUrl}/auth/forgot-password`,
			"",
			"If this wasn't you, someone else may be trying to access your account — please contact support.",
		].join("\n");
	}
}
