import { QUEUE_JOB_OPTIONS, type StorageCdnInvalidationJob, type StorageDeleteJob, type StorageScanJob } from "@workspace/shared";
import type { JobsOptions } from "bullmq";
import { describe, expect, it } from "vitest";

import { physicalDeleteJobId, QueuedStorageTaskDispatcher, type StorageJobQueue } from "../queued-storage-task-dispatcher";

const FILE_ID = "11111111-1111-4111-8111-111111111111";
const DELAY_MS = 86_400_000;

/** Records what was enqueued instead of talking to Redis; a repeated job id is deduplicated like BullMQ does. */
class RecordingQueue<T> implements StorageJobQueue<T> {
	public readonly added: { readonly name: string; readonly data: T; readonly options: JobsOptions }[] = [];

	public add(name: string, data: T, options: JobsOptions): Promise<object> {
		if (!this.added.some((job) => job.options.jobId === options.jobId)) {
			this.added.push({ name, data, options });
		}
		return Promise.resolve({});
	}
}

function setup(): {
	dispatcher: QueuedStorageTaskDispatcher;
	scans: RecordingQueue<StorageScanJob>;
	deletes: RecordingQueue<StorageDeleteJob>;
	cdn: RecordingQueue<StorageCdnInvalidationJob>;
} {
	const scans = new RecordingQueue<StorageScanJob>();
	const deletes = new RecordingQueue<StorageDeleteJob>();
	const cdn = new RecordingQueue<StorageCdnInvalidationJob>();
	return { dispatcher: new QueuedStorageTaskDispatcher(DELAY_MS, scans, deletes, cdn), scans, deletes, cdn };
}

describe("QueuedStorageTaskDispatcher", () => {
	it("only enqueues the CDN purge (retry preset, per-file job id) — the request never waits on the CDN", async () => {
		const { dispatcher, cdn } = setup();
		const job: StorageCdnInvalidationJob = { fileId: FILE_ID, objectKeys: ["products/p/original/f.png"] };

		await dispatcher.dispatchCdnInvalidation(job);

		expect(cdn.added).toEqual([{ name: "cdn-invalidate", data: job, options: { ...QUEUE_JOB_OPTIONS.storageCdnInvalidate, jobId: `storage-cdn-invalidate-${FILE_ID}` } }]);
		expect(QUEUE_JOB_OPTIONS.storageCdnInvalidate.backoff.type).toBe("exponential");
	});

	it("keeps the original's historical delete job id and gives every rendition its own, so none is deduplicated away", async () => {
		const { dispatcher, deletes } = setup();
		const original: StorageDeleteJob = { fileId: FILE_ID, provider: "local", container: "c", path: "products/p/original/f.png" };
		const thumbnail: StorageDeleteJob = { ...original, path: "products/p/thumbnail/f.webp" };

		await dispatcher.dispatchPhysicalDelete(original, "ORIGINAL");
		await dispatcher.dispatchPhysicalDelete(thumbnail, "THUMBNAIL");
		await dispatcher.dispatchPhysicalDelete(original, "ORIGINAL");

		expect(deletes.added.map((job) => [job.options.jobId, job.options.delay, job.data.path])).toEqual([
			[`storage-delete-${FILE_ID}`, DELAY_MS, original.path],
			[`storage-delete-${FILE_ID}-thumbnail`, DELAY_MS, thumbnail.path],
		]);
		expect(physicalDeleteJobId(FILE_ID, "UHD")).toBe(`storage-delete-${FILE_ID}-uhd`);
	});

	it("dedupes a scan by file and gives a re-dispatch a fresh id", async () => {
		const { dispatcher, scans } = setup();

		await dispatcher.dispatchScan(FILE_ID);
		await dispatcher.dispatchScan(FILE_ID);
		await dispatcher.redispatchScan(FILE_ID);

		expect(scans.added.map((job) => job.options.jobId)).toEqual([
			`storage-scan-${FILE_ID}`,
			expect.stringMatching(new RegExp(`^storage-scan-${FILE_ID}-redispatch-\\d+$`, "u")),
		]);
	});
});
