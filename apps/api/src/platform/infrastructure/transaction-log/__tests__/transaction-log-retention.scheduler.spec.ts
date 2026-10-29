import { Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { firstLoggedFailure } from "../../../../../test/support/logged-failure";

import { TransactionLogFileWriter } from "../transaction-log-file-writer";
import { TransactionLogRetentionScheduler } from "../transaction-log-retention.scheduler";
import { transactionLogConfig } from "./transaction-log-fixtures";

describe("TransactionLogRetentionScheduler", () => {
	let log: MockInstance<Logger["log"]>;
	let error: MockInstance<Logger["error"]>;

	beforeEach(() => {
		log = vi.spyOn(Logger.prototype, "log").mockImplementation((): void => undefined);
		error = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function scheduler(): {
		readonly scheduler: TransactionLogRetentionScheduler;
		readonly registry: SchedulerRegistry;
		readonly purge: MockInstance<TransactionLogFileWriter["purgeExpired"]>;
	} {
		const writer = new TransactionLogFileWriter(transactionLogConfig("unused"));
		const purge = vi.spyOn(writer, "purgeExpired").mockResolvedValue({ cutoffDay: "2026-09-26", deletedFiles: [] });
		const registry = new SchedulerRegistry();
		return { scheduler: new TransactionLogRetentionScheduler(registry, writer), registry, purge };
	}

	it("purges at boot, registers the hourly interval, and removes it on shutdown", () => {
		const { scheduler: retention, registry, purge } = scheduler();

		retention.onModuleInit();
		expect(purge).toHaveBeenCalledTimes(1);
		expect(registry.doesExist("interval", "transaction-log-retention")).toBe(true);

		retention.onApplicationShutdown();
		expect(registry.doesExist("interval", "transaction-log-retention")).toBe(false);
	});

	it("logs what a run deleted, and stays quiet when there was nothing to delete", async () => {
		const { scheduler: retention, purge } = scheduler();

		await expect(retention.runOnce()).resolves.toEqual({ cutoffDay: "2026-09-26", deletedFiles: [] });
		expect(log).not.toHaveBeenCalled();

		purge.mockResolvedValue({ cutoffDay: "2026-09-26", deletedFiles: ["transactions-2026-09-25.txt"] });
		await retention.runOnce();
		expect(log).toHaveBeenCalledWith({ event: "transaction_log.retention_summary", cutoffDay: "2026-09-26", deletedFiles: ["transactions-2026-09-25.txt"] });
	});

	it("never rejects: a failed run is logged and the next tick retries", async () => {
		const { scheduler: retention, purge } = scheduler();
		purge.mockRejectedValue(new Error("EACCES"));

		await expect(retention.runOnce()).resolves.toBeNull();
		const logged = firstLoggedFailure(error);
		expect(logged).toMatchObject({ event: "transaction_log.retention_failed", error: "EACCES" });
		expect(logged.stack).toContain("Error: EACCES");
	});
});
