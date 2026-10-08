import { describe, expect, it } from "vitest";
import { z } from "zod";

import { BaseEmailPropsSchema } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "./base-email-template";
import type { EmailRenderContext } from "./email-render-context";
import { PasswordResetEmailTemplate } from "../templates/password-reset-email.template";

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
	protected readonly accent: EmailAccent = "sky";
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
	public override getCta(): CtaConfig | null {
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

/** A hostile value every building block must escape. */
const HOSTILE = '<b onmouseover="x">Hi</b>';

/** Exercises every building block with hostile input, CTA placed in the body. */
class BlocksTemplate extends BaseEmailTemplate<{ readonly to: string }> {
	public readonly key: string = "blocks";
	public readonly propsSchema = BaseEmailPropsSchema;
	public readonly subject: string = "Blocks";
	protected readonly accent: EmailAccent = "red";
	protected readonly eyebrow: string = "Blocks";
	protected readonly heading: string = "Building blocks";
	protected override readonly ctaPlacement = "in-body";
	public getPreviewText(): string {
		return "Blocks";
	}
	public renderBodyHtml(renderContext: EmailRenderContext): string {
		return [
			this.paragraph(`Hello ${this.strong(HOSTILE)}`),
			this.detailsCard([{ label: HOSTILE, value: HOSTILE }]),
			this.highlight(HOSTILE, HOSTILE),
			this.callout(HOSTILE, HOSTILE),
			this.steps([{ title: HOSTILE, description: HOSTILE }]),
			this.otpCodeBlock("482916"),
			this.ctaInBody(renderContext),
			this.note(this.link("https://app.example.com/x?a=1&b=2", HOSTILE)),
		].join("");
	}
	public renderBodyText(): string {
		return "Blocks";
	}
	public override getCta(): CtaConfig | null {
		return { label: "Go now", href: "https://app.example.com/go" };
	}
}

describe("BaseEmailTemplate building blocks", () => {
	const html: string = new BlocksTemplate({ to: "a@b.com" }).renderHtml(context);

	it("escapes every value they are given", () => {
		expect(html).not.toContain(HOSTILE);
		expect(html).not.toContain("<b onmouseover");
		expect(html.split("&lt;b onmouseover=&quot;x&quot;&gt;Hi&lt;/b&gt;").length - 1).toBeGreaterThanOrEqual(9);
		expect(html).toContain("https://app.example.com/x?a=1&amp;b=2");
	});

	it("renders a one-time code as one tile per character", () => {
		expect(html.match(/class="email-otp-tile"/g)).toHaveLength(6);
	});

	it("renders an in-body CTA exactly once (the shell does not add a second), and keeps it in the plain-text twin", () => {
		expect(html.match(/>Go now</g)).toHaveLength(1);
		expect(new BlocksTemplate({ to: "a@b.com" }).renderText(context)).toContain("Action: Go now");
	});

	it("keeps the card at the standard 600px email width and shows the tone as a dot, not a bar", () => {
		expect(html).toContain("max-width: 600px");
		expect(html).toContain("border-radius: 4px; background: #dc2626; vertical-align: middle;");
	});

	it("draws no decorative borders: no accent bar, no side stripes, no boxed panels", () => {
		expect(html).not.toMatch(/border-left|border-right|border-bottom/);
		expect(html).not.toMatch(/border: ?1px/);
		// The only line in the card is the hairline between ledger rows.
		expect(html.match(/border-top: 1px/g) ?? []).toHaveLength(0);
	});

	it("keeps the eyebrow in sentence case and the button free of decoration", () => {
		expect(html).not.toContain("text-transform: uppercase");
		expect(html).not.toContain("&rarr;");
	});
});
