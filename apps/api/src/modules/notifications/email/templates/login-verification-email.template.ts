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
		return [
			this.paragraph("Someone is signing in to your account from a new device or location. Enter this code to continue:"),
			this.otpCodeBlock(this.props.verificationCode),
			this.detailsCard([
				{ label: "Device", value: this.props.deviceInfo },
				{ label: "IP address", value: this.props.ipAddress },
				{ label: "Expires in", value: `${String(this.props.expiresInMinutes)} minutes` },
			]),
			this.note("Didn't try to sign in? Don't share this code — change your password instead."),
		].join("");
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
