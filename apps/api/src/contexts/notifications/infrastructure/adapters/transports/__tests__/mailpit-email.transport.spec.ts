import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { RequestContextService } from "../../../../../../platform/infrastructure/context/request-context";
import { LogService } from "../../../../../../platform/infrastructure/logging/logs.service";
import { createTestApiConfig } from "../../../../../../../test/support/test-api-env";
import { EmailTransportError, type OutboundEmail } from "../email-transport";
import { MAILPIT_EMAIL_LOG_ID_HEADER, MailpitEmailTransport } from "../mailpit-email.transport";

const MAILPIT_URL = "http://localhost:8025";
const MAILPIT_MESSAGE_ID = "6QW7vrP77c9alcT3lie5fA";
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVICE_UNAVAILABLE = 503;

const fetchMock = vi.fn<typeof fetch>();
const logWarn = vi.fn<LogService["warn"]>();

const EMAIL: OutboundEmail = {
	emailLogId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
	templateKey: "login-verification",
	from: "noreply@example.com",
	to: "jamie@example.com",
	subject: "Your sign-in code",
	html: "<p>Your code is <b>123456</b></p>",
	text: "Your code is 123456",
	cc: ["cc@example.com"],
	bcc: ["bcc@example.com"],
	replyTo: "support@example.com",
};

function transport(mode: "send" | "log-only" = "send"): MailpitEmailTransport {
	const config = createTestApiConfig({ EMAIL_MODE: mode, EMAIL_PROVIDER: "mailpit", MAILPIT_URL: `${MAILPIT_URL}/` });
	const logService = new LogService(new RequestContextService());
	vi.spyOn(logService, "warn").mockImplementation(logWarn);
	return new MailpitEmailTransport(config.email, logService);
}

function reply(body: string, status: number): Response {
	return new Response(body, { status });
}

/** The JSON body of the one `fetch` call, as Mailpit receives it. */
function sentBody(): string {
	const call = fetchMock.mock.calls.at(0);
	return z.string().parse(call?.[LIST_SLOT_INDEX.second]?.body);
}

describe("MailpitEmailTransport", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("posts the rendered email to Mailpit's send API and returns its message id without a Resend id", async () => {
		fetchMock.mockResolvedValue(reply(JSON.stringify({ ID: MAILPIT_MESSAGE_ID }), HTTP_OK));

		await expect(transport().deliver(EMAIL)).resolves.toEqual({ providerMessageId: MAILPIT_MESSAGE_ID, resendId: null });

		expect(fetchMock).toHaveBeenCalledWith(`${MAILPIT_URL}/api/v1/send`, expect.objectContaining({ method: "POST" }));
		expect(JSON.parse(sentBody())).toEqual({
			From: { Email: "noreply@example.com" },
			To: [{ Email: "jamie@example.com" }],
			Cc: [{ Email: "cc@example.com" }],
			Bcc: ["bcc@example.com"],
			ReplyTo: [{ Email: "support@example.com" }],
			Subject: "Your sign-in code",
			Text: "Your code is 123456",
			HTML: "<p>Your code is <b>123456</b></p>",
			Tags: ["login-verification"],
			Headers: { [MAILPIT_EMAIL_LOG_ID_HEADER]: EMAIL.emailLogId },
		});
	});

	it("sends no Reply-To when the email has none", async () => {
		fetchMock.mockResolvedValue(reply(JSON.stringify({ ID: MAILPIT_MESSAGE_ID }), HTTP_OK));

		await transport().deliver({ ...EMAIL, replyTo: undefined });

		expect(JSON.parse(sentBody())).toMatchObject({ ReplyTo: [] });
	});

	it("reports an unreachable Mailpit as transient, with a hint to start it", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		const delivery = transport().deliver(EMAIL);

		await expect(delivery).rejects.toBeInstanceOf(EmailTransportError);
		await expect(delivery).rejects.toMatchObject({ kind: "transient" });
		await expect(delivery).rejects.toThrow("pnpm mailpit");
	});

	it("reports a 4xx as rejected, carrying Mailpit's own error text", async () => {
		fetchMock.mockResolvedValue(reply(JSON.stringify({ Error: "error building message: from not set" }), HTTP_BAD_REQUEST));

		await expect(transport().deliver(EMAIL)).rejects.toMatchObject({ kind: "rejected", message: "Mailpit refused the email: error building message: from not set" });
	});

	it("reports a 5xx as transient, falling back to the status when the body is not JSON", async () => {
		fetchMock.mockResolvedValue(reply("upstream down", HTTP_SERVICE_UNAVAILABLE));

		await expect(transport().deliver(EMAIL)).rejects.toMatchObject({ kind: "transient", message: "Mailpit refused the email: HTTP 503" });
	});

	it("reports a reply without a message id as transient", async () => {
		fetchMock.mockResolvedValue(reply(JSON.stringify({ unexpected: true }), HTTP_OK));

		await expect(transport().deliver(EMAIL)).rejects.toMatchObject({ kind: "transient", message: "Mailpit returned no message id" });
	});

	describe("boot probe", () => {
		it("warns once when no Mailpit answers", async () => {
			fetchMock.mockRejectedValue(new TypeError("fetch failed"));

			await transport().onApplicationBootstrap();

			expect(fetchMock).toHaveBeenCalledWith(`${MAILPIT_URL}/readyz`, expect.anything());
			expect(logWarn).toHaveBeenCalledWith(expect.stringContaining("no Mailpit answers"), expect.anything());
		});

		it("stays quiet when Mailpit is ready", async () => {
			fetchMock.mockResolvedValue(reply("", HTTP_OK));

			await transport().onApplicationBootstrap();

			expect(logWarn).not.toHaveBeenCalled();
		});

		it("does not probe when emails are not being sent", async () => {
			await transport("log-only").onApplicationBootstrap();

			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
});
