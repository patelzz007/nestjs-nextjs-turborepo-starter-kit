import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { OnApplicationShutdown } from "@nestjs/common";

import type { TransactionLogConfig } from "../../../config/api-config.schema";
import { resolveFromWorkspaceRoot } from "../utils/workspace-root";
import type { HttpAuditEntry } from "../audit/http-audit-entry";
import { formatTransactionLogEntry, localDayOf, transactionLogFileDay, transactionLogFileName } from "./transaction-log-format";

/** 24 hours: the retention counts back this far per day, then takes the day it lands on in the log's zone. */
const MS_PER_DAY: number = 24 * 60 * 60 * 1000;

/** Node's error for a missing file or folder. */
const NOT_FOUND_CODE = "ENOENT";

function isNotFound(error: Error): boolean {
	return "code" in error && error.code === NOT_FOUND_CODE;
}

/** What one retention run removed. */
export interface TransactionLogPurgeResult {
	/** Day files older than this day (in the log's time zone) were deleted. */
	readonly cutoffDay: string;
	readonly deletedFiles: readonly string[];
}

/**
 * Appends formatted transactions to the day file under the configured folder
 * (a relative folder is taken from the monorepo root: `<repo>/logs/transactions`),
 * and deletes day files past their retention. All I/O is asynchronous (libuv's
 * thread pool), so no request thread ever waits on the disk.
 *
 * Appends from this process are chained: each starts once the one before it
 * settled, so entries land whole and in the order they were handed in, never
 * interleaved. Every entry is a single `appendFile` (O_APPEND) call. The folder
 * is created on the first write that finds it missing.
 *
 * Built by `TransactionLogModule` from the validated config (a factory
 * provider), and by hand where there is no Nest container (the CLI bootstrap).
 */
export class TransactionLogFileWriter implements OnApplicationShutdown {
	private readonly directory: string;
	private tail: Promise<void> = Promise.resolve();

	public constructor(private readonly config: TransactionLogConfig) {
		this.directory = resolveFromWorkspaceRoot(config.directory, process.cwd());
	}

	/** `entry` as the text of one log entry, its time read in the log's time zone (TRANSACTION_LOG_TIME_ZONE). */
	public format(entry: HttpAuditEntry): string {
		return formatTransactionLogEntry(entry, this.config.timeZone);
	}

	/** Appends `text` to the day file of `occurredAt` (its day in the log's time zone). Rejects when the write failed; later appends still run. */
	public append(occurredAt: number, text: string): Promise<void> {
		const file: string = join(this.directory, transactionLogFileName(occurredAt, this.config.timeZone));
		const write: Promise<void> = this.tail.then(async (): Promise<void> => this.write(file, text));
		this.tail = write.catch((): void => undefined);
		return write;
	}

	/** Resolves once every append handed in so far has settled. */
	public flush(): Promise<void> {
		return this.tail;
	}

	/** Deletes the day files older than the retention allows, counted back from `nowEpochMs`. Other files in the folder are never touched. */
	public async purgeExpired(nowEpochMs: number): Promise<TransactionLogPurgeResult> {
		const cutoffDay: string = localDayOf(nowEpochMs - this.config.retentionDays * MS_PER_DAY, this.config.timeZone);
		const names: string[] = await this.fileNames();
		const expired: string[] = names.filter((name: string): boolean => {
			const day: string | null = transactionLogFileDay(name);
			return day !== null && day < cutoffDay;
		});
		// `force`: another instance sharing the folder may have deleted the same file first.
		await Promise.all(expired.map(async (name: string): Promise<void> => rm(join(this.directory, name), { force: true })));
		return { cutoffDay, deletedFiles: expired };
	}

	public async onApplicationShutdown(): Promise<void> {
		await this.flush();
	}

	private async write(file: string, text: string): Promise<void> {
		try {
			await appendFile(file, text, "utf8");
		} catch (error) {
			if (!(error instanceof Error) || !isNotFound(error)) {
				throw error;
			}
			await mkdir(this.directory, { recursive: true });
			await appendFile(file, text, "utf8");
		}
	}

	private async fileNames(): Promise<string[]> {
		try {
			return await readdir(this.directory);
		} catch (error) {
			// Nothing written yet: nothing to purge.
			if (error instanceof Error && isNotFound(error)) {
				return [];
			}
			throw error;
		}
	}
}
