import { Test } from "@nestjs/testing";
import type { StoredFile } from "@prisma/client";
import { FILE_CATEGORY_POLICIES } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import { OBJECT_STORAGE } from "../../storage/domain/storage.tokens";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileService } from "./file.service";
import { STORAGE_CLEANUP_ACTOR, StorageCleanupProcessor } from "./storage-queue.processors";
import { StorageTaskDispatcher } from "./storage-task-dispatcher";

function storedFile(id: string): StoredFile {
	return {
		id,
		category: "GITHUB_COMMENT_IMAGE",
		visibility: "PRIVATE",
		originalName: "shot.png",
		mimeType: "image/png",
		sizeBytes: 4,
		expectedChecksum: "a".repeat(64),
		actualChecksum: null,
		storageProvider: null,
		storageContainer: null,
		objectRevision: null,
		storageBucket: "private",
		storagePath: `users/user-1/github-comment-images/${id}.png`,
		publicPath: null,
		objectGeneration: null,
		imageWidth: null,
		imageHeight: null,
		status: "READY",
		scanStatus: "CLEAN",
		scannedAt: null,
		scanResult: null,
		uploadedById: "user-1",
		productId: null,
		deletedBy: null,
		organizationId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: 0n,
		updatedAt: 0n,
	};
}

async function setup(expired: readonly StoredFile[]): Promise<{
	processor: StorageCleanupProcessor;
	listExpiredStaging: ReturnType<typeof vi.fn<StoredFileRepository["listExpiredStaging"]>>;
	deleteStoredFile: ReturnType<typeof vi.fn<FileService["deleteStoredFile"]>>;
}> {
	const listExpiredStaging = vi.fn<StoredFileRepository["listExpiredStaging"]>(() => Promise.resolve([...expired]));
	const deleteStoredFile = vi.fn<FileService["deleteStoredFile"]>(() => Promise.resolve());
	const moduleRef = await Test.createTestingModule({
		providers: [
			StorageCleanupProcessor,
			{
				provide: StoredFileRepository,
				useValue: {
					listStalePending: vi.fn<StoredFileRepository["listStalePending"]>(() => Promise.resolve([])),
					listStaleAwaitingVerdict: vi.fn<StoredFileRepository["listStaleAwaitingVerdict"]>(() => Promise.resolve([])),
					listExpiredStaging,
				},
			},
			{ provide: StorageTaskDispatcher, useValue: { redispatchScan: vi.fn<StorageTaskDispatcher["redispatchScan"]>() } },
			{ provide: OBJECT_STORAGE, useValue: { deleteObject: vi.fn<ObjectStorage["deleteObject"]>() } },
			{ provide: FileService, useValue: { deleteStoredFile } },
		],
	}).compile();
	return { processor: moduleRef.get(StorageCleanupProcessor), listExpiredStaging, deleteStoredFile };
}

describe("StorageCleanupProcessor — staging copies", () => {
	it("deletes READY staging copies nothing consumed within their category's retention (a comment picture never posted)", async () => {
		const { processor, listExpiredStaging, deleteStoredFile } = await setup([storedFile("file-1"), storedFile("file-2")]);

		await processor.process({ data: {} });

		expect(listExpiredStaging.mock.calls).toEqual([["GITHUB_COMMENT_IMAGE", FILE_CATEGORY_POLICIES.GITHUB_COMMENT_IMAGE.stagingRetentionMs]]);
		expect(deleteStoredFile.mock.calls).toEqual([
			[expect.objectContaining({ id: "file-1" }), STORAGE_CLEANUP_ACTOR],
			[expect.objectContaining({ id: "file-2" }), STORAGE_CLEANUP_ACTOR],
		]);
	});

	it("keeps going past one copy it cannot delete — the next sweep tries it again", async () => {
		const { processor, deleteStoredFile } = await setup([storedFile("file-1"), storedFile("file-2")]);
		deleteStoredFile.mockRejectedValueOnce(new Error("storage down"));

		await expect(processor.process({ data: {} })).resolves.toBeUndefined();
		expect(deleteStoredFile).toHaveBeenCalledTimes(2);
	});
});
