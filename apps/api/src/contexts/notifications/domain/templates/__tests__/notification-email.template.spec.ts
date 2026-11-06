import type { NotificationEmailProps } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { EmailRenderContext } from "../base/email-render-context";
import { NotificationEmailTemplate } from "../notification-email.template";

const CONTEXT: EmailRenderContext = { appName: "Rewards", appUrl: "https://app.example.com", supportEmail: "support@example.com" };
const PLAIN: NotificationEmailProps = { to: "jamie@example.com", subject: "Hello", eyebrow: "News", heading: "Hello", paragraphs: ["A first look."] };
const FILE = { attachmentName: "statement.pdf", attachmentUrl: "https://cdn.example.com/statement.pdf" };
const PHOTO = { attachmentName: "cake.webp", attachmentUrl: "https://cdn.example.com/cake.webp", attachmentPreviewUrl: "https://cdn.example.com/cake-1280.webp" };

function template(props: NotificationEmailProps): NotificationEmailTemplate {
	return new NotificationEmailTemplate(props);
}

describe("NotificationEmailTemplate attachments", () => {
	it("shows a picture's smaller copy, linked to the full file", () => {
		const html = template({ ...PLAIN, ...PHOTO }).renderBodyHtml(CONTEXT);
		expect(html).toContain('<img src="https://cdn.example.com/cake-1280.webp"');
		expect(html).toContain('<a href="https://cdn.example.com/cake.webp">');
	});

	it("links a file with no picture, and shows no image", () => {
		const html = template({ ...PLAIN, ...FILE }).renderBodyHtml(CONTEXT);
		expect(html).toContain("https://cdn.example.com/statement.pdf");
		expect(html).toContain("statement.pdf");
		expect(html).not.toContain("<img");
	});

	it("names the file and its address in the plain-text part", () => {
		expect(template({ ...PLAIN, ...FILE }).renderBodyText(CONTEXT)).toContain("Attachment: statement.pdf\nhttps://cdn.example.com/statement.pdf");
	});

	it("says nothing about attachments when there is none", () => {
		expect(template(PLAIN).renderBodyHtml(CONTEXT)).not.toContain("<img");
		expect(template(PLAIN).renderBodyText(CONTEXT)).toBe("A first look.");
	});
});
