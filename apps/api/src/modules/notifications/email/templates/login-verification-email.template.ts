import { LoginVerificationEmailPropsSchema, type LoginVerificationEmailProps } from "@workspace/shared";

import { BaseEmailTemplate, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/** Login verification OTP for unrecognized devices. */
export class LoginVerificationEmailTemplate extends BaseEmailTemplate<LoginVerificationEmailProps> {
	public static readonly sampleProps: LoginVerificationEmailProps = {
		to: "alice@example.com",
		verificationCode: "482916",
		expiresInMinutes: 10,
		deviceInfo: "Chrome on macOS",
		ipAddress: "203.0.113.10",
	};

	public readonly key: string = "login-verification";
	public readonly propsSchema = LoginVerificationEmailPropsSchema;
	public readonly subject: string = "Verify your sign-in";
	protected readonly accent: EmailAccent = "indigo";
	protected readonly eyebrow: string = "Security";
	protected readonly heading: string = "New sign-in verification";

	public getPreviewText(_context: EmailRenderContext): string {
		return `Your sign-in verification code is ${this.props.verificationCode}.`;
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">We noticed a sign-in attempt from a new device or location. Enter this code to continue:</p>
        ${this.otpCodeBlock(this.props.verificationCode)}
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 8px 0;">Device: ${this.escape(this.props.deviceInfo)}</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">IP address: ${this.escape(this.props.ipAddress)} · Expires in ${String(this.props.expiresInMinutes)} minutes.</p>`;
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return [
			"We noticed a sign-in attempt from a new device or location.",
			"",
			`Verification code: ${this.props.verificationCode}`,
			`Device: ${this.props.deviceInfo}`,
			`IP address: ${this.props.ipAddress}`,
			`Expires in ${String(this.props.expiresInMinutes)} minutes.`,
		].join("\n");
	}
}
