import { z } from "zod";

import { BaseEmailPropsSchema, BaseEmailTemplate, type CtaConfig } from "../base/base-email-template.js";
import type { EmailRenderContext } from "../base/email-render-context.js";

export const ApiKeyCreatedEmailPropsSchema = BaseEmailPropsSchema.extend({
	/** Display name of the new API key. */
	keyName: z.string().min(1),
	/** When the key was created (ISO). */
	createdAt: z.iso.datetime(),
});

export type ApiKeyCreatedEmailProps = z.output<typeof ApiKeyCreatedEmailPropsSchema>;

/**
 * Confirms a new API key was created. The full key secret is only ever shown
 * once at creation time — this email never contains it (rule 26: no raw
 * secrets in email/logs).
 */
export class ApiKeyCreatedEmailTemplate extends BaseEmailTemplate<ApiKeyCreatedEmailProps> {
	/** Sample props used by the admin preview + screenshot pipeline. */
	public static readonly sampleProps: ApiKeyCreatedEmailProps = {
		to: "jamie@example.com",
		keyName: "production-deploy",
		createdAt: new Date().toISOString(),
	};

	public readonly key: string = "api-key-created";
	public readonly propsSchema = ApiKeyCreatedEmailPropsSchema;
	public readonly subject: string = "New API key created";
	protected readonly accent = "sky" as const;
	protected readonly eyebrow: string = "API Keys";
	protected readonly heading: string = "A new API key was created";

	public getPreviewText(context: EmailRenderContext): string {
		return `The "${this.props.keyName}" key was added to your ${context.appName} account.`;
	}

	public getCta(context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Manage API Keys",
			href: this.buildUrl(context, "/settings/api-keys"),
		};
	}

	/** Human-readable creation date (e.g. "Aug 9, 2026"). */
	private get createdLabel(): string {
		return new Date(this.props.createdAt).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">A new API key was added to your <strong>${this.escape(context.appName)}</strong> account on <strong>${this.escape(this.createdLabel)}</strong>:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 20px 0;">
          <tr>
            <td class="email-chip" style="background: ${this.palette.chipBg}; border: 1px solid ${this.palette.chipBorder}; border-radius: 10px; padding: 16px 18px;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${this.palette.chipText};">${this.escape(this.props.keyName)}</p>
            </td>
          </tr>
        </table>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 8px 0;">If this was you, no action is needed.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">If you didn't create this key, <a href="${this.escape(this.buildUrl(context, "/settings/api-keys"))}" style="color: #2563eb; text-decoration: underline;">revoke it now</a> and contact support.</p>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`A new API key was added to your ${context.appName} account on ${this.createdLabel}:`,
			`- Name: ${this.props.keyName}`,
			"",
			"If this was you, no action is needed.",
			`If you didn't create this key, revoke it at ${context.appUrl}/settings/api-keys and contact support.`,
		].join("\n");
	}
}
