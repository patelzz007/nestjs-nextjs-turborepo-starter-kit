import { format } from "date-fns";

import { ApiKeyCreatedEmailPropsSchema, nowEpochMs, type ApiKeyCreatedEmailProps, APP_LINKS } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

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
		createdAt: nowEpochMs(),
		manageKeysUrl: `https://merchant.example.com${APP_LINKS.merchant.apiKeys("brew-bean-kl")}`,
	};

	public readonly key: string = "api-key-created";
	public readonly propsSchema = ApiKeyCreatedEmailPropsSchema;
	public readonly subject: string = "New API key created";
	protected readonly accent: EmailAccent = "sky";
	protected readonly eyebrow: string = "API Keys";
	protected readonly heading: string = "A new API key was created";

	public getPreviewText(context: EmailRenderContext): string {
		return `The "${this.props.keyName}" key was added to your ${context.appName} account.`;
	}

	public override getCta(_context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Manage API keys",
			href: this.props.manageKeysUrl,
		};
	}

	/** Human-readable creation date (e.g. "Aug 9, 2026"). */
	private get createdLabel(): string {
		return format(this.props.createdAt, "MMM d, yyyy");
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			this.paragraph(`A new API key was added to your ${this.strong(context.appName)} account.`),
			this.detailsCard([
				{ label: "Key name", value: this.props.keyName },
				{ label: "Created", value: this.createdLabel },
			]),
			this.paragraph("If this was you, no action is needed."),
			this.note(`Didn't create this key? ${this.link(this.props.manageKeysUrl, "Revoke it now")} and contact support.`),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`A new API key was added to your ${context.appName} account on ${this.createdLabel}:`,
			`- Name: ${this.props.keyName}`,
			"",
			"If this was you, no action is needed.",
			`If you didn't create this key, revoke it at ${this.props.manageKeysUrl} and contact support.`,
		].join("\n");
	}
}
