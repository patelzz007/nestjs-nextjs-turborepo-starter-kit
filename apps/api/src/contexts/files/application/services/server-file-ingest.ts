// ============================================
// application/services/server-file-ingest.ts — storing bytes the server itself produced
// ============================================
// Every other file arrives as a browser upload. A context that needs a file it generates (the Load
// Test tenant's reward picture) ingests it here, and the file goes through exactly what an upload
// goes through — the request checks (`prepareFileUpload`), the byte verification and the claim
// (`verifyAndClaimUpload`), and the malware scan with its renditions and verdict
// (`FileProcessingPort.scan`) — so it is the same READY file, with the same renditions, an upload
// would be. Nothing here is a second implementation of those steps.
//
// Design patterns:
//   - APPLICATION SERVICE over the files ports (Dependency Inversion: storage, reads, the unit of
//     work and the scan pipeline are all ports; the composition root wires the adapters).
//   - Idempotent by content: the same bytes under the same name in the same tenant category are one
//     file, so a caller that ingests on every run stores them once.

import { createHash } from "node:crypto";

import { assertNever, type FileUploadRequest } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { ConflictError } from "../../../../platform/application/errors/app-error";
import type { VerifiedUpload } from "../../domain/aggregates/stored-file.aggregate";
import { FileUploadAlreadyCompletedError } from "../../domain/errors/files.errors";
import type { StoredFileSaveOutcome } from "../../domain/repositories/stored-file.repository";
import { verifyAndClaimUpload } from "../commands/complete-file-upload/complete-file-upload";
import { prepareFileUpload } from "../commands/request-file-upload/request-file-upload";
import type { FilesScope } from "../files-scope";
import type { FileObjectStoragePort } from "../ports/file-object-storage.port";
import type { FileProcessingPort, VerdictOutcome } from "../ports/file-processing.port";
import { FILES_SERVER_INGEST_OPERATION } from "../ports/files.tokens";
import type { StoredFileReadPort } from "../ports/stored-file-read.port";

/** What a caller ingests: the upload it stands for (size and checksum are taken from the bytes) and the bytes. */
export interface ServerFileIngestRequest {
	readonly upload: Omit<FileUploadRequest, "sizeBytes" | "checksumSha256">;
	/** Recorded as the file's uploader: the user the calling context acts for. */
	readonly uploadedById: string;
	readonly bytes: Buffer;
}

/** The ingested file did not become READY (quarantined, failed its scan, or deleted mid-scan): nothing a caller may bind. */
export class ServerFileIngestFailedError extends Error {
	public constructor(
		public readonly fileId: string,
		public readonly outcome: Exclude<VerdictOutcome, "READY" | "AWAITING_EXTERNAL">,
	) {
		super(`Server-ingested file ${fileId} did not become READY: ${outcome}`);
		this.name = "ServerFileIngestFailedError";
	}
}

/** Ingests server-produced bytes through the upload pipeline (see the file header). Built by FilesModule. */
export class ServerFileIngest {
	public constructor(
		private readonly uow: UnitOfWork<FilesScope>,
		private readonly reads: StoredFileReadPort,
		private readonly storage: FileObjectStoragePort,
		private readonly processing: FileProcessingPort,
	) {}

	/**
	 * The READY file holding `request.bytes`, ingested now unless an earlier ingest already holds
	 * them. Object storage is written and scanned between short transactions, never inside one.
	 * The caller has authorized the file (no category access rule runs: no browser asked for it).
	 *
	 * Throws a 409 `FILE_NOT_READY` while an asynchronous scanner still owns the file (ingest again
	 * once it has answered), and {@link ServerFileIngestFailedError} when the file can never be READY.
	 */
	public async ingest(actor: ActorContext, request: ServerFileIngestRequest): Promise<string> {
		const checksumSha256: string = createHash("sha256").update(request.bytes).digest("hex");
		const input: FileUploadRequest = { ...request.upload, sizeBytes: request.bytes.length, checksumSha256 };
		const earlier = await this.reads.findIngestedContent(actor, { tenantId: input.tenantId ?? null, category: input.category, originalName: input.fileName, checksumSha256 });
		if (earlier !== null) {
			return this.readyFileId(earlier.id, earlier.status === "READY" ? "READY" : "AWAITING_EXTERNAL");
		}

		const prepared = prepareFileUpload(this.storage, request.uploadedById, input);
		const fileId: string = prepared.file.id;
		await this.uow.runSystemOperation(FILES_SERVER_INGEST_OPERATION, actor, (scope) => scope.storedFiles.add(prepared.file));
		await this.storage.writeServerUpload({ fileId, uploadedById: request.uploadedById, locator: prepared.locator, input: prepared.input, bytes: request.bytes });
		const recorded = await this.reads.findLiveForIngest(actor, fileId);
		if (recorded === null) {
			throw new ServerFileIngestFailedError(fileId, "SKIPPED");
		}
		await verifyAndClaimUpload(this.storage, request.uploadedById, recorded, checksumSha256, (verified: VerifiedUpload) =>
			this.uow.runSystemOperation(FILES_SERVER_INGEST_OPERATION, actor, async (scope): Promise<StoredFileSaveOutcome> => {
				const live = await scope.storedFiles.findLive(fileId);
				if (live === null) {
					throw new FileUploadAlreadyCompletedError();
				}
				live.claimForScan(request.uploadedById, checksumSha256, verified);
				return scope.storedFiles.save(live);
			}),
		);
		// Scanned here as the final attempt (no queue retry): the caller binds the file right after.
		return this.readyFileId(fileId, await this.processing.scan(actor, fileId, true));
	}

	private readyFileId(fileId: string, outcome: VerdictOutcome): string {
		switch (outcome) {
			case "READY":
				return fileId;
			case "AWAITING_EXTERNAL":
				throw new ConflictError({ code: "FILE_NOT_READY", message: `File ${fileId} is still being scanned for malware; try again once the scan has finished` });
			case "QUARANTINED":
			case "FAILED":
			case "SKIPPED":
				throw new ServerFileIngestFailedError(fileId, outcome);
			default:
				return assertNever(outcome, "server ingest verdict");
		}
	}
}
