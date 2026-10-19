import { describe, expect, it } from "vitest";

import { FileDeleted, type DeletedFileObject } from "../../domain/events/file-deleted.event";
import { PurgeDeletedFileObjectsHandler } from "../event-handlers/after-commit/purge-deleted-file-objects.event-handler";
import { FILE_ID, FakeFileObjectStorage, NOW, ORG_ID, RecordingStorageTaskDispatcher, UPLOADER_ID, locator } from "./fakes/files.fakes";

const ORIGINAL: DeletedFileObject = { slot: "ORIGINAL", locator: locator("products/p/original/f.png"), published: true };
const THUMBNAIL: DeletedFileObject = { slot: "THUMBNAIL", locator: locator("products/p/thumbnail/f.webp"), published: true };
const PRIVATE: DeletedFileObject = { slot: "ORIGINAL", locator: locator("kyb/o/f.pdf"), published: false };

function deleted(...objects: DeletedFileObject[]): FileDeleted {
	return new FileDeleted(NOW, FILE_ID, "PRODUCT_IMAGE", ORG_ID, UPLOADER_ID, objects);
}

describe("PurgeDeletedFileObjectsHandler (after commit)", () => {
	it("withdraws each published copy now, then dispatches one delayed physical delete per stored copy (distinct slots)", async () => {
		const storage = new FakeFileObjectStorage();
		const dispatcher = new RecordingStorageTaskDispatcher();

		await new PurgeDeletedFileObjectsHandler(storage, dispatcher).handle(deleted(ORIGINAL, THUMBNAIL));

		expect(storage.withdrawn).toEqual([ORIGINAL.locator.path, THUMBNAIL.locator.path]);
		expect(dispatcher.deletes.map((entry) => [entry.slot, entry.job.path])).toEqual([
			["ORIGINAL", ORIGINAL.locator.path],
			["THUMBNAIL", THUMBNAIL.locator.path],
		]);
		expect(dispatcher.cdnInvalidations).toEqual([]);
	});

	it("hands every key the CDN may still cache to ONE purge for the file", async () => {
		const storage = new FakeFileObjectStorage();
		storage.cachedKeys.set(ORIGINAL.locator.path, [ORIGINAL.locator.path]);
		storage.cachedKeys.set(THUMBNAIL.locator.path, [THUMBNAIL.locator.path]);
		const dispatcher = new RecordingStorageTaskDispatcher();

		await new PurgeDeletedFileObjectsHandler(storage, dispatcher).handle(deleted(ORIGINAL, THUMBNAIL));

		expect(dispatcher.cdnInvalidations).toEqual([{ fileId: FILE_ID, objectKeys: [ORIGINAL.locator.path, THUMBNAIL.locator.path] }]);
	});

	it("withdraws nothing for a private file but still purges its bytes", async () => {
		const storage = new FakeFileObjectStorage();
		const dispatcher = new RecordingStorageTaskDispatcher();

		await new PurgeDeletedFileObjectsHandler(storage, dispatcher).handle(deleted(PRIVATE));

		expect(storage.withdrawn).toEqual([]);
		expect(dispatcher.deletes).toHaveLength(1);
	});

	it("logs and swallows a failure: the deletion already committed (best effort, §5.6)", async () => {
		const storage = new FakeFileObjectStorage();
		storage.failWithdrawal = true;
		const dispatcher = new RecordingStorageTaskDispatcher();

		await expect(new PurgeDeletedFileObjectsHandler(storage, dispatcher).handle(deleted(ORIGINAL))).resolves.toBeUndefined();
		expect(dispatcher.deletes).toEqual([]);
	});
});
