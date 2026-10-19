import type { Readable } from "node:stream";

import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { InMemoryObjectStorage, imageRenditionsFor, storedFile } from "../../../../../../test/support/file-lifecycle-fakes";
import { FixedClock } from "../../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { RequestContextService } from "../../../../../platform/infrastructure/context/request-context";
import { StreamChunkSchema, streamChunkToBuffer } from "../../../../../platform/infrastructure/storage/utils/object-stream.util";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../../../prisma/tenant-transaction.service";
import { FileDeletion } from "../../../application/commands/delete-file/file-deletion";
import { FileReferenceGuardRegistry } from "../../../application/ports/file-reference.port";
import { InMemoryStoredFiles, NOW, RecordingStorageTaskDispatcher, filesScope } from "../../../application/__tests__/fakes/files.fakes";
import { StoredFileAccess } from "../stored-file-access";
import { StorageFileObjectAdapter } from "../storage-file-object.adapter";

const CONTAINER = "local-private-bucket";
const FIRST_PATH = "rewards/first.webp";
const SECOND_PATH = "rewards/second.webp";

function setup(): { service: StoredFileAccess; storage: InMemoryObjectStorage } {
	const config = createTestTypedConfig({ STORAGE_PROVIDER: "local" });
	const prisma = new PrismaService(config);
	const storage = new InMemoryObjectStorage();
	const uow = new InMemoryUnitOfWork(filesScope(new InMemoryStoredFiles()));
	const service = new StoredFileAccess({
		config,
		prisma,
		transactions: new TenantTransactionService(prisma, new RequestContextService()),
		storage: new StorageFileObjectAdapter(config, storage, storage, imageRenditionsFor(storage)),
		objects: storage,
		dispatcher: new RecordingStorageTaskDispatcher(),
		deletion: new FileDeletion(uow, new FileReferenceGuardRegistry(), new FixedClock(NOW)),
	});
	return { service, storage };
}

async function collect(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(streamChunkToBuffer(StreamChunkSchema.parse(chunk)));
	}
	return Buffer.concat(chunks);
}

describe("StoredFileAccess", () => {
	it("archives the original uploads in the given order, numbered, under their sanitized names", async () => {
		const { service, storage } = setup();
		storage.put({ container: CONTAINER, path: FIRST_PATH }, Buffer.from("first image"));
		storage.put({ container: CONTAINER, path: SECOND_PATH }, Buffer.from("second image"));
		const files = [
			storedFile({ id: "11111111-1111-4111-8111-111111111111", status: "READY", storagePath: FIRST_PATH, originalName: "Brunch table.webp" }),
			storedFile({ id: "22222222-2222-4222-8222-222222222222", status: "READY", storagePath: SECOND_PATH, originalName: "../plating.webp" }),
		];

		const entries = unzipSync(await collect(service.createZipArchive(files)));

		expect(Object.keys(entries)).toEqual(["1-Brunch table.webp", "2-plating.webp"]);
		expect(strFromU8(entries["1-Brunch table.webp"] ?? new Uint8Array())).toBe("first image");
		expect(strFromU8(entries["2-plating.webp"] ?? new Uint8Array())).toBe("second image");
	});

	it("fails the archive stream when an object is missing from storage", async () => {
		const { service } = setup();

		await expect(collect(service.createZipArchive([storedFile({ status: "READY", storagePath: "rewards/missing.webp" })]))).rejects.toThrow(/is missing/u);
	});

	it("reads a READY file's bytes whole and refuses one that is not ready", async () => {
		const { service, storage } = setup();
		storage.put({ container: CONTAINER, path: FIRST_PATH }, Buffer.from("png"));

		await expect(service.readStoredBytes(storedFile({ status: "READY", storagePath: FIRST_PATH }), 1_024)).resolves.toEqual(Buffer.from("png"));
		await expect(service.readStoredBytes(storedFile({ status: "SCANNING" }), 1_024)).rejects.toMatchObject({ code: "FILE_NOT_READY" });
	});

	it("signs no download URL until the file is READY", async () => {
		await expect(setup().service.createDownloadUrl(storedFile({ status: "QUARANTINED" }))).resolves.toMatchObject({ downloadUrl: null });
	});
});
