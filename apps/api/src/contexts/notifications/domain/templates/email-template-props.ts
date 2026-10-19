import { EmailJobPropValueSchema, type EmailTemplateKey } from "@workspace/shared";

import type { BaseEmailTemplate, BaseEmailProps } from "./base/base-email-template";
import { EMAIL_TEMPLATE_REGISTRY, type EmailJobProps } from "./email-template.registry";

/** Rebuild a concrete template instance from a queued job payload. */
export function buildEmailTemplateFromJobData(templateKey: EmailTemplateKey, props: EmailJobProps): BaseEmailTemplate<BaseEmailProps> {
	return EMAIL_TEMPLATE_REGISTRY[templateKey].fromJobData(props);
}

/**
 * Template props → a JSON-safe record for BullMQ. Every prop must survive the
 * round trip: an unserializable prop throws instead of being silently dropped
 * (it used to drop `cc` / `bcc`). `undefined` (an absent optional prop) is omitted.
 */
export function serializeEmailTemplateProps(props: BaseEmailProps): EmailJobProps {
	const serialized: EmailJobProps = {};
	for (const [key, value] of Object.entries(props)) {
		if (value === undefined) {
			continue;
		}
		serialized[key] = EmailJobPropValueSchema.parse(value);
	}
	return serialized;
}
