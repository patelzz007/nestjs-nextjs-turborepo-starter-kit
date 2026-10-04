import { Test } from "@nestjs/testing";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { EmailLogService } from "./email-log.service";
import { EmailQueueService } from "./email-queue.service";
import { EmailRecipientRateLimiter } from "./email-recipient-rate-limiter";
import { EMAIL_LOG_ID_TAG, EmailSenderService } from "./email-sender.service";
import { VerificationEmailTemplate } from "./templates/verification-email.template";
import { createTestTypedConfig, type TestEnv } from "../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	steps: new Array<string>(),
	resendSend: vi.fn(),
	create: vi.fn(),
	findStatus: vi.fn(),
	finalizeSent: vi.fn(),
	finalizeFailed: vi.fn(),
	tryAcquire: vi.fn(),
	enqueue: vi.fn(),
	logError: vi.fn(),
}));

vi.mock("resend", () => ({
	Resend: class {
		public readonly emails = { send: mocks.resendSend };
	},
}));

const EMAIL_LOG_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const RECIPIENT = "jamie@example.com";
const SEND_ENV: TestEnv = { EMAIL_MODE: "send", RESEND_API_KEY: "re_test_only", EMAIL_MAX_ATTEMPTS: "3", EMAIL_TIMEOUT_MS: "100" };

function template(): VerificationEmailTemplate {
	return new VerificationEmailTemplate({ to: RECIPIENT, verificationToken: "token-1", expiresInHours: 24 });
}

/** A Resend reply carrying a provider id. */
function delivered(id: string): { data: { id: string }; error: null } {
	return { data: { id }, error: null };
}

async function createSender(env: TestEnv, withQueue: boolean): Promise<EmailSenderService> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			{ provide: TypedConfigService, useValue: createTestTypedConfig(env) },
			{ provide: LogService, useValue: { info: vi.fn(), warn: vi.fn(), error: mocks.logError } },
			{
				provide: EmailLogService,
				useValue: { create: mocks.create, findStatus: mocks.findStatus, finalizeSent: mocks.finalizeSent, finalizeFailed: mocks.finalizeFailed },
			},
			{ provide: EmailRecipientRateLimiter, useValue: { tryAcquire: mocks.tryAcquire } },
			{ provide: EmailQueueService, useValue: { isEnabled: (): boolean => withQueue, enqueue: mocks.enqueue } },
			RequestContextService,
		],
	}).compile();
	return new EmailSenderService(
		moduleRef.get(TypedConfigService),
		moduleRef.get(LogService),
		moduleRef.get(EmailLogService),
		moduleRef.get(EmailRecipientRateLimiter),
		moduleRef.get(RequestContextService),
		moduleRef.get(EmailQueueService),
	);
}

