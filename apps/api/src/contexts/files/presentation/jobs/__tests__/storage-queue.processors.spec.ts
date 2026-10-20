import type { Command } from "@nestjs/cqrs";
import { QUEUE_NAMES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { SystemCommandOrigin } from "../../../../../platform/application/ports/command-audit.port";
import type { SystemCommandDispatcher } from "../../../../../platform/application/system-command-dispatcher";
import { CleanUpStaleUploadsCommand } from "../../../application/commands/clean-up-stale-uploads/clean-up-stale-uploads.command";
import { InvalidateFileCdnCommand } from "../../../application/commands/invalidate-file-cdn/invalidate-file-cdn.command";
import { PurgeFileObjectCommand } from "../../../application/commands/purge-file-object/purge-file-object.command";
import { ScanFileCommand } from "../../../application/commands/scan-file/scan-file.command";
import { StorageCdnInvalidationProcessor, StorageCleanupProcessor, StorageDeleteProcessor, StorageScanProcessor } from "../storage-queue.processors";

const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";

/** Raised after the dispatch was recorded (or the job "fails"): BullMQ sees the rejection and retries. */
class JobFailed extends Error {}

/** Records each dispatch with its origin and rejects it, like a failing command would. */
class RecordingDispatcher implements Pick<SystemCommandDispatcher, "dispatch"> {
	public readonly dispatched: { readonly command: object; readonly origin: SystemCommandOrigin }[] = [];

	public dispatch<TResult>(command: Command<TResult>, origin: SystemCommandOrigin): Promise<TResult> {
		this.dispatched.push({ command, origin });
		return Promise.reject(new JobFailed());
	}
}

describe("storage queue processors", () => {
	it("dispatch their command with a system actor of the queue's operation, and rethrow a failure for BullMQ's retry", async () => {
		const dispatcher = new RecordingDispatcher();

		await expect(new StorageCleanupProcessor(dispatcher).process({ data: {} })).rejects.toBeInstanceOf(JobFailed);
		await expect(new StorageDeleteProcessor(dispatcher).process({ data: { fileId: FILE_ID, provider: "local", container: "c", path: "p" } })).rejects.toBeInstanceOf(
			JobFailed,
		);
		await expect(new StorageCdnInvalidationProcessor(dispatcher).process({ data: { fileId: FILE_ID, objectKeys: ["k"] } })).rejects.toBeInstanceOf(JobFailed);

		expect(dispatcher.dispatched.map(({ command, origin }) => [command.constructor, origin])).toEqual([
			[CleanUpStaleUploadsCommand, { kind: "job", name: QUEUE_NAMES.storageCleanup }],
			[PurgeFileObjectCommand, { kind: "job", name: QUEUE_NAMES.storageDelete }],
			[InvalidateFileCdnCommand, { kind: "job", name: QUEUE_NAMES.storageCdnInvalidate }],
		]);
		expect(dispatcher.dispatched.at(0)?.command).toMatchObject({ actor: { kind: "system", operation: "queue.storage.cleanup", origin: "job" } });
	});

	it.each([
		{ attemptsMade: 0, attempts: 3, finalAttempt: false },
		{ attemptsMade: 2, attempts: 3, finalAttempt: true },
		{ attemptsMade: 0, attempts: undefined, finalAttempt: true },
	])("marks the scan's final attempt (made $attemptsMade of $attempts → $finalAttempt)", async ({ attemptsMade, attempts, finalAttempt }) => {
		const dispatcher = new RecordingDispatcher();

		await expect(
			new StorageScanProcessor(dispatcher).process({ data: { fileId: FILE_ID }, attemptsMade, opts: attempts === undefined ? {} : { attempts } }),
		).rejects.toBeInstanceOf(JobFailed);

		const [dispatch] = dispatcher.dispatched;
		expect(dispatch?.command).toBeInstanceOf(ScanFileCommand);
		expect(dispatch?.command).toMatchObject({ fileId: FILE_ID, finalAttempt, actor: { operation: "files.scan_verdict.apply" } });
	});

	it("refuses a malformed job before dispatching anything", async () => {
		const dispatcher = new RecordingDispatcher();

		await expect(new StorageDeleteProcessor(dispatcher).process({ data: { fileId: "not-a-uuid" } })).rejects.toThrow();
		expect(dispatcher.dispatched).toEqual([]);
	});
});
