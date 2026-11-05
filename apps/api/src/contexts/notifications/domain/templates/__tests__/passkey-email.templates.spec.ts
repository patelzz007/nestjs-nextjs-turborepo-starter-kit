import { EmailRenderContextSchema, epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { PasskeyAddedEmailTemplate } from "../passkey-added-email.template";
import { PasskeyRemovedEmailTemplate } from "../passkey-removed-email.template";

const context = EmailRenderContextSchema.parse({ appName: "Acme Inc", appUrl: "https://app.example.com", supportEmail: "support@example.com" });
const PROPS = { to: "jamie@example.com", passkeyName: "Work <laptop>", changedAt: epochMs(1_786_000_000_000) };

describe("PasskeyAddedEmailTemplate (ADR 080)", () => {
	const template = new PasskeyAddedEmailTemplate(PROPS);

	it("announces the new sign-in credential by name, escaped, and says what to do if it wasn't the owner", () => {
		const html = template.renderHtml(context);

		expect(template.subject).toBe("A passkey was added to your account");
		expect(html).toContain("Work &lt;laptop&gt;");
		expect(html).not.toContain("Work <laptop>");
		expect(html).toContain("If you did not add it, change your password and remove the passkey");
	});

	it("says the same in its plain-text twin and preview", () => {
		expect(template.renderText(context)).toContain('The passkey "Work <laptop>" can now sign in to your Acme Inc account.');
		expect(template.getPreviewText(context)).toBe("A passkey was added to your Acme Inc account.");
	});
});

describe("PasskeyRemovedEmailTemplate (ADR 080)", () => {
	const template = new PasskeyRemovedEmailTemplate(PROPS);

	it("names the removed passkey, escaped, under its own subject", () => {
		expect(template.subject).toBe("A passkey was removed from your account");
		expect(template.renderHtml(context)).toContain("Work &lt;laptop&gt;");
		expect(template.getPreviewText(context)).toBe("A passkey was removed from your Acme Inc account.");
	});

	it("names it in the plain-text twin too", () => {
		expect(template.renderText(context)).toContain("Work <laptop>");
	});
});
