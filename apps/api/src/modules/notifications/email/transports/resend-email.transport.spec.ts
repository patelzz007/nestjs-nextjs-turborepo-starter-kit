import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailTransportError, type OutboundEmail } from "./email-transport";
import { EMAIL_LOG_ID_TAG, ResendEmailTransport } from "./resend-email.transport";

const mocks = vi.hoisted(() => ({ resendSend: vi.fn() }));

vi.mock("resend", () => ({
	Resend: class {
		public readonly emails = { send: mocks.resendSend };
	},
}));

const RESEND_ID = "re_1";

const EMAIL: OutboundEmail = {
	emailLogId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
	templateKey: "verification",
	from: "noreply@example.com",
	to: "jamie@example.com",
	subject: "Verify your email",
	html: "<p>Verify</p>",
	text: "Verify",
	cc: [],
	bcc: [],
	replyTo: undefined,
};

function failure(name: string): { data: null; error: { name: string; message: string; statusCode: number } } {
	return { data: null, error: { name, message: `Resend said ${name}`, statusCode: 400 } };
}

describe("ResendEmailTransport", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resendSend.mockResolvedValue({ data: { id: RESEND_ID }, error: null });
	});

	it("sends with the email log id as tag AND idempotency key, and returns the Resend id twice", async () => {
		await expect(new ResendEmailTransport("re_test_only").deliver(EMAIL)).resolves.toEqual({ providerMessageId: RESEND_ID, resendId: RESEND_ID });

		expect(mocks.resendSend).toHaveBeenCalledWith(
			{ from: EMAIL.from, to: EMAIL.to, subject: EMAIL.subject, html: EMAIL.html, text: EMAIL.text, tags: [{ name: EMAIL_LOG_ID_TAG, value: EMAIL.emailLogId }] },
			{ idempotencyKey: `email-log/${EMAIL.emailLogId}` },
		);
	});

	it("passes cc, bcc and reply-to only when present", async () => {
		await new ResendEmailTransport("re_test_only").deliver({ ...EMAIL, cc: ["cc@example.com"], bcc: ["bcc@example.com"], replyTo: "support@example.com" });

		expect(mocks.resendSend).toHaveBeenCalledWith(
			expect.objectContaining({ cc: ["cc@example.com"], bcc: ["bcc@example.com"], replyTo: "support@example.com" }),
			expect.anything(),
		);
	});

	it("rejects without an API key, before any network call", async () => {
		await expect(new ResendEmailTransport(null).deliver(EMAIL)).rejects.toMatchObject({ kind: "rejected" });
		expect(mocks.resendSend).not.toHaveBeenCalled();
	});

	it.each([
		["validation_error", "rejected"],
		["invalid_api_key", "rejected"],
		["daily_quota_exceeded", "rejected"],
		["rate_limit_exceeded", "rate-limited"],
		["internal_server_error", "transient"],
		["concurrent_idempotent_requests", "transient"],
	])("maps the Resend error code %s to a %s failure", async (code: string, kind: string) => {
		mocks.resendSend.mockResolvedValue(failure(code));

		await expect(new ResendEmailTransport("re_test_only").deliver(EMAIL)).rejects.toMatchObject({ kind, message: `Resend said ${code}` });
	});

	it("treats a thrown network failure as transient", async () => {
		mocks.resendSend.mockRejectedValue(new Error("socket hang up"));

		const delivery = new ResendEmailTransport("re_test_only").deliver(EMAIL);

		await expect(delivery).rejects.toBeInstanceOf(EmailTransportError);
		await expect(delivery).rejects.toMatchObject({ kind: "transient", message: "socket hang up" });
	});

	it("keeps the code of a non-Error rejection", async () => {
		mocks.resendSend.mockRejectedValue({ code: "invalid_api_key", message: "API key is invalid" });

		await expect(new ResendEmailTransport("re_test_only").deliver(EMAIL)).rejects.toMatchObject({ kind: "rejected", message: "API key is invalid" });
	});

	it("treats a reply without an id as transient", async () => {
		mocks.resendSend.mockResolvedValue({ data: null, error: null });

		await expect(new ResendEmailTransport("re_test_only").deliver(EMAIL)).rejects.toMatchObject({ kind: "transient", message: "Resend returned no email id" });
	});
});
