import { describe, expect, it } from "vitest";
import { z } from "zod";

import { BaseEmailPropsSchema } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig } from "./base-email-template";
import type { EmailRenderContext } from "./email-render-context";
import { PasswordResetEmailTemplate } from "../templates/password-reset-email.template";
import { VerificationEmailTemplate } from "../templates/verification-email.template";

const context: EmailRenderContext = {
	appName: "Acme Inc",
	appUrl: "https://app.example.com",
	supportEmail: "support@example.com",
};

/** Minimal concrete template for exercising base behavior. */
class TestTemplate extends BaseEmailTemplate<{ readonly to: string; readonly fullName: string }> {
	public readonly key: string = "test";
	public readonly propsSchema = BaseEmailPropsSchema.extend({ fullName: z.string() });
	public readonly subject: string = "Test subject";
	protected readonly accent = "sky" as const;
	protected readonly eyebrow: string = "Test";
	protected readonly heading: string = "Hello";
	public getPreviewText(): string {
		return "Preview line";
	}
	public renderBodyHtml(): string {
		return `<p>Hi ${this.escape(this.props.fullName)} <script>alert(1)</script></p>`;
	}
	public renderBodyText(): string {
		return `Hi ${this.props.fullName}`;
	}
	public getCta(): CtaConfig | null {
		return { label: "Do It", href: "https://app.example.com/action" };
	}
}

describe("BaseEmailTemplate", () => {
	it("HTML-escapes every interpolated user value (rule 11)", () => {
		const template = new TestTemplate({ to: "a@b.com", fullName: '<img src=x onerror="alert(1)"> & friends' });
		const html = template.renderHtml(context);
		expect(html).not.toContain("<img src=x");
		expect(html).toContain("&lt;img src=x");
		expect(html).toContain("&quot;alert(1)&quot;");
		expect(html).toContain("&amp;");
	});

	it("builds absolute, query-encoded action URLs", () => {
		const template = new PasswordResetEmailTemplate({ to: "a@b.com", resetToken: "tok/+abc 123", expiresInHours: 1 });
		const href = template.getCta(context)?.href ?? "";
		expect(href).toContain("https://app.example.com/auth/reset-password");
		// Query values are percent-encoded via URLSearchParams (safe for tokens).
		expect(href).toContain("tok%2F%2Babc+123");
	});

	it("uses props.appUrl for client-specific reset links", () => {
		const template = new PasswordResetEmailTemplate({
			to: "a@b.com",
			resetToken: "abc123",
			expiresInHours: 1,
			appUrl: "https://admin.example.com",
		});
		const href = template.getCta(context)?.href ?? "";
		expect(href).toContain("https://admin.example.com/auth/reset-password");
		expect(href).toContain("token=abc123");
	});

	it("embeds the subject + preview text in the HTML shell", () => {
		const template = new TestTemplate({ to: "a@b.com", fullName: "Sam" });
		const html = template.renderHtml(context);
		expect(html).toContain("<title>Test subject</title>");
		expect(html).toContain("Preview line");
		expect(html).toContain(context.appName);
	});

	it("renders the CTA button with the escaped href", () => {
		const template = new TestTemplate({ to: "a@b.com", fullName: "Sam" });
		const html = template.renderHtml(context);
		expect(html).toContain("Do It");
		expect(html).toContain("https://app.example.com/action");
	});

	it("auto-computes the current year in the footer", () => {
		const template = new TestTemplate({ to: "a@b.com", fullName: "Sam" });
		const html = template.renderHtml(context);
		// The footer renders the HTML entity &copy; (safe in all mail clients).
		expect(html).toContain(`&copy; ${String(new Date().getFullYear())} ${context.appName}`);
	});

	it("produces a plain-text twin with the action URL", () => {
		const template = new TestTemplate({ to: "a@b.com", fullName: "Sam" });
		const text = template.renderText(context);
		expect(text).toContain("Hi Sam");
		expect(text).toContain("Action: Do It");
		expect(text).toContain("https://app.example.com/action");
		expect(text).toContain(`© ${String(new Date().getFullYear())} ${context.appName}`);
	});
});
