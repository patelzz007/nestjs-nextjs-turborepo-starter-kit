import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TransactionLogFileWriter } from "../transaction-log-file-writer";
import { OCCURRED_AT } from "./transaction-log-fixtures";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("TransactionLogFileWriter", () => {
	let root: string;
	let directory: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "transaction-log-"));
		directory = join(root, "logs", "transactions");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("creates the folder on the first write and appends entries in the order they were handed in", async () => {
		const writer = new TransactionLogFileWriter({ directory, retentionDays: 30 });

		await Promise.all(["one\n\n", "two\n\n", "three\n\n"].map(async (text: string): Promise<void> => writer.append(OCCURRED_AT, text)));

		expect(await readFile(join(directory, "transactions-2026-10-26.txt"), "utf8")).toBe("one\n\ntwo\n\nthree\n\n");
	});

	it("starts a new file for each UTC day", async () => {
		const writer = new TransactionLogFileWriter({ directory, retentionDays: 30 });

		await writer.append(OCCURRED_AT, "today\n\n");
		await writer.append(OCCURRED_AT + MS_PER_DAY, "tomorrow\n\n");

		expect((await readdir(directory)).toSorted()).toEqual(["transactions-2026-10-26.txt", "transactions-2026-10-27.txt"]);
	});

	it("keeps writing after a failed write", async () => {
		// A file where the folder should be: every write fails until it is gone.
		await mkdir(join(root, "logs"), { recursive: true });
		await writeFile(directory, "not a folder");
		const writer = new TransactionLogFileWriter({ directory, retentionDays: 30 });

		await expect(writer.append(OCCURRED_AT, "lost\n\n")).rejects.toThrow();
		await rm(directory);
		await writer.append(OCCURRED_AT, "kept\n\n");

		expect(await readFile(join(directory, "transactions-2026-10-26.txt"), "utf8")).toBe("kept\n\n");
	});

	it("flush waits for every append handed in so far", async () => {
		const writer = new TransactionLogFileWriter({ directory, retentionDays: 30 });

		void writer.append(OCCURRED_AT, "pending\n\n");
		await writer.flush();

		expect(await readFile(join(directory, "transactions-2026-10-26.txt"), "utf8")).toBe("pending\n\n");
	});

	it("deletes only the day files past their retention, never another file", async () => {
		await mkdir(directory, { recursive: true });
		const names = ["transactions-2026-09-25.txt", "transactions-2026-09-26.txt", "transactions-2026-10-26.txt", "notes.txt"];
		await Promise.all(names.map(async (name: string): Promise<void> => writeFile(join(directory, name), "x")));
		const writer = new TransactionLogFileWriter({ directory, retentionDays: 30 });

		const result = await writer.purgeExpired(OCCURRED_AT);

		expect(result).toEqual({ cutoffDay: "2026-09-26", deletedFiles: ["transactions-2026-09-25.txt"] });
		expect((await readdir(directory)).toSorted()).toEqual(["notes.txt", "transactions-2026-09-26.txt", "transactions-2026-10-26.txt"]);
	});

	it("has nothing to purge before the first write", async () => {
		const writer = new TransactionLogFileWriter({ directory, retentionDays: 30 });

		await expect(writer.purgeExpired(OCCURRED_AT)).resolves.toEqual({ cutoffDay: "2026-09-26", deletedFiles: [] });
	});
});
