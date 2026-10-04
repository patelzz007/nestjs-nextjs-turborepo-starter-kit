import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureFastifyRequest } from "../../../../test/support/fastify-request";
import { signResendWebhook, TEST_RESEND_WEBHOOK_SECRET } from "../../../../test/support/resend-webhook-signature";
import { TEST_API_ENV, type TestEnv } from "../../../../test/support/test-api-env";
import { parseApiConfig } from "../../../config/api-config";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { EmailLogService } from "./email-log.service";
import { EMAIL_LOG_ID_TAG } from "./email-sender.service";
import { EmailWebhookController } from "./email-webhook.controller";

/**
 * The controller runs the REAL Resend signature verification over payloads
 * signed with a test-only secret — nothing about verification is mocked. Only
 * the persistence behind `EmailLogService.applyDeliveryEvent` is stubbed (its
 * database behaviour is covered by test/email-delivery-webhook.e2e-spec.ts).
 */

const mocks = vi.hoisted(() => ({
	applyDeliveryEvent: vi.fn(),
	logInfo: vi.fn(),
	logWarn: vi.fn(),
	logError: vi.fn(),
}));

const EMAIL_ID = "56715290-9fa9-482a-b098-ba4cc1e1d813";
const EMAIL_LOG_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OCCURRED_AT = "2026-10-02T10:00:00.000Z";
const CONFIGURED: TestEnv = { RESEND_API_KEY: "re_test_only", RESEND_WEBHOOK_SECRET: TEST_RESEND_WEBHOOK_SECRET };
/** Standard-webhooks tolerance is 5 minutes — 10 minutes is safely outside it. */
const EXPIRED_SIGNATURE_AGE_MS = 10 * 60 * 1000;

/** The test fixture plus `overrides`, without the variables named in `unset`. */
function configWith(overrides: TestEnv, unset: readonly string[] = []): TypedConfigService {
	const env: TestEnv = Object.fromEntries(Object.entries({ ...TEST_API_ENV, ...overrides }).filter(([name]): boolean => !unset.includes(name)));
	return new TypedConfigService(parseApiConfig(env));
}

async function makeController(config: TypedConfigService = configWith(CONFIGURED)): Promise<EmailWebhookController> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			{ provide: TypedConfigService, useValue: config },
			{ provide: EmailLogService, useValue: { applyDeliveryEvent: mocks.applyDeliveryEvent } },
			{ provide: LogService, useValue: { info: mocks.logInfo, warn: mocks.logWarn, error: mocks.logError } },
		],
	}).compile();
	// Constructed directly: the route's ThrottlerGuard is HTTP wiring, not under test here.
	return new EmailWebhookController(moduleRef.get(TypedConfigService), moduleRef.get(EmailLogService), moduleRef.get(LogService));
}

async function post(controller: EmailWebhookController, body: string, headers: Readonly<Record<string, string>>): Promise<{ readonly received: true }> {
	const request: FastifyRequest = await captureFastifyRequest({ headers: { ...headers }, payload: body });
	const raw: RawBodyRequest<FastifyRequest> = Object.assign(request, { rawBody: Buffer.from(body, "utf8") });
	return controller.receive(raw, { ...headers });
}

function eventBody(type: string, data: Readonly<Record<string, string | object>> = {}): string {
	return JSON.stringify({ type, created_at: OCCURRED_AT, data: { email_id: EMAIL_ID, ...data } });
}

