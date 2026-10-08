import { EmailRenderContextSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AdminAlertEmailTemplate } from "./admin-alert-email.template";

const context = EmailRenderContextSchema.parse({ appName: "Acme Inc", appUrl: "https://app.example.com", supportEmail: "support@example.com" });

const TITLE = "Webhook delivery failing";

function occurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

describe("AdminAlertEmailTemplate", () => {
	const template = new AdminAlertEmailTemplate({
		to: "ops@example.com",
		title: TITLE,
		message: "The Resend webhook has not delivered an event in the last 15 minutes.\n\nPlease check the dashboard & the delivery logs.",
		action: { label: "Open admin panel", url: "https://admin.example.com/" },
	});

	it("states the title once, as the heading — the body never repeats it", () => {
		expect(template.renderBodyHtml(context)).not.toContain(TITLE);
		expect(occurrences(template.renderHtml(context), `>${TITLE}</h1>`)).toBe(1);
	});

	it("renders each message paragraph, escaped, and the button", () => {
		const html = template.renderHtml(context);

		expect(html).toContain("The Resend webhook has not delivered an event in the last 15 minutes.");
		expect(html).toContain("Please check the dashboard &amp; the delivery logs.");
		expect(html).toContain(">Open admin panel<");
	});

	it("keeps the plain-text twin free of the repeated title", () => {
		const text = template.renderText(context);

		expect(occurrences(text, TITLE)).toBe(1);
		expect(text).toContain("Please check the dashboard & the delivery logs.");
	});

	it("drops the button when the alert has no action", () => {
		const withoutAction = new AdminAlertEmailTemplate({ to: "ops@example.com", title: TITLE, message: "Disk usage is at 91%." });

		expect(withoutAction.getCta(context)).toBeNull();
		expect(withoutAction.renderHtml(context)).not.toContain("email-cta");
	});
});
