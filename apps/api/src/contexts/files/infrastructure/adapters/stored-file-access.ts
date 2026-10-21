import type { Readable } from "node:stream";

import { HttpStatus } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import type {
	CompleteFileUploadInput,
	CompleteFileUploadResponse,
	FileUploadRequest,
	CreateFileUploadUrlResponse,
	FileDownloadDisposition,
	FileDownloadResponse,
} from "@workspace/shared";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import { systemActor } from "../../../../platform/application/actor-context";
import { AppError } from "../../../../platform/application/errors/app-error";
import type { ObjectStorage } from "../../../../platform/infrastructure/storage/domain/object-storage.port";
import { readStreamFully } from "../../../../platform/infrastructure/storage/utils/object-stream.util";
import { zipArchiveEntryName, zipArchiveStream } from "../../../../platform/infrastructure/storage/utils/zip-archive.util";
import { userRlsContext } from "../../../../prisma/rls-context";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { VerifiedUpload } from "../../domain/aggregates/stored-file.aggregate";
import { FileUploadAlreadyCompletedError } from "../../domain/errors/files.errors";
import type { StoredFileSaveOutcome } from "../../domain/repositories/stored-file.repository";
import { completeFileUpload } from "../../application/commands/complete-file-upload/complete-file-upload";
import type { FileDeletion } from "../../application/commands/delete-file/file-deletion";
import { requestFileUpload } from "../../application/commands/request-file-upload/request-file-upload";
import { fileNotFound } from "../../application/file-not-found";
import type { FileObjectStoragePort } from "../../application/ports/file-object-storage.port";
import { FILES_DELETE_OPERATION } from "../../application/ports/files.tokens";
import type { StorageTaskDispatcher } from "../../application/ports/storage-task-dispatcher.port";
import { PrismaStoredFileRepository } from "../persistence/prisma-stored-file.repository";
import { storedLocatorOf, toStoredFileView, type StoredFileDbClient } from "../persistence/stored-file.mapper";

/** The collaborators the access forwards to (wired by FilesModule). */
export interface FileServiceDependencies {
	readonly config: TypedConfigService;
	readonly transactions: TenantTransactionService;
	readonly storage: FileObjectStoragePort;
	readonly objects: ObjectStorage;
	readonly dispatcher: StorageTaskDispatcher;
	readonly deletion: FileDeletion;
}

/**
 * The files context's published access to stored files, for adapters in other contexts that already
 * authorized the file (merchant KYB evidence, reward image delivery, GitHub comment pictures). Every
 * method runs the same use-case code the files commands run; nothing here is a second implementation.
 * Completion keeps the uploader's own RLS session (D28).
 */
export class StoredFileAccess {
	public constructor(private readonly deps: FileServiceDependencies) {}

	public async createUploadUrl(userId: string, input: FileUploadRequest): Promise<CreateFileUploadUrlResponse> {
		return requestFileUpload(this.deps.storage, userId, input, (file) =>
			this.deps.transactions.withBoundSession("Insert a stored-file upload ticket", (tx) => new PrismaStoredFileRepository(tx).add(file)),
		);
	}

	public async completeUpload(userId: string, fileId: string, input: CompleteFileUploadInput): Promise<CompleteFileUploadResponse> {
		const file = await this.requireFile(fileId);
		await completeFileUpload(this.deps.storage, this.deps.dispatcher, userId, this.view(file), input.checksumSha256, (verified: VerifiedUpload) =>
			this.deps.transactions.withRlsContext({ context: userRlsContext(userId, file.tenantId, false), reason: null }, async (tx): Promise<StoredFileSaveOutcome> => {
				const repository = new PrismaStoredFileRepository(tx);
				const live = await repository.findLive(fileId);
				if (live === null) {
					throw new FileUploadAlreadyCompletedError();
				}
				live.claimForScan(userId, input.checksumSha256, verified);
				return repository.save(live);
			}),
		);
		return { file: this.view(await this.requireFile(fileId)).record };
	}

	/** The live files among `ids` (unknown and deleted ids are absent). Pass `db` to stay in the caller's transaction. */
	public async findLiveFiles(ids: readonly string[], db?: StoredFileDbClient): Promise<StoredFile[]> {
		if (db !== undefined) {
			return db.storedFile.findMany({ where: { id: { in: [...ids] }, isDeleted: false } });
		}
		return this.deps.transactions.withBoundSession("Read live stored files", (tx) => tx.storedFile.findMany({ where: { id: { in: [...ids] }, isDeleted: false } }));
	}

	/** A live file, or `null` when there is none (never uploaded, or deleted). */
	public async findFile(fileId: string): Promise<StoredFile | null> {
		return this.deps.transactions.withBoundSession("Read a live stored file", (tx) => tx.storedFile.findFirst({ where: { id: fileId, isDeleted: false } }));
	}

	public async requireFile(fileId: string): Promise<StoredFile> {
		const file = await this.findFile(fileId);
		if (file === null) {
			throw fileNotFound();
		}
		return file;
	}

	/** Short-lived signed URL for an already-authorized file; `null` until it is READY. */
	public async createDownloadUrl(file: StoredFile, disposition: FileDownloadDisposition = "inline"): Promise<FileDownloadResponse> {
		return this.deps.storage.createDownloadUrl(this.view(file), disposition);
	}

	/** The bytes of an already-authorized READY file, read whole; refused past `maxBytes` (`StreamTooLargeError`). */
	public async readStoredBytes(file: StoredFile, maxBytes: number): Promise<Buffer> {
		if (file.status !== "READY") {
			throw new AppError({ code: "FILE_NOT_READY", httpStatus: HttpStatus.CONFLICT, message: "The file is not ready yet" });
		}
		return readStreamFully(await this.openStoredObject(file), maxBytes);
	}

	/**
	 * Streams already-authorized files as one ZIP of their original uploads, in
	 * the given order. Each object is opened only when the archive reaches it;
	 * an object missing from storage fails the stream rather than ending it early.
	 */
	public createZipArchive(files: readonly StoredFile[]): Readable {
		return zipArchiveStream(
			files.map((file, index) => ({
				name: zipArchiveEntryName(index + 1, files.length, file.originalName),
				modifiedAt: Number(file.createdAt),
				open: (): Promise<Readable> => this.openStoredObject(file),
			})),
		);
	}

	/**
	 * The ordinary deletion (reference guards, `FileDeleted`, purge after
	 * commit) for an already-authorized file. The caller passes no actor, so it
	 * runs as the allowlisted `files.delete` operation on behalf of
	 * `actorUserId`. `SystemOrigin` has no HTTP value, so "job" is recorded.
	 */
	public async deleteStoredFile(file: StoredFile, actorUserId: string): Promise<void> {
		const actor = systemActor(FILES_DELETE_OPERATION, "job", file.tenantId, "Delete a stored file on behalf of its owning context", actorUserId);
		await this.deps.deletion.delete(actor, { fileId: file.id, category: file.category, tenantId: file.tenantId }, actorUserId);
	}

	private view(file: StoredFile): ReturnType<typeof toStoredFileView> {
		return toStoredFileView(file, this.deps.config.http.publicUrl);
	}

	private async openStoredObject(file: StoredFile): Promise<Readable> {
		const stream = await this.deps.objects.getObjectStream(storedLocatorOf(file));
		if (stream === null) {
			throw new Error(`The stored object of file ${file.id} is missing`);
		}
		return stream;
	}
}
