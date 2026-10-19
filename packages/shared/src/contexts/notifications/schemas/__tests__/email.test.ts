import { describe, expect, it } from "vitest";

import {
	EmailSendResultSchema,
	EmailTemplateMetaSchema,
	MailpitErrorResponseSchema,
	MailpitSendRequestSchema,
	MailpitSendResponseSchema,
	type EmailSendResult,
	type MailpitSendRequest,
} from "../email";

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
		const meta = { key: "welcome", label: "Welcome", description: "Sent after signup", sampleTo: "jane@example.com", sampleSubject: "Welcome aboard" };
		expect(EmailTemplateMetaSchema.parse({ ...meta, extra: true })).toEqual(meta);
	});

	it("requires the sample subject the preview header shows before the preview loads", () => {
		expect(EmailTemplateMetaSchema.safeParse({ key: "welcome", label: "Welcome", description: "Sent after signup", sampleTo: "jane@example.com" }).success).toBe(false);
	});
});

describe("Mailpit schemas (local development inbox)", () => {
	const request: MailpitSendRequest = {
		From: { Email: "noreply@example.com" },
		To: [{ Email: "jamie@example.com" }],
		Cc: [],
		Bcc: ["audit@example.com"],
		ReplyTo: [],
		Subject: "Your sign-in code",
		Text: "Verification code: 482913",
		HTML: "<p>482913</p>",
		Tags: ["login-verification"],
		Headers: { "X-Email-Log-Id": "7c9e6679-7425-40de-944b-e07fc1f90ae7" },
	};

	it("accepts a complete send request", () => {
		expect(MailpitSendRequestSchema.parse(request)).toEqual(request);
	});

	it("rejects a request without a recipient, with an invalid address, or with an empty tag", () => {
		expect(MailpitSendRequestSchema.safeParse({ ...request, To: [] }).success).toBe(false);
		expect(MailpitSendRequestSchema.safeParse({ ...request, Bcc: ["not-an-address"] }).success).toBe(false);
		expect(MailpitSendRequestSchema.safeParse({ ...request, Tags: [""] }).success).toBe(false);
	});

	it("reads Mailpit's message id and keeps unknown reply fields", () => {
		expect(MailpitSendResponseSchema.parse({ ID: "6QW7vrP77c9alcT3lie5fA", extra: 1 })).toEqual({ ID: "6QW7vrP77c9alcT3lie5fA", extra: 1 });
		expect(MailpitSendResponseSchema.safeParse({ ID: "" }).success).toBe(false);
	});

	it("reads Mailpit's error reply", () => {
		expect(MailpitErrorResponseSchema.parse({ Error: "from not set" }).Error).toBe("from not set");
		expect(MailpitErrorResponseSchema.safeParse({ message: "nope" }).success).toBe(false);
	});
});
