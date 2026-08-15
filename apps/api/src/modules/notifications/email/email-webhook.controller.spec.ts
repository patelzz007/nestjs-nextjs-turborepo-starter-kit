import { ForbiddenException } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TypedConfigService } from "../../../config/typed-config.service";
import type { LogService } from "../../logs/logs.service";
import type { EmailLogService } from "./email-log.service";
import { EmailWebhookController } from "./email-webhook.controller";

// ── Mocks ─────────────────────────────────────────────────────────────────

const verifyMock = vi.fn();

vi.mock("resend", () => {
	class MockResend {
		public readonly webhooks = { verify: verifyMock };
		public readonly emails = { send: vi.fn() };
	}
	return { Resend: MockResend };
});

const EMAIL_ID: string = "56715290-9fa9-482a-b098-ba4cc1e1d813";

const configMock = {
	resendWebhookSecret: "whsec_dGVzdC1zZWNyZXQ=",
	resendApiKey: "re_dummy",
} as unknown as TypedConfigService;

const logServiceMock = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
} as unknown as LogService;

const emailLogServiceMock = {
	updateStatusByResendId: vi.fn().mockResolvedValue("updated"),
} as unknown as EmailLogService;

function makeController(): EmailWebhookController {
	return new EmailWebhookController(configMock, emailLogServiceMock, logServiceMock);
}

/** A request whose raw body + headers mimic a genuine Svix delivery. */
function makeReq(body: string, headers: Record<string, string | undefined>): RawBodyRequest<Request> {
	return { rawBody: body, headers, ip: "::1" } as unknown as RawBodyRequest<Request>;
}

function signedHeaders(): Record<string, string> {
	return {
		"content-type": "application/json",
		"webhook-id": "msg_test_1",
		"webhook-timestamp": "1786450000",
		"webhook-signature": "v1,abc",
	};
}

function deliver(controller: EmailWebhookController, payload: object): Promise<{ readonly received: true }> {
	const body: string = JSON.stringify(payload);
	verifyMock.mockReturnValue(JSON.parse(body));
	return controller.receive(makeReq(body, signedHeaders()), signedHeaders());
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("EmailWebhookController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("acknowledges tracking events (email.opened) without touching the row", async () => {
		const result = await deliver(makeController(), { type: "email.opened", data: { email_id: EMAIL_ID } });
		expect(result).toEqual({ received: true });
		expect(emailLogServiceMock.updateStatusByResendId).not.toHaveBeenCalled();
	});

	it("flips status to bounced and captures the bounce reason", async () => {
		await deliver(makeController(), {
			type: "email.bounced",
			data: { email_id: EMAIL_ID, bounce: { created_at: "2026-08-11T00:00:00.000Z", bounce_type: "permanent", raw: {} } },
		});
		expect(emailLogServiceMock.updateStatusByResendId).toHaveBeenCalledWith(EMAIL_ID, "bounced", "permanent");
	});

	it("flips status to complained and captures the complaint reason", async () => {
		await deliver(makeController(), {
			type: "email.complained",
			data: { email_id: EMAIL_ID, complaint: { created_at: "2026-08-11T00:00:00.000Z", complaint_type: "abuse", raw: {} } },
		});
		expect(emailLogServiceMock.updateStatusByResendId).toHaveBeenCalledWith(EMAIL_ID, "complained", "abuse");
	});

	it("acknowledges ignored events without touching the row", async () => {
		const result = await deliver(makeController(), { type: "email.forwarded", data: { email_id: EMAIL_ID } });
		expect(result).toEqual({ received: true });
		expect(emailLogServiceMock.updateStatusByResendId).not.toHaveBeenCalled();
		expect(emailLogServiceMock.updateStatusByResendId).not.toHaveBeenCalled();
	});

	it("rejects requests without signature headers before any service call", async () => {
		const body: string = JSON.stringify({ type: "email.delivered", data: { email_id: EMAIL_ID } });
		await expect(makeController().receive(makeReq(body, { "content-type": "application/json" }), { "content-type": "application/json" })).rejects.toThrow(
			ForbiddenException,
		);
		expect(emailLogServiceMock.updateStatusByResendId).not.toHaveBeenCalled();
	});

	it("acknowledges + logs (never writes) an event for an email it didn't send", async () => {
		emailLogServiceMock.updateStatusByResendId.mockResolvedValueOnce("not_found");
		const result = await deliver(makeController(), { type: "email.delivered", data: { email_id: "some-other-apps-email-id" } });
		expect(result).toEqual({ received: true });
		expect(logServiceMock.info).toHaveBeenCalledWith(expect.stringContaining("unknown resend_id some-other-apps-email-id"), expect.anything());
	});

	it("acknowledges + logs (never writes) a replayed event that would regress status", async () => {
		emailLogServiceMock.updateStatusByResendId.mockResolvedValueOnce("stale");
		const result = await deliver(makeController(), { type: "email.sent", data: { email_id: EMAIL_ID } });
		expect(result).toEqual({ received: true });
		expect(logServiceMock.info).toHaveBeenCalledWith(expect.stringContaining("would regress status"), expect.anything());
	});
});
