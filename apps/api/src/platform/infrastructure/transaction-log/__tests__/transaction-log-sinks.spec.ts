import { Logger } from "@nestjs/common";
import { QUEUE_JOB_OPTIONS, type TransactionLogWriteJob } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { firstLoggedFailure } from "../../../../../test/support/logged-failure";

import { DirectTransactionLog, standaloneTransactionLog } from "../direct-transaction-log";
import { QueuedTransactionLog, type TransactionLogQueue } from "../queued-transaction-log";
import { TransactionLogFileWriter } from "../transaction-log-file-writer";
import { formatTransactionLogEntry } from "../transaction-log-format";
import { TransactionLogWriteProcessor } from "../transaction-log-write.processor";
import { DisabledTransactionLog } from "../transaction-log.port";
import { auditEntry, OCCURRED_AT, TIME_ZONE, transactionLogConfig } from "./transaction-log-fixtures";

function fakeWriter(): { readonly writer: TransactionLogFileWriter; readonly append: MockInstance<TransactionLogFileWriter["append"]> } {
	const writer = new TransactionLogFileWriter(transactionLogConfig("unused"));
	const append = vi.spyOn(writer, "append").mockResolvedValue();
	return { writer, append };
}

function fakeQueue(): {
	readonly queue: TransactionLogQueue;
	readonly add: ReturnType<typeof vi.fn<TransactionLogQueue["add"]>>;
	readonly setGlobalConcurrency: ReturnType<typeof vi.fn<TransactionLogQueue["setGlobalConcurrency"]>>;
} {
	const add = vi.fn<TransactionLogQueue["add"]>();
	const setGlobalConcurrency = vi.fn<TransactionLogQueue["setGlobalConcurrency"]>().mockResolvedValue(1);
	return { queue: { add, setGlobalConcurrency }, add, setGlobalConcurrency };
}

describe("transaction log sinks", () => {
	let warn: MockInstance<Logger["warn"]>;
	let error: MockInstance<Logger["error"]>;

	beforeEach(() => {
		warn = vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
		error = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("QueuedTransactionLog", () => {
		it("allows one worker at a time across the cluster", () => {
			const { queue, setGlobalConcurrency } = fakeQueue();
			new QueuedTransactionLog(queue, fakeWriter().writer).onModuleInit();

			expect(setGlobalConcurrency).toHaveBeenCalledWith(1);
		});

		it("queues the formatted entry with the transactionLogWrite retry preset, without waiting for Redis or writing it itself", async () => {
			const { queue, add } = fakeQueue();
			add.mockReturnValue(new Promise((): void => undefined));
			const { writer, append } = fakeWriter();
			const entry = auditEntry();

			new QueuedTransactionLog(queue, writer).record(entry);
			await vi.waitFor(() => {
				expect(add).toHaveBeenCalledWith("append", { occurredAt: OCCURRED_AT, text: formatTransactionLogEntry(entry, TIME_ZONE) }, QUEUE_JOB_OPTIONS.transactionLogWrite);
			});
			expect(append).not.toHaveBeenCalled();
		});

		it("writes the entry directly when Redis cannot take the job, and says so", async () => {
			const { queue, add } = fakeQueue();
			add.mockRejectedValue(new Error("connection refused"));
			const { writer, append } = fakeWriter();
			const entry = auditEntry();

			new QueuedTransactionLog(queue, writer).record(entry);

			await vi.waitFor(() => {
				expect(append).toHaveBeenCalledWith(OCCURRED_AT, formatTransactionLogEntry(entry, TIME_ZONE));
			});
			expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: "transaction_log.enqueue_failed", correlationId: "corr-1", fallback: "direct_write" }));
		});
	});

	describe("DirectTransactionLog", () => {
		it("appends the formatted entry to the day file", () => {
			const { writer, append } = fakeWriter();
			const entry = auditEntry();

			new DirectTransactionLog(writer).record(entry);

			expect(append).toHaveBeenCalledWith(OCCURRED_AT, formatTransactionLogEntry(entry, TIME_ZONE));
		});

		it("logs a failed write instead of throwing", async () => {
			const { writer, append } = fakeWriter();
			append.mockRejectedValue(new Error("disk full"));

			expect(() => {
				new DirectTransactionLog(writer).record(auditEntry());
			}).not.toThrow();
			await vi.waitFor(() => {
				const logged = firstLoggedFailure(error);
				expect(logged).toMatchObject({ event: "transaction_log.write_failed", correlationId: "corr-1", error: "disk full" });
				expect(logged.stack).toContain("Error: disk full");
			});
		});
	});

	it("is off without a config (the CLI with TRANSACTION_LOG_ENABLED=false), and direct with one", () => {
		expect(standaloneTransactionLog(null)).toBeInstanceOf(DisabledTransactionLog);
		expect(standaloneTransactionLog(transactionLogConfig("logs/transactions"))).toBeInstanceOf(DirectTransactionLog);
	});

	describe("TransactionLogWriteProcessor", () => {
		it("appends a queued entry to its day file", async () => {
			const { writer, append } = fakeWriter();
			const job: TransactionLogWriteJob = { occurredAt: OCCURRED_AT, text: "entry\n\n" };

			await new TransactionLogWriteProcessor(writer).process({ data: job });

			expect(append).toHaveBeenCalledWith(OCCURRED_AT, "entry\n\n");
		});

		it("rejects a payload that is not a transaction log job, and a failed write (so BullMQ retries it)", async () => {
			const { writer, append } = fakeWriter();
			const processor = new TransactionLogWriteProcessor(writer);

			await expect(processor.process({ data: { occurredAt: OCCURRED_AT } })).rejects.toThrow();
			append.mockRejectedValue(new Error("disk full"));
			await expect(processor.process({ data: { occurredAt: OCCURRED_AT, text: "entry\n\n" } })).rejects.toThrow("disk full");
		});
	});
});
