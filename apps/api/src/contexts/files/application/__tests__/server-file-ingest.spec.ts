import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import type { FileProcessingResult } from "@workspace/shared";

import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { FileMimeTypeNotAllowedError } from "../../domain/errors/files.errors";
import type { FilesScope } from "../files-scope";
import type { ServerUploadWrite } from "../ports/file-object-storage.port";
import type { FileProcessingPort, VerdictOutcome } from "../ports/file-processing.port";
import { ServerFileIngest, ServerFileIngestFailedError, type ServerFileIngestRequest } from "../services/server-file-ingest";
import { FakeFileObjectStorage, InMemoryStoredFileReads, InMemoryStoredFiles, ORG_ID, UPLOADER_ID, filesScope, userActor } from "./fakes/files.fakes";

const PICTURE: Buffer = Buffer.from("server-made picture bytes");
const OTHER_PICTURE: Buffer = Buffer.from("another server-made picture");

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function pictureRequest(bytes: Buffer = PICTURE): ServerFileIngestRequest {
	return { upload: { category: "REWARD_IMAGE", tenantId: ORG_ID, fileName: "load-test-reward.png", mimeType: "image/png" }, uploadedById: UPLOADER_ID, bytes };
}

/** A unit of work that says whether a transaction is open right now (object storage must never be written inside one). */
class TrackedUnitOfWork implements UnitOfWork<FilesScope> {
	public open = false;

	public constructor(public readonly inner: InMemoryUnitOfWork<FilesScope>) {}

	public run<TResult>(actor: ActorContext, work: (scope: FilesScope) => Promise<TResult>): Promise<TResult> {
		return this.track(() => this.inner.run(actor, work));
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, actor: ActorContext, work: (scope: FilesScope) => Promise<TResult>): Promise<TResult> {
		return this.track(() => this.inner.runSystemOperation(operation, actor, work));
	}

	private async track<TResult>(work: () => Promise<TResult>): Promise<TResult> {
		this.open = true;
		try {
			return await work();
		} finally {
			this.open = false;
		}
	}
}

/** Records each write together with whether a transaction was open while it happened. */
class TransactionAwareStorage extends FakeFileObjectStorage {
	public readonly writtenInsideTransaction: boolean[] = [];

	public constructor(private readonly uow: TrackedUnitOfWork) {
		super();
	}

	public override writeServerUpload(write: ServerUploadWrite): Promise<void> {
		this.writtenInsideTransaction.push(this.uow.open);
		return super.writeServerUpload(write);
	}
}

/** The scan pipeline: answers `outcome` and, for a verdict, moves the row as the real verdict transaction does. */
class ScriptedScanPipeline implements FileProcessingPort {
	public readonly scans: { readonly fileId: string; readonly finalAttempt: boolean }[] = [];
	public outcome: VerdictOutcome = "READY";

	public constructor(private readonly files: InMemoryStoredFiles) {}

	public scan(_actor: ActorContext, fileId: string, finalAttempt: boolean): Promise<VerdictOutcome> {
		this.scans.push({ fileId, finalAttempt });
		if (this.outcome === "READY" || this.outcome === "QUARANTINED" || this.outcome === "FAILED") {
			this.files.decide(fileId, this.outcome);
		}
		return Promise.resolve(this.outcome);
	}

	public applyProcessingResult(_actor: ActorContext, _result: FileProcessingResult): Promise<void> {
		return Promise.reject(new Error("a server ingest never receives a processing callback"));
	}
}

interface Fixture {
	readonly ingest: ServerFileIngest;
	readonly files: InMemoryStoredFiles;
	readonly uow: TrackedUnitOfWork;
	readonly storage: TransactionAwareStorage;
	readonly scanner: ScriptedScanPipeline;
}

function setup(): Fixture {
	const files = new InMemoryStoredFiles();
	const uow = new TrackedUnitOfWork(new InMemoryUnitOfWork(filesScope(files)));
	const storage = new TransactionAwareStorage(uow);
	const scanner = new ScriptedScanPipeline(files);
	return { ingest: new ServerFileIngest(uow, new InMemoryStoredFileReads(files), storage, scanner), files, uow, storage, scanner };
}

