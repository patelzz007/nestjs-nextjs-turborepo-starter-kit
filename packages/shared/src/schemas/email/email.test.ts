import { describe, expect, it } from "vitest";

import { EmailSendResultSchema, EmailTemplateMetaSchema, type EmailSendResult } from "./email";

// Response schemas are OPEN (ADR 022): unknown keys are stripped, never rejected.
// `EmailSendResultSchema` is a discriminated union on `ok`, so each variant
// keeps its own fields instead of collapsing onto the first matching option.

const sent: EmailSendResult = { ok: true, id: "re_123", mode: "send" };
const failed: EmailSendResult = { ok: false, reason: "api-error", detail: "Resend answered 500" };

describe("EmailSendResultSchema", () => {
	it("round-trips the success variant intact", () => {
		expect(EmailSendResultSchema.parse(sent)).toEqual(sent);
	});

	it("round-trips the failure variant intact (reason and detail survive)", () => {
		expect(EmailSendResultSchema.parse(failed)).toEqual(failed);
	});

	it("strips unknown keys instead of rejecting them", () => {
		expect(EmailSendResultSchema.parse({ ...sent, internal: "secret" })).toEqual(sent);
	});

	it("rejects a payload that matches no variant", () => {
		expect(EmailSendResultSchema.safeParse({ ok: false, id: "re_123" }).success).toBe(false);
	});
});

describe("EmailTemplateMetaSchema", () => {
	it("strips unknown keys", () => {
		const meta = { key: "welcome", label: "Welcome", description: "Sent after signup", sampleTo: "jane@example.com" };
		expect(EmailTemplateMetaSchema.parse({ ...meta, extra: true })).toEqual(meta);
	});
});
