import { afterEach, describe, expect, it, vi } from "vitest";

import { createConsoleJsonLogger, formatLogLine } from "./logger";

describe("formatLogLine", () => {
	it("emits one JSON object with level, service and timestamp", () => {
		const line = formatLogLine("analytics-consumer", "warn", { event: "analytics.message_parked", reason: "MALFORMED_JSON" }, 1_000);

		expect(JSON.parse(line)).toEqual({ event: "analytics.message_parked", reason: "MALFORMED_JSON", level: "warn", service: "analytics-consumer", timestampEpochMs: 1_000 });
	});

	it("never lets an entry override the level or service", () => {
		const line = formatLogLine("analytics-consumer", "info", { level: "error", service: "spoofed" }, 1_000);

		expect(JSON.parse(line)).toMatchObject({ level: "info", service: "analytics-consumer" });
	});
});

describe("createConsoleJsonLogger", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("routes each level to the matching console stream", () => {
		const log = vi.spyOn(console, "log").mockImplementation((): void => undefined);
		const warn = vi.spyOn(console, "warn").mockImplementation((): void => undefined);
		const error = vi.spyOn(console, "error").mockImplementation((): void => undefined);
		const logger = createConsoleJsonLogger("svc", (): number => 5);

		logger.info({ event: "a" });
		logger.warn({ event: "b" });
		logger.error({ event: "c" });

		expect(log).toHaveBeenCalledWith(JSON.stringify({ event: "a", level: "info", service: "svc", timestampEpochMs: 5 }));
		expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: "b", level: "warn", service: "svc", timestampEpochMs: 5 }));
		expect(error).toHaveBeenCalledWith(JSON.stringify({ event: "c", level: "error", service: "svc", timestampEpochMs: 5 }));
	});
});
