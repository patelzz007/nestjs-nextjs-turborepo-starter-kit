import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import { RequestContextService } from "../../../common/context/request-context";
import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { LogService } from "../../logs/logs.service";
import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogRepository } from "./email-log.repository";
import { EmailLogService } from "./email-log.service";
import { EmailSenderService } from "./email-sender.service";
import { VerificationEmailTemplate } from "./templates/verification-email.template";
import { createTestApiConfig, createTestTypedConfig } from "../../../../test/support/test-api-env";

// ── Mocks ─────────────────────────────────────────────────────────────────

interface EmailConfigState {
	resendApiKey: string | null;
	emailFromAddress: string;
	emailMode: "send" | "log-only" | "noop";
	emailTestTo: string | undefined;
	emailReplyTo: string | undefined;
	emailMaxAttempts: number;
	emailTimeoutMs: number;
	emailRateLimitPerMinute: number;
	appName: string;
	appUrl: string;
}

const mocks = vi.hoisted(() => {
	const baseConfig: EmailConfigState = {
		resendApiKey: "re_dummy",
		emailFromAddress: "noreply@example.com",
		emailMode: "send",
		emailTestTo: undefined,
		emailReplyTo: undefined,
		emailMaxAttempts: 3,
		emailTimeoutMs: 5_000,
		emailRateLimitPerMinute: 0,
		appName: "Acme Inc",
		appUrl: "https://app.example.com",
	};
	return {
		baseConfig,
		config: { current: baseConfig },
		resendSend: vi.fn(),
		logInfo: vi.fn(),
		logWarn: vi.fn(),
		logError: vi.fn(),
		emailLogCreate: vi.fn(),
		emailLogUpdateStatusByResendId: vi.fn(),
	};
});

const resendSendMock = mocks.resendSend;

vi.mock("resend", () => {
	class MockResend {
		public readonly emails = { send: mocks.resendSend };
		public readonly webhooks = { verify: vi.fn() };
	}
	return { Resend: MockResend };
});

vi.mock("../../../config/typed-config.service", () => ({
	TypedConfigService: class {
		// Snapshot at construction so each service keeps the config it was built with.
		public readonly resendApiKey = mocks.config.current.resendApiKey;
		public readonly emailFromAddress = mocks.config.current.emailFromAddress;
		public readonly emailMode = mocks.config.current.emailMode;
		public readonly emailTestTo = mocks.config.current.emailTestTo;
		public readonly emailReplyTo = mocks.config.current.emailReplyTo;
		public readonly emailMaxAttempts = mocks.config.current.emailMaxAttempts;
		public readonly emailTimeoutMs = mocks.config.current.emailTimeoutMs;
		public readonly emailRateLimitPerMinute = mocks.config.current.emailRateLimitPerMinute;
		public readonly appName = mocks.config.current.appName;
		public readonly appUrl = mocks.config.current.appUrl;
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
		public readonly create = mocks.emailLogCreate;
		public readonly updateStatusByResendId = mocks.emailLogUpdateStatusByResendId;
	},
}));

function createConfig(overrides: Partial<EmailConfigState> = {}): TypedConfigService {
	mocks.config.current = { ...mocks.baseConfig, ...overrides };
	return new TypedConfigService(createTestApiConfig());
}

const logServiceMock = new LogService(createTestTypedConfig(), new RequestContextService());
const emailLogServiceMock = new EmailLogService(
	new EmailLogRepository(new PrismaService(createTestTypedConfig())),
	new EmailLogEventsService(),
	new PlatformOutboxService(new TenantTransactionService(new PrismaService(createTestTypedConfig())), new RequestContextService()),
);

function makeTemplate(): VerificationEmailTemplate {
	return new VerificationEmailTemplate({ to: "jamie@example.com", verificationToken: "tok-123", expiresInHours: 24 });
}