describe("ServerFileIngest", () => {
	it("records the file as an upload request would, writes the bytes outside any transaction, verifies and claims them, and scans inline to READY", async () => {
		const { ingest, files, uow, storage, scanner } = setup();

		const fileId = await ingest.ingest(userActor(), pictureRequest());

		const [added] = files.added;
		expect(added?.id).toBe(fileId);
		expect(added?.category).toBe("REWARD_IMAGE");
		expect(added?.visibility).toBe("PUBLIC");
		expect(added?.tenantId).toBe(ORG_ID);
		expect(added?.uploadedById).toBe(UPLOADER_ID);
		expect(files.uploads.get(fileId)).toEqual({ originalName: "load-test-reward.png", mimeType: "image/png", sizeBytes: PICTURE.length, expectedChecksum: sha256(PICTURE) });
		expect(storage.serverWrites.map((write) => ({ fileId: write.fileId, path: write.locator.path, bytes: write.bytes }))).toEqual([
			{ fileId, path: added?.original.locator.path, bytes: PICTURE },
		]);
		expect(storage.writtenInsideTransaction).toEqual([false]);
		expect(storage.verifiedChecksums).toEqual([sha256(PICTURE)]);
		expect(files.verified).toEqual([storage.verification]);
		expect(scanner.scans).toEqual([{ fileId, finalAttempt: true }]);
		expect(files.status(fileId)).toBe("READY");
		expect(uow.inner.committed.map((entry) => entry.operation)).toEqual(["files.server_ingest", "files.server_ingest"]);
	});

	it("reuses the READY file already holding the same bytes under the same name: nothing is stored, verified or scanned again", async () => {
		const { ingest, files, storage, scanner } = setup();
		const first = await ingest.ingest(userActor(), pictureRequest());

		await expect(ingest.ingest(userActor(), pictureRequest())).resolves.toBe(first);

		expect(files.added).toHaveLength(1);
		expect(storage.serverWrites).toHaveLength(1);
		expect(scanner.scans).toHaveLength(1);
	});

	it("stores different bytes as a new file", async () => {
		const { ingest, files } = setup();
		const first = await ingest.ingest(userActor(), pictureRequest());

		const second = await ingest.ingest(userActor(), pictureRequest(OTHER_PICTURE));

		expect(second).not.toBe(first);
		expect(files.added.map((file) => file.id)).toEqual([first, second]);
	});

	it("answers 409 FILE_NOT_READY while an asynchronous scanner owns the file, and then for the earlier ingest instead of storing the bytes again", async () => {
		const { ingest, files, storage, scanner } = setup();
		scanner.outcome = "AWAITING_EXTERNAL";

		await expect(ingest.ingest(userActor(), pictureRequest())).rejects.toMatchObject({ code: "FILE_NOT_READY" });
		await expect(ingest.ingest(userActor(), pictureRequest())).rejects.toMatchObject({ code: "FILE_NOT_READY" });

		expect(files.added).toHaveLength(1);
		expect(storage.serverWrites).toHaveLength(1);
		expect(scanner.scans).toHaveLength(1);
	});

	it.each<"QUARANTINED" | "FAILED" | "SKIPPED">(["QUARANTINED", "FAILED", "SKIPPED"])("fails when the scan ends %s: the file is never handed out", async (outcome) => {
		const { ingest, scanner } = setup();
		scanner.outcome = outcome;

		await expect(ingest.ingest(userActor(), pictureRequest())).rejects.toBeInstanceOf(ServerFileIngestFailedError);
	});

	it("is refused by the category's upload rules before anything is recorded or stored", async () => {
		const { ingest, files, storage } = setup();
		const pdf: ServerFileIngestRequest = { ...pictureRequest(), upload: { ...pictureRequest().upload, fileName: "picture.pdf", mimeType: "application/pdf" } };

		await expect(ingest.ingest(userActor(), pdf)).rejects.toBeInstanceOf(FileMimeTypeNotAllowedError);

		expect(files.added).toEqual([]);
		expect(storage.serverWrites).toEqual([]);
	});

	it("leaves the file PENDING and scans nothing when verification rejects the stored bytes", async () => {
		const { ingest, files, storage, scanner } = setup();
		storage.verificationError = new Error("pixel rules broken");

		await expect(ingest.ingest(userActor(), pictureRequest())).rejects.toBe(storage.verificationError);

		const [added] = files.added;
		expect(added === undefined ? undefined : files.status(added.id)).toBe("PENDING");
		expect(scanner.scans).toEqual([]);
	});
});
