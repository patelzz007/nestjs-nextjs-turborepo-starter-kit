import { describe, expect, it } from "vitest";

import { EmailSendJobSchema, EmailTemplateKeySchema, type AdminAlertEmailProps } from "@workspace/shared";

import { AdminAlertEmailTemplate } from "../admin-alert-email.template";
import { buildEmailTemplateFromJobData, serializeEmailTemplateProps } from "../email-template-props";
import { EMAIL_TEMPLATE_REGISTRY } from "../email-template.registry";

const EMAIL_LOG_ID = "0b6f0c2e-6a39-4d0c-9a51-3f1f7f6f2a10";

describe("serializeEmailTemplateProps", () => {
	it("queues every template's sample props and rebuilds the same props from the job", () => {
		for (const templateKey of EmailTemplateKeySchema.options) {
			const template = EMAIL_TEMPLATE_REGISTRY[templateKey].build();
			const job = EmailSendJobSchema.parse({ emailLogId: EMAIL_LOG_ID, templateKey, props: serializeEmailTemplateProps(template.props) });
			const rebuilt = buildEmailTemplateFromJobData(templateKey, job.props);
			expect(rebuilt.props, templateKey).toEqual(template.props);
		}
	});

	it("keeps the admin alert's call to action, an object prop (the minute monitor's alert email)", () => {
		const props = serializeEmailTemplateProps(AdminAlertEmailTemplate.sampleProps);
		expect(props).toHaveProperty("action", { label: "Open admin panel", url: "https://admin.example.com/" });
	});

	it("omits an absent optional prop instead of queuing undefined", () => {
		const withoutAction: AdminAlertEmailProps = { to: "ops@example.com", title: "Alert", message: "Body", action: undefined };
		const props = serializeEmailTemplateProps(withoutAction);
		expect(Object.keys(props).sort()).toEqual(["message", "title", "to"]);
	});

	it("throws on a prop the queue can't carry instead of dropping it", () => {
		const nested = { to: "ops@example.com", title: "Alert", message: "Body", action: { label: "Open", url: { href: "https://admin.example.com/" } } };
		expect(() => serializeEmailTemplateProps(nested)).toThrow();
	});
});
