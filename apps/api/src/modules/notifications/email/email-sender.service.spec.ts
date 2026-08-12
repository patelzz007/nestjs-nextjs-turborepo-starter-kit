import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TypedConfigService } from "../../../config/typed-config.service.js";
import type { LogService } from "../../logs/logs.service.js";
import type { EmailLogService } from "./email-log.service.js";
import { EmailSenderService } from "./email-sender.service.js";
import { VerificationEmailTemplate } from "./templates/verification-email.template.js";

// ── Mocks ─────────────────────────────────────────────────────────────────

const resendSendMock = vi.fn();

vi.mock("resend", () => {
	class MockResend {
		public readonly emails = { send: resendSendMock };
		public readonly webhooks = { verify: vi.fn() };
	}
	return { Resend: MockResend };
});

function createConfig(overrides: Partial<Record<string, unknown>> = {}): TypedConfigService {
	const base = {
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
	return { ...base, ...overrides } as TypedConfigService;
}

const logServiceMock = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
} as unknown as LogService;

const emailLogServiceMock = {
	create: vi.fn().mockResolvedValue({ id: "log-1" }),
	updateStatusByResendId: vi.fn().mockResolvedValue("updated"),
} as unknown as EmailLogService;

function makeTemplate(): VerificationEmailTemplate {
	return new VerificationEmailTemplate({ to: "jamie@example.com", verificationToken: "tok-123", expiresInHours: 24 });
}

describe("EmailSenderService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns invalid-props without calling Resend when props are malformed", async () => {
		const service = new EmailSenderService(createConfig(), logServiceMock, emailLogServiceMock);
		const template = new VerificationEmailTemplate({ to: "not-an-email", verificationToken: "tok" });
		const result = await service.send(template);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("invalid-props");
		}
		expect(resendSendMock).not.toHaveBeenCalled();
	});

	it("noop mode never touches the network but persists a row", async () => {
		const service = new EmailSenderService(createConfig({ emailMode: "noop" }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.mode).toBe("noop");
		}
		expect(resendSendMock).not.toHaveBeenCalled();
		expect(emailLogServiceMock.create).toHaveBeenCalledTimes(1);
	});

	it("log-only mode prints the rendered text and returns ok", async () => {
		const service = new EmailSenderService(createConfig({ emailMode: "log-only" }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.mode).toBe("log-only");
		}
		expect(resendSendMock).not.toHaveBeenCalled();
		expect(logServiceMock.info).toHaveBeenCalled();
	});

	it("applies the EMAIL_TEST_TO override in send mode", async () => {
		resendSendMock.mockResolvedValueOnce({ data: { id: "re-1" }, error: null, headers: null });
		const service = new EmailSenderService(createConfig({ emailTestTo: "qa@example.com" }), logServiceMock, emailLogServiceMock);
		const result = await service.send(makeTemplate());
		expect(result.ok).toBe(true);
		const sentPayload = resendSendMock.mock.calls[0]?.[0] as { readonly to: string };
		expect(sentPayload.to).toBe("qa@example.com");
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
		expect(emailLogServiceMock.create).toHaveBeenCalledWith(
			expect.objectContaining({
				templateKey: "verification",
				status: "sent",
				resendId: "re-42",
			}),
		);
		// The rendered HTML must NOT contain any tracking pixel (tracking removed).
		const sentPayload = resendSendMock.mock.calls[0]?.[0] as { readonly html: string };
		expect(sentPayload.html).not.toContain("/notifications/tracking/open");
	});

	it("retries transient failures and succeeds on a later attempt", async () => {
		resendSendMock
			.mockRejectedValueOnce({ code: "internal_server_error", message: "boom" })
			.mockResolvedValueOnce({ data: { id: "re-7" }, error: null, headers: null });
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
			(): Promise<never> =>
				new Promise((_resolve: (value: never) => void) => {
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
