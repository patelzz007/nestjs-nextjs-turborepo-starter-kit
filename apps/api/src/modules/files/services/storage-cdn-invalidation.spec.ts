import { QUEUE_JOB_OPTIONS, type StorageCdnInvalidationJob, type StorageDeleteJob, type StorageScanJob } from "@workspace/shared";
import type { JobsOptions } from "bullmq";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import type { CdnCacheInvalidator, CdnInvalidationRequest } from "../../storage/domain/cdn-cache.port";
import { QueuedStorageTaskDispatcher, type StorageJobQueue } from "./queued-storage-task-dispatcher";
import { StorageCdnInvalidationProcessor } from "./storage-queue.processors";

const FILE_ID = "11111111-1111-4111-8111-111111111111";
const JOB: StorageCdnInvalidationJob = { fileId: FILE_ID, objectKeys: ["products/p/original/f.png"] };

/** Records what was enqueued instead of talking to Redis. */
class RecordingQueue<T> implements StorageJobQueue<T> {
	public readonly added: { readonly name: string; readonly data: T; readonly options: JobsOptions }[] = [];

	public add(name: string, data: T, options: JobsOptions): Promise<object> {
		this.added.push({ name, data, options });
		return Promise.resolve({});
	}
}

/** Fails the first `failures` calls (a CloudFront outage), then succeeds. */
class FlakyCdn implements CdnCacheInvalidator {
	public readonly requests: CdnInvalidationRequest[] = [];

	public constructor(private failures: number) {}

	public invalidate(request: CdnInvalidationRequest): Promise<void> {
		this.requests.push(request);
		if (this.failures > 0) {
			this.failures -= 1;
			return Promise.reject(new Error("CloudFront unavailable"));
		}
		return Promise.resolve();
	}
}

describe("QueuedStorageTaskDispatcher.dispatchCdnInvalidation", () => {
	it("only enqueues the purge (with the retry preset and a per-file job id) — the request never waits on the CDN", async () => {
		const cdnQueue = new RecordingQueue<StorageCdnInvalidationJob>();
		const dispatcher = new QueuedStorageTaskDispatcher(createTestTypedConfig(), new RecordingQueue<StorageScanJob>(), new RecordingQueue<StorageDeleteJob>(), cdnQueue);

		await dispatcher.dispatchCdnInvalidation(JOB);

		expect(cdnQueue.added).toEqual([
			{ name: "cdn-invalidate", data: JOB, options: { ...QUEUE_JOB_OPTIONS.storageCdnInvalidate, jobId: `storage-cdn-invalidate-${FILE_ID}` } },
		]);
	});

	it("retries with exponential backoff", () => {
		expect(QUEUE_JOB_OPTIONS.storageCdnInvalidate.attempts).toBeGreaterThan(1);
		expect(QUEUE_JOB_OPTIONS.storageCdnInvalidate.backoff.type).toBe("exponential");
	});
});

describe("StorageCdnInvalidationProcessor", () => {
	it("fails the attempt when the CDN rejects the purge (so BullMQ retries) and succeeds on the retry with the same reference", async () => {
		const cdn = new FlakyCdn(1);
		const processor = new StorageCdnInvalidationProcessor(cdn);

		await expect(processor.purge(JOB)).rejects.toThrow("CloudFront unavailable");
		await expect(processor.purge(JOB)).resolves.toBeUndefined();

		expect(cdn.requests).toHaveLength(2);
		expect(cdn.requests[0]).toEqual(cdn.requests[1]);
		expect(cdn.requests[0]?.objectKeys).toEqual(JOB.objectKeys);
	});
});