describe("EmailWebhookController (real signature verification)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.applyDeliveryEvent.mockResolvedValue({ kind: "recorded", outcome: "applied" });
	});

	it("accepts a correctly signed event and hands over webhook id, provider time and the email_log_id tag", async () => {
		const body = eventBody("email.delivered", { tags: { [EMAIL_LOG_ID_TAG]: EMAIL_LOG_ID } });

		await expect(post(await makeController(), body, signResendWebhook(body, { webhookId: "msg_1" }))).resolves.toEqual({ received: true });

		expect(mocks.applyDeliveryEvent).toHaveBeenCalledWith({
			webhookId: "msg_1",
			eventType: "email.delivered",
			resendId: EMAIL_ID,
			taggedEmailLogId: EMAIL_LOG_ID,
			status: "delivered",
			detail: undefined,
			occurredAt: Date.parse(OCCURRED_AT),
		});
	});

	it("accepts the svix-* header names Resend may use", async () => {
		const body = eventBody("email.sent");
		const signed = signResendWebhook(body, { webhookId: "msg_svix" });
		// Same signature, Svix header names (`webhook-id` → `svix-id`, …).
		const headers = Object.fromEntries(Object.entries(signed).map(([name, value]): [string, string] => [name.replace(/^webhook-/, "svix-"), value]));

		await expect(post(await makeController(), body, headers)).resolves.toEqual({ received: true });
		expect(mocks.applyDeliveryEvent).toHaveBeenCalledWith(expect.objectContaining({ webhookId: "msg_svix", status: "sent" }));
	});

	it("rejects a tampered body (signature covers the raw bytes)", async () => {
		const body = eventBody("email.delivered");
		const headers = signResendWebhook(body, { webhookId: "msg_2" });

		await expect(post(await makeController(), eventBody("email.bounced"), headers)).rejects.toBeInstanceOf(ForbiddenException);
		expect(mocks.applyDeliveryEvent).not.toHaveBeenCalled();
	});

	it("rejects a payload signed with a different secret", async () => {
		const body = eventBody("email.delivered");
		const headers = signResendWebhook(body, { webhookId: "msg_3", secret: "whsec_YW5vdGhlci1zZWNyZXQtYWx0b2dldGhlcg==" });

		await expect(post(await makeController(), body, headers)).rejects.toBeInstanceOf(ForbiddenException);
		expect(mocks.applyDeliveryEvent).not.toHaveBeenCalled();
	});

	it("rejects a replay whose signature timestamp is outside the tolerance window", async () => {
		const body = eventBody("email.delivered");
		const headers = signResendWebhook(body, { webhookId: "msg_4", signedAtMs: Date.now() - EXPIRED_SIGNATURE_AGE_MS });

		await expect(post(await makeController(), body, headers)).rejects.toBeInstanceOf(ForbiddenException);
		expect(mocks.applyDeliveryEvent).not.toHaveBeenCalled();
	});

	it("rejects a request without signature headers", async () => {
		await expect(post(await makeController(), eventBody("email.delivered"), { "content-type": "application/json" })).rejects.toBeInstanceOf(ForbiddenException);
		expect(mocks.applyDeliveryEvent).not.toHaveBeenCalled();
	});

	it.each(["RESEND_WEBHOOK_SECRET", "RESEND_API_KEY"])("answers 503 (so Resend retries) and records nothing when %s is not configured", async (missing: string) => {
		const body = eventBody("email.bounced");

		await expect(
			post(await makeController(configWith({ ...CONFIGURED, EMAIL_MODE: "noop" }, [missing])), body, signResendWebhook(body, { webhookId: "msg_5" })),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(mocks.applyDeliveryEvent).not.toHaveBeenCalled();
		expect(mocks.logError).toHaveBeenCalledWith(expect.stringContaining("not configured"), expect.anything());
	});

	it("rejects (400) a correctly signed payload that is not a Resend event shape, instead of acknowledging it", async () => {
		const body = JSON.stringify({ type: "email.delivered", data: { email_id: EMAIL_ID } });

		await expect(post(await makeController(), body, signResendWebhook(body, { webhookId: "msg_6" }))).rejects.toBeInstanceOf(BadRequestException);
		expect(mocks.applyDeliveryEvent).not.toHaveBeenCalled();
	});

	it("captures the bounce reason as the row detail", async () => {
		const body = eventBody("email.bounced", { bounce: { bounce_type: "permanent", message: "550 5.1.1 user unknown" } });

		await post(await makeController(), body, signResendWebhook(body, { webhookId: "msg_7" }));

		expect(mocks.applyDeliveryEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "bounced", detail: "permanent — 550 5.1.1 user unknown" }));
	});

	it("records tracking events with no status (they never change the row)", async () => {
		const body = eventBody("email.opened");

		await post(await makeController(), body, signResendWebhook(body, { webhookId: "msg_8" }));

		expect(mocks.applyDeliveryEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "email.opened", status: undefined }));
	});

	it("acknowledges a redelivered webhook id without applying it again", async () => {
		mocks.applyDeliveryEvent.mockResolvedValue({ kind: "duplicate" });
		const body = eventBody("email.delivered");

		await expect(post(await makeController(), body, signResendWebhook(body, { webhookId: "msg_9" }))).resolves.toEqual({ received: true });
		expect(mocks.logInfo).toHaveBeenCalledWith(expect.stringContaining("already recorded"), expect.anything());
	});

	it("ignores a malformed email_log_id tag and falls back to matching by provider id", async () => {
		const body = eventBody("email.delivered", { tags: { [EMAIL_LOG_ID_TAG]: "not-a-uuid" } });

		await post(await makeController(), body, signResendWebhook(body, { webhookId: "msg_10" }));

		expect(mocks.applyDeliveryEvent).toHaveBeenCalledWith(expect.objectContaining({ taggedEmailLogId: undefined, resendId: EMAIL_ID }));
	});
});
