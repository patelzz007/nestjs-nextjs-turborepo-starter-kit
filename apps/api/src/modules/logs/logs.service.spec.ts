import { Logger } from "@nestjs/common";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { LogService } from "./logs.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { RequestContextService } from "../../common/context/request-context";

describe("LogService", () => {
	let service: LogService;

	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		service = new LogService(createTestTypedConfig(), new RequestContextService());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("info", () => {
		it("logs an info message", () => {
			const spy = vi.spyOn(Logger.prototype, "log");
			service.info("test message");
			expect(spy).toHaveBeenCalledWith("test message", "LogService");
		});

		it("logs with context option", () => {
			const spy = vi.spyOn(Logger.prototype, "log");
			service.info("test message", { context: "MyModule" });
			expect(spy).toHaveBeenCalledWith("test message", "MyModule");
		});

		it("logs with metadata", () => {
			const spy = vi.spyOn(Logger.prototype, "log");
			service.info("test message", { metadata: { userId: "123" } });
			expect(spy).toHaveBeenCalledWith('test message | {"userId":"123"}', "LogService");
		});

		it("redacts sensitive metadata values whatever the key casing", () => {
			const spy = vi.spyOn(Logger.prototype, "log");
			service.info("login attempt", { metadata: { email: "a@example.com", Password: "hunter2", access_token: "tok", code: "123456", attempts: 2 } });
			expect(spy).toHaveBeenCalledWith(
				'login attempt | {"email":"a@example.com","Password":"[REDACTED]","access_token":"[REDACTED]","code":"[REDACTED]","attempts":2}',
				"LogService",
			);
		});
	});

	describe("warn", () => {
		it("logs a warning message", () => {
			const spy = vi.spyOn(Logger.prototype, "warn");
			service.warn("warning message");
			expect(spy).toHaveBeenCalledWith("warning message", "LogService");
		});

		it("logs with context option", () => {
			const spy = vi.spyOn(Logger.prototype, "warn");
			service.warn("warning message", { context: "AuthGuard" });
			expect(spy).toHaveBeenCalledWith("warning message", "AuthGuard");
		});
	});

	describe("error", () => {
		it("logs an error message", () => {
			const spy = vi.spyOn(Logger.prototype, "error");
			service.error("error message");
			expect(spy).toHaveBeenCalledWith("error message", undefined, "LogService");
		});

		it("logs with trace", () => {
			const spy = vi.spyOn(Logger.prototype, "error");
			service.error("error message", { trace: "Error stack" });
			expect(spy).toHaveBeenCalledWith("error message", "Error stack", "LogService");
		});

		it("redacts sensitive metadata on error lines too", () => {
			const spy = vi.spyOn(Logger.prototype, "error");
			service.error("webhook failed", { metadata: { secret: "whsec_123", status: 500 } });
			expect(spy).toHaveBeenCalledWith('webhook failed | {"secret":"[REDACTED]","status":500}', undefined, "LogService");
		});

		it("logs with context option", () => {
			const spy = vi.spyOn(Logger.prototype, "error");
			service.error("error message", { context: "DatabaseService" });
			expect(spy).toHaveBeenCalledWith("error message", undefined, "DatabaseService");
		});
	});

	describe("request context (ADR 017)", () => {
		const requestContext = new RequestContextService();

		function contextualService(): LogService {
			return new LogService(createTestTypedConfig(), requestContext);
		}

		it("stamps the correlation id on every line written inside a request", () => {
			const logger = contextualService();
			const spy = vi.spyOn(Logger.prototype, "log");

			requestContext.run({ correlationId: "corr-log-1", ip: "127.0.0.1", userAgent: "vitest" }, () => {
				logger.info("order created");
			});

			expect(spy).toHaveBeenCalledWith('order created | {"correlationId":"corr-log-1"}', "LogService");
		});

		it("adds the principal and verified tenant once they are bound, before the caller's metadata", () => {
			const logger = contextualService();
			const spy = vi.spyOn(Logger.prototype, "warn");

			requestContext.run({ correlationId: "corr-log-2", ip: undefined, userAgent: undefined }, () => {
				requestContext.bindPrincipal({ userId: "user-7", impersonatorId: "admin-1" });
				requestContext.bindTenant({ organizationId: "org-9" });
				logger.warn("quota near limit", { metadata: { remaining: 3 } });
			});

			expect(spy).toHaveBeenCalledWith(
				'quota near limit | {"correlationId":"corr-log-2","userId":"user-7","impersonatorId":"admin-1","organizationId":"org-9","remaining":3}',
				"LogService",
			);
		});

		it("lets an explicit userId option override the context principal", () => {
			const logger = contextualService();
			const spy = vi.spyOn(Logger.prototype, "log");

			requestContext.run({ correlationId: "corr-log-3", ip: undefined, userAgent: undefined }, () => {
				requestContext.bindPrincipal({ userId: "user-7", impersonatorId: undefined });
				logger.info("acting for", { userId: "user-8" });
			});

			expect(spy).toHaveBeenCalledWith('acting for | {"correlationId":"corr-log-3","userId":"user-8"}', "LogService");
		});

		it("adds nothing outside a request (boot, cron, workers)", () => {
			const logger = contextualService();
			const spy = vi.spyOn(Logger.prototype, "log");

			logger.info("boot complete");

			expect(spy).toHaveBeenCalledWith("boot complete", "LogService");
		});
	});

	describe("memory monitoring", () => {
		// Observed through the public surface: monitoring announces its start,
		// and stopMemoryMonitoring() only reports a stop when it was running.
		const STARTED = "Starting memory monitoring for leak detection";
		const STOPPED = "Memory monitoring stopped";

		it("stays off outside production unless MEMORY_MONITORING=true", () => {
			const spy = vi.spyOn(Logger.prototype, "log");
			const logger = new LogService(createTestTypedConfig(), new RequestContextService());
			logger.stopMemoryMonitoring();
			expect(spy).not.toHaveBeenCalledWith(STARTED);
			expect(spy).not.toHaveBeenCalledWith(STOPPED);
		});

		it("starts when MEMORY_MONITORING=true", () => {
			const spy = vi.spyOn(Logger.prototype, "log");
			const logger = new LogService(createTestTypedConfig({ MEMORY_MONITORING: "true" }), new RequestContextService());
			try {
				expect(spy).toHaveBeenCalledWith(STARTED);
			} finally {
				logger.stopMemoryMonitoring();
			}
			expect(spy).toHaveBeenCalledWith(STOPPED);
		});
	});
});
