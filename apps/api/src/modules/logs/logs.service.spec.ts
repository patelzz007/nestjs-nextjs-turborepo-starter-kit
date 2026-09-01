import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { LogService } from "./logs.service";

describe("LogService", () => {
	let service: LogService;

	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		service = new LogService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("info", () => {
		it("logs an info message", () => {
			const spy = vi.spyOn(service["logger"], "log");
			service.info("test message");
			expect(spy).toHaveBeenCalledWith("test message", "LogService");
		});

		it("logs with context option", () => {
			const spy = vi.spyOn(service["logger"], "log");
			service.info("test message", { context: "MyModule" });
			expect(spy).toHaveBeenCalledWith("test message", "MyModule");
		});

		it("logs with metadata", () => {
			const spy = vi.spyOn(service["logger"], "log");
			service.info("test message", { metadata: { userId: "123" } });
			expect(spy).toHaveBeenCalled();
		});
	});

	describe("warn", () => {
		it("logs a warning message", () => {
			const spy = vi.spyOn(service["logger"], "warn");
			service.warn("warning message");
			expect(spy).toHaveBeenCalledWith("warning message", "LogService");
		});

		it("logs with context option", () => {
			const spy = vi.spyOn(service["logger"], "warn");
			service.warn("warning message", { context: "AuthGuard" });
			expect(spy).toHaveBeenCalledWith("warning message", "AuthGuard");
		});
	});

	describe("error", () => {
		it("logs an error message", () => {
			const spy = vi.spyOn(service["logger"], "error");
			service.error("error message");
			expect(spy).toHaveBeenCalledWith("error message", undefined, "LogService");
		});

		it("logs with trace", () => {
			const spy = vi.spyOn(service["logger"], "error");
			service.error("error message", { trace: "Error stack" });
			expect(spy).toHaveBeenCalledWith("error message", "Error stack", "LogService");
		});

		it("logs with context option", () => {
			const spy = vi.spyOn(service["logger"], "error");
			service.error("error message", { context: "DatabaseService" });
			expect(spy).toHaveBeenCalledWith("error message", undefined, "DatabaseService");
		});
	});
});