describe("EmailSenderService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.emailLogCreate.mockResolvedValue({ id: "log-1" });
		mocks.emailLogUpdateStatusByResendId.mockResolvedValue("updated");
	});

	it("returns invalid-props without calling Resend when props are malformed", async () => {
		const service = new EmailSenderService(createConfig(), logServiceMock, emailLogServiceMock);
		const template = new VerificationEmailTemplate({ to: "not-an-email", verificationToken: "tok", expiresInHours: 24 });
		const result = await service.send(template);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("invalid-props");
		}
		expect(resendSendMock).not.toHaveBeenCalled();
	});

	it("never constructs a Resend client without RESEND_API_KEY and fails the send instead of calling out", async () => {
		const service = new EmailSenderService(createConfig({ resendApiKey: null }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(false);
		expect(resendSendMock).not.toHaveBeenCalled();
		expect(mocks.emailLogCreate).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
	});

	it("noop mode never touches the network but persists a row", async () => {
		const service = new EmailSenderService(createConfig({ emailMode: "noop" }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.mode).toBe("noop");
		}
		expect(resendSendMock).not.toHaveBeenCalled();
		expect(mocks.emailLogCreate).toHaveBeenCalledTimes(1);
	});

	it("log-only mode prints the rendered text and returns ok", async () => {
		const service = new EmailSenderService(createConfig({ emailMode: "log-only" }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.mode).toBe("log-only");
		}
		expect(resendSendMock).not.toHaveBeenCalled();
		expect(mocks.logInfo).toHaveBeenCalled();
	});

	it("applies the EMAIL_TEST_TO override in send mode", async () => {
		resendSendMock.mockResolvedValueOnce({ data: { id: "re-1" }, error: null, headers: null });
		const service = new EmailSenderService(createConfig({ emailTestTo: "qa@example.com" }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(true);
		expect(resendSendMock.mock.calls[0]?.[0]).toMatchObject({ to: "qa@example.com" });
	});

	it("returns the resend id on success and persists a sent row", async () => {
		resendSendMock.mockResolvedValueOnce({ data: { id: "re-42" }, error: null, headers: null });
		const service = new EmailSenderService(createConfig(), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.id).toBe("re-42");
			expect(result.mode).toBe("send");
		}
		expect(mocks.emailLogCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				templateKey: "verification",
				status: "sent",
				resendId: "re-42",
			}),
		);
		// The rendered HTML must NOT contain any tracking pixel (tracking removed).
		const sentPayload = z.object({ html: z.string() }).parse(resendSendMock.mock.calls[0]?.[0]);
		expect(sentPayload.html).not.toContain("/notifications/tracking/open");
	});

	it("retries transient failures and succeeds on a later attempt", async () => {
		resendSendMock.mockRejectedValueOnce({ code: "internal_server_error", message: "boom" }).mockResolvedValueOnce({ data: { id: "re-7" }, error: null, headers: null });
		const service = new EmailSenderService(createConfig({ emailMaxAttempts: 3 }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(true);
		expect(resendSendMock).toHaveBeenCalledTimes(2);
	});

	it("gives up after max attempts and reports api-error", async () => {
		resendSendMock.mockRejectedValue({ code: "internal_server_error", message: "boom" });
		const service = new EmailSenderService(createConfig({ emailMaxAttempts: 2 }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("api-error");
		}
		expect(resendSendMock).toHaveBeenCalledTimes(2);
	});

	it("does not retry non-retryable errors (validation_error)", async () => {
		resendSendMock.mockRejectedValue({ code: "validation_error", message: "bad" });
		const service = new EmailSenderService(createConfig({ emailMaxAttempts: 3 }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(false);
		expect(resendSendMock).toHaveBeenCalledTimes(1);
	});

	it("reports rate-limited when Resend says so", async () => {
		resendSendMock.mockResolvedValue({ data: null, error: { code: "rate_limit_exceeded", message: "slow down" }, headers: null });
		const service = new EmailSenderService(createConfig(), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("rate-limited");
		}
	});

	it("enforces the per-recipient rate limit before the network", async () => {
		resendSendMock.mockResolvedValue({ data: { id: "re-x" }, error: null, headers: null });
		const service = new EmailSenderService(createConfig({ emailRateLimitPerMinute: 2 }), logServiceMock, emailLogServiceMock);
		await service.send(makeTemplate());
		await service.send(makeTemplate());
		const third = await service.send(makeTemplate());
		expect(third.ok).toBe(false);
		if (!third.ok) {
			expect(third.reason).toBe("rate-limited");
		}
		expect(resendSendMock).toHaveBeenCalledTimes(2);
	});

	it("times out a hung send and reports timeout", async () => {
		resendSendMock.mockImplementation(
			(): Promise<void> =>
				new Promise<void>(() => {
					// Never resolves — the abort timer must fire.
				}),
		);
		const service = new EmailSenderService(createConfig({ emailTimeoutMs: 50, emailMaxAttempts: 1 }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("timeout");
		}
	});
});
