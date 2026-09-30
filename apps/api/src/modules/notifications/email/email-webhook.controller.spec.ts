import { ForbiddenException } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureFastifyRequest } from "../../../../test/support/fastify-request";
import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { LogService } from "../../logs/logs.service";
import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogRepository } from "./email-log.repository";
import { EmailLogService } from "./email-log.service";
import { EmailWebhookController } from "./email-webhook.controller";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
	verify: vi.fn(),
	logInfo: vi.fn(),
	logWarn: vi.fn(),
	logError: vi.fn(),
	updateStatusByResendId: vi.fn(),
}));

const verifyMock = mocks.verify;

vi.mock("resend", () => {
	class MockResend {
		public readonly webhooks = { verify: mocks.verify };
		public readonly emails = { send: vi.fn() };
	}
	return { Resend: MockResend };
});

vi.mock("../../../config/typed-config.service", () => ({
	TypedConfigService: class {
		public readonly resendWebhookSecret = "whsec_dGVzdC1zZWNyZXQ=";
		public readonly resendApiKey = "re_dummy";
	},
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {},
}));

vi.mock("../../logs/logs.service", () => ({
	LogService: class {
		public readonly info = mocks.logInfo;
		public readonly warn = mocks.logWarn;
		public readonly error = mocks.logError;
	},
}));

vi.mock("./email-log.service", () => ({
	EmailLogService: class {
		public readonly updateStatusByResendId = mocks.updateStatusByResendId;
	},
}));

const EMAIL_ID: string = "56715290-9fa9-482a-b098-ba4cc1e1d813";

function makeController(): EmailWebhookController {
	return new EmailWebhookController(new TypedConfigService(), new EmailLogService(new EmailLogRepository(new PrismaService()), new EmailLogEventsService()), new LogService());
}

/** A real Fastify request whose raw body + headers mimic a genuine Svix delivery. */
async function makeReq(body: string, headers: Record<string, string>): Promise<RawBodyRequest<FastifyRequest>> {
	const request = await captureFastifyRequest({ headers, payload: body });
	return Object.assign(request, { rawBody: Buffer.from(body, "utf8") });
}

function signedHeaders(): Record<string, string> {
	return {
		"content-type": "application/json",
		"webhook-id": "msg_test_1",
		"webhook-timestamp": "1786450000",
		"webhook-signature": "v1,abc",
	};
}

async function deliver(controller: EmailWebhookController, payload: object): Promise<{ readonly received: true }> {
	const body: string = JSON.stringify(payload);
	verifyMock.mockReturnValue(JSON.parse(body));
	return controller.receive(await makeReq(body, signedHeaders()), signedHeaders());
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("EmailWebhookController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.updateStatusByResendId.mockResolvedValue("updated");
	});

	it("acknowledges tracking events (email.opened) without touching the row", async () => {
		const result = await deliver(makeController(), { type: "email.opened", data: { email_id: EMAIL_ID } });
		expect(result).toEqual({ received: true });
		expect(mocks.updateStatusByResendId).not.toHaveBeenCalled();
	});

	it("flips status to bounced and captures the bounce reason", async () => {
		await deliver(makeController(), {
			type: "email.bounced",
			data: { email_id: EMAIL_ID, bounce: { created_at: "2026-08-11T00:00:00.000Z", bounce_type: "permanent", raw: {} } },
		});
		expect(mocks.updateStatusByResendId).toHaveBeenCalledWith(EMAIL_ID, "bounced", "permanent");
	});

	it("flips status to complained and captures the complaint reason", async () => {
		await deliver(makeController(), {
			type: "email.complained",
			data: { email_id: EMAIL_ID, complaint: { created_at: "2026-08-11T00:00:00.000Z", complaint_type: "abuse", raw: {} } },
		});
		expect(mocks.updateStatusByResendId).toHaveBeenCalledWith(EMAIL_ID, "complained", "abuse");
	});

	it("acknowledges ignored events without touching the row", async () => {
		const result = await deliver(makeController(), { type: "email.forwarded", data: { email_id: EMAIL_ID } });
		expect(result).toEqual({ received: true });
		expect(mocks.updateStatusByResendId).not.toHaveBeenCalled();
		expect(mocks.updateStatusByResendId).not.toHaveBeenCalled();
	});

	it("rejects requests without signature headers before any service call", async () => {
		const body: string = JSON.stringify({ type: "email.delivered", data: { email_id: EMAIL_ID } });
		await expect(makeController().receive(await makeReq(body, { "content-type": "application/json" }), { "content-type": "application/json" })).rejects.toThrow(
			ForbiddenException,
		);
		expect(mocks.updateStatusByResendId).not.toHaveBeenCalled();
	});

	it("acknowledges + logs (never writes) an event for an email it didn't send", async () => {
		mocks.updateStatusByResendId.mockResolvedValueOnce("not_found");
		const result = await deliver(makeController(), { type: "email.delivered", data: { email_id: "some-other-apps-email-id" } });
		expect(result).toEqual({ received: true });
		expect(mocks.logInfo).toHaveBeenCalledWith(expect.stringContaining("unknown resend_id some-other-apps-email-id"), expect.anything());
	});

	it("acknowledges + logs (never writes) a replayed event that would regress status", async () => {
		mocks.updateStatusByResendId.mockResolvedValueOnce("stale");
		const result = await deliver(makeController(), { type: "email.sent", data: { email_id: EMAIL_ID } });
		expect(result).toEqual({ received: true });
		expect(mocks.logInfo).toHaveBeenCalledWith(expect.stringContaining("would regress status"), expect.anything());
	});
});