describe("EmailSenderService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.steps.length = 0;
		mocks.tryAcquire.mockResolvedValue(true);
		mocks.create.mockImplementation(async (): Promise<{ id: string }> => {
			mocks.steps.push("log-row");
			return Promise.resolve({ id: EMAIL_LOG_ID });
		});
		mocks.resendSend.mockImplementation(async (): Promise<{ data: { id: string }; error: null }> => {
			mocks.steps.push("provider");
			return Promise.resolve(delivered("re_1"));
		});
		mocks.finalizeSent.mockResolvedValue(true);
		mocks.finalizeFailed.mockResolvedValue(true);
		mocks.findStatus.mockResolvedValue("pending");
		mocks.enqueue.mockResolvedValue(EMAIL_LOG_ID);
	});

	describe("send (inline, no queue)", () => {
		it("writes the pending log row BEFORE calling the provider, then finalizes it as sent", async () => {
			const sender = await createSender(SEND_ENV, false);

			await expect(sender.send(template())).resolves.toEqual({ ok: true, id: "re_1", mode: "send" });

			expect(mocks.steps).toEqual(["log-row", "provider"]);
			expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", to: RECIPIENT, templateKey: "verification" }));
			expect(mocks.finalizeSent).toHaveBeenCalledWith(EMAIL_LOG_ID, { templateKey: "verification", to: RECIPIENT }, "re_1", expect.any(Number));
		});

		it("sends nothing when the log row cannot be written", async () => {
			mocks.create.mockRejectedValue(new Error("database unavailable"));
			const sender = await createSender(SEND_ENV, false);

			await expect(sender.send(template())).resolves.toEqual({ ok: false, reason: "persistence", detail: "database unavailable" });
			expect(mocks.resendSend).not.toHaveBeenCalled();
		});

		it("makes every provider call idempotent by the log id and tags the email with it", async () => {
			const sender = await createSender(SEND_ENV, false);

			await sender.send(template());

			expect(mocks.resendSend).toHaveBeenCalledWith(expect.objectContaining({ to: RECIPIENT, tags: [{ name: EMAIL_LOG_ID_TAG, value: EMAIL_LOG_ID }] }), {
				idempotencyKey: `email-log/${EMAIL_LOG_ID}`,
			});
		});

		it("retries a timed-out call with the SAME idempotency key, so the retry cannot send twice", async () => {
			mocks.resendSend
				.mockImplementationOnce(async (): Promise<ReturnType<typeof delivered>> => new Promise<ReturnType<typeof delivered>>(() => undefined))
				.mockResolvedValueOnce(delivered("re_2"));
			const sender = await createSender(SEND_ENV, false);

			await expect(sender.send(template())).resolves.toEqual({ ok: true, id: "re_2", mode: "send" });

			const keys = mocks.resendSend.mock.calls.map((call) => JSON.stringify(call[1]));
			expect(keys).toEqual([JSON.stringify({ idempotencyKey: `email-log/${EMAIL_LOG_ID}` }), JSON.stringify({ idempotencyKey: `email-log/${EMAIL_LOG_ID}` })]);
			expect(mocks.finalizeSent).toHaveBeenCalledTimes(1);
		});

		it("does not retry a non-retryable provider error and finalizes the row as failed", async () => {
			mocks.resendSend.mockResolvedValue({ data: null, error: { name: "validation_error", message: "Invalid `to` field", statusCode: 422 } });
			const sender = await createSender(SEND_ENV, false);

			await expect(sender.send(template())).resolves.toMatchObject({ ok: false, reason: "api-error" });
			expect(mocks.resendSend).toHaveBeenCalledTimes(1);
			expect(mocks.finalizeFailed).toHaveBeenCalledWith(EMAIL_LOG_ID, { templateKey: "verification", to: RECIPIENT }, expect.any(String), expect.any(Number));
		});

		it("reports success when the email went out even if finalizing the row fails (no resend by the caller)", async () => {
			mocks.finalizeSent.mockRejectedValue(new Error("database blip"));
			const sender = await createSender(SEND_ENV, false);

			await expect(sender.send(template())).resolves.toEqual({ ok: true, id: "re_1", mode: "send" });
			expect(mocks.logError).toHaveBeenCalledWith(expect.stringContaining("could not be finalized"), expect.anything());
		});

		it("refuses a rate-limited recipient before writing or sending anything", async () => {
			mocks.tryAcquire.mockResolvedValue(false);
			const sender = await createSender(SEND_ENV, false);

			await expect(sender.send(template())).resolves.toEqual({ ok: false, reason: "rate-limited" });
			expect(mocks.create).not.toHaveBeenCalled();
			expect(mocks.resendSend).not.toHaveBeenCalled();
		});

		it("fails closed when the rate limiter itself is unavailable", async () => {
			mocks.tryAcquire.mockRejectedValue(new Error("redis down"));
			const sender = await createSender(SEND_ENV, false);

			await expect(sender.send(template())).resolves.toEqual({ ok: false, reason: "rate-limited" });
			expect(mocks.resendSend).not.toHaveBeenCalled();
		});

		it("records who triggered an audited send on the log row", async () => {
			const sender = await createSender(SEND_ENV, false);

			await sender.send(template(), { audit: { trigger: "admin-test-send", actorUserId: "admin-1" } });

			expect(mocks.create.mock.calls.at(0)?.at(0)).toMatchObject({ metadata: { trigger: "admin-test-send", actorUserId: "admin-1", mode: "send" } });
		});
	});

	describe("simulated modes", () => {
		it("noop writes a row marked with its mode and never calls the provider", async () => {
			const sender = await createSender({ EMAIL_MODE: "noop" }, false);

			await expect(sender.send(template())).resolves.toEqual({ ok: true, id: EMAIL_LOG_ID, mode: "noop" });
			expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ status: "sent", metadata: { mode: "noop" } }));
			expect(mocks.resendSend).not.toHaveBeenCalled();
		});
	});

	describe("queued delivery", () => {
		it("enqueues the pending row id instead of sending", async () => {
			const sender = await createSender(SEND_ENV, true);

			await expect(sender.send(template())).resolves.toEqual({ ok: true, id: EMAIL_LOG_ID, mode: "queued" });
			expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ emailLogId: EMAIL_LOG_ID, templateKey: "verification" }));
			expect(mocks.resendSend).not.toHaveBeenCalled();
		});

		it("marks the row failed and reports `queue` when the job cannot be enqueued", async () => {
			mocks.enqueue.mockRejectedValue(new Error("redis down"));
			const sender = await createSender(SEND_ENV, true);

			await expect(sender.send(template())).resolves.toMatchObject({ ok: false, reason: "queue" });
			expect(mocks.finalizeFailed).toHaveBeenCalledTimes(1);
		});

		it("makes exactly ONE provider call per job execution and leaves retrying to BullMQ", async () => {
			mocks.resendSend.mockRejectedValue(new Error("socket hang up"));
			const sender = await createSender(SEND_ENV, true);

			const execution = sender.deliverQueued(EMAIL_LOG_ID, template(), { attemptNumber: 1, maxAttempts: 5 });

			await expect(execution).rejects.toThrow("socket hang up");
			await expect(execution).rejects.not.toBeInstanceOf(UnrecoverableError);
			expect(mocks.resendSend).toHaveBeenCalledTimes(1);
			expect(mocks.finalizeFailed).not.toHaveBeenCalled();
		});

		it("stops BullMQ immediately on a non-retryable error", async () => {
			mocks.resendSend.mockResolvedValue({ data: null, error: { name: "invalid_api_key", message: "API key is invalid", statusCode: 403 } });
			const sender = await createSender(SEND_ENV, true);

			await expect(sender.deliverQueued(EMAIL_LOG_ID, template(), { attemptNumber: 1, maxAttempts: 5 })).rejects.toBeInstanceOf(UnrecoverableError);
			expect(mocks.finalizeFailed).toHaveBeenCalledTimes(1);
		});

		it("finalizes the row as failed on the last attempt", async () => {
			mocks.resendSend.mockRejectedValue(new Error("socket hang up"));
			const sender = await createSender(SEND_ENV, true);

			await expect(sender.deliverQueued(EMAIL_LOG_ID, template(), { attemptNumber: 5, maxAttempts: 5 })).rejects.toBeInstanceOf(UnrecoverableError);
			expect(mocks.finalizeFailed).toHaveBeenCalledTimes(1);
		});

		it("skips a redelivered job whose row was already finalized", async () => {
			mocks.findStatus.mockResolvedValue("sent");
			const sender = await createSender(SEND_ENV, true);

			await expect(sender.deliverQueued(EMAIL_LOG_ID, template(), { attemptNumber: 2, maxAttempts: 5 })).resolves.toBeUndefined();
			expect(mocks.resendSend).not.toHaveBeenCalled();
		});
	});
});
