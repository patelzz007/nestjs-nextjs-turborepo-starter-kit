import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import type { MultipartFile } from "@fastify/multipart";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import { FILE_CATEGORY_POLICIES, getFileCategoryPolicy, type FileCategoryPolicy, type FileDownloadDisposition } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import { LOCAL_UPLOAD_KEY_FIELD, LOCAL_UPLOAD_TOKEN_FIELD } from "../../storage/adapters/local/local-object-storage.adapter";
import { LocalTransferTokenError, LocalTransferTokenService, type LocalUploadTokenPayload } from "../../storage/adapters/local/local-transfer-token.service";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import { OBJECT_STORAGE } from "../../storage/domain/storage.tokens";
import { assertAllowedUploadMime, UploadContentRejectedError } from "../../storage/utils/magic-bytes.util";
import { locatorFromStoredFile } from "../../storage/utils/storage-locator.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";

/** Largest object any category accepts — the hard multipart limit before the ticket's own limit is known. */
const LARGEST_UPLOAD_BYTES: number = Math.max(...Object.values(FILE_CATEGORY_POLICIES).map((policy: FileCategoryPolicy): number => policy.maxBytes));
/** A local upload form carries exactly the key field, the token field and one file. */
const LOCAL_UPLOAD_FIELD_COUNT = 2;
/** A form field value (object key or token); bounded so a field cannot be used to exhaust memory. */
const FormFieldValueSchema = z.string().max(4_096);

/** Bytes plus the headers they must be served with. */
export interface LocalObjectDownload {
	readonly stream: Readable;
	readonly mimeType: string;
	readonly disposition: FileDownloadDisposition;
	readonly fileName: string;
}

/**
 * The HTTP side of the development-only local storage driver: it plays the
 * role S3/GCS play for remote providers. Every operation is authorized by a
 * signed, expiring capability token bound to one file (see
 * LocalTransferTokenService) or, for public assets, by the file row itself —
 * never by a client-supplied path.
 */
@Injectable()
export class LocalStorageTransferService {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly repository: StoredFileRepository,
		private readonly tokens: LocalTransferTokenService,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
	) {}

	/** Serves a private object for a valid download token whose file is still READY at the same key. */
	public async download(token: string): Promise<LocalObjectDownload> {
		this.assertEnabled();
		const payload = this.verify((): ReturnType<LocalTransferTokenService["verifyDownload"]> => this.tokens.verifyDownload(token));
		const file = await this.repository.findById(payload.fileId);
		if (file?.status !== "READY" || !this.isAtLocation(file, payload.container, payload.path)) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		return this.open(file, payload.disposition ?? "inline", payload.fileName ?? file.originalName);
	}

	/** Serves a READY public asset by id (what `publishAsset` links to). */
	public async downloadPublic(fileId: string): Promise<LocalObjectDownload> {
		this.assertEnabled();
		const file = await this.repository.findReadyPublicById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		return this.open(file, "inline", file.originalName);
	}

	/**
	 * Accepts the browser's multipart POST for a PENDING file. The form must
	 * carry the ticket's key and token BEFORE the file part, so the token is
	 * verified before a single file byte is buffered. The bytes must match the
	 * ticket exactly: size, SHA-256 and magic bytes of the declared type.
	 */
	public async upload(fileId: string, request: FastifyRequest): Promise<void> {
		this.assertEnabled();
		if (!request.isMultipart()) {
			throw new BadRequestException({ message: "Expected multipart/form-data request", error: "LOCAL_UPLOAD_NOT_MULTIPART" });
		}

		const fields = new Map<string, string>();
		let stored = false;
		for await (const part of request.parts({ limits: { files: 1, fields: LOCAL_UPLOAD_FIELD_COUNT, fileSize: LARGEST_UPLOAD_BYTES } })) {
			if (part.type === "field") {
				const value = FormFieldValueSchema.safeParse(part.value);
				if (!value.success) {
					throw new BadRequestException({ message: `Invalid form field ${part.fieldname}`, error: "LOCAL_UPLOAD_INVALID_FIELD" });
				}
				fields.set(part.fieldname, value.data);
				continue;
			}
			if (stored) {
				throw new BadRequestException({ message: "Exactly one file is accepted", error: "LOCAL_UPLOAD_TOO_MANY_FILES" });
			}
			const ticket = this.verify((): LocalUploadTokenPayload => this.tokens.verifyUpload(fields.get(LOCAL_UPLOAD_TOKEN_FIELD) ?? ""));
			const file = await this.requireUploadTarget(fileId, ticket, fields.get(LOCAL_UPLOAD_KEY_FIELD));
			await this.store(file, ticket, await this.readFilePart(part, ticket));
			stored = true;
		}
		if (!stored) {
			throw new BadRequestException({ message: "Missing upload file", error: "LOCAL_UPLOAD_FILE_MISSING" });
		}
	}

	private async requireUploadTarget(fileId: string, ticket: LocalUploadTokenPayload, key: string | undefined): Promise<StoredFile> {
		if (ticket.fileId !== fileId || key !== ticket.path) {
			throw new ForbiddenException({ message: "Upload ticket does not match this file", error: "LOCAL_UPLOAD_TICKET_MISMATCH" });
		}
		const file = await this.repository.findById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		// Completed uploads have moved to their final key, so the state is checked first: a late replay is a 409.
		if (file.status !== "PENDING") {
			throw new ConflictException({ message: "Upload already completed", error: "FILE_UPLOAD_ALREADY_COMPLETED" });
		}
		if (!this.isAtLocation(file, ticket.container, ticket.path)) {
			throw new ForbiddenException({ message: "Upload ticket does not match this file", error: "LOCAL_UPLOAD_TICKET_MISMATCH" });
		}
		return file;
	}

	private async readFilePart(part: MultipartFile, ticket: LocalUploadTokenPayload): Promise<Buffer> {
		let buffer: Buffer;
		try {
			buffer = await part.toBuffer();
		} catch (error) {
			if (part.file.truncated) {
				throw new PayloadTooLargeException({ message: "File exceeds maximum allowed size", error: "FILE_TOO_LARGE" });
			}
			throw error;
		}
		if (buffer.length > ticket.maxBytes) {
			throw new PayloadTooLargeException({ message: "File exceeds maximum allowed size", error: "FILE_TOO_LARGE" });
		}
		return buffer;
	}

	private async store(file: StoredFile, ticket: LocalUploadTokenPayload, buffer: Buffer): Promise<void> {
		if (buffer.length !== file.sizeBytes) {
			throw new BadRequestException({ message: "Uploaded size mismatch", error: "FILE_SIZE_MISMATCH" });
		}
		if (createHash("sha256").update(buffer).digest("hex") !== ticket.checksumSha256) {
			throw new BadRequestException({ message: "Object checksum mismatch", error: "FILE_OBJECT_CHECKSUM_MISMATCH" });
		}
		try {
			assertAllowedUploadMime(buffer, ticket.mimeType, getFileCategoryPolicy(file.category).allowedMimeTypes);
		} catch (error) {
			if (error instanceof UploadContentRejectedError) {
				throw new BadRequestException({ message: error.message, error: "FILE_CONTENT_TYPE_MISMATCH" });
			}
			throw error;
		}
		await this.storage.upload({ locator: locatorFromStoredFile(file, this.config.storageProvider), buffer, mimeType: ticket.mimeType });
	}

	private async open(file: StoredFile, disposition: FileDownloadDisposition, fileName: string): Promise<LocalObjectDownload> {
		const stream = await this.storage.getObjectStream(locatorFromStoredFile(file, this.config.storageProvider));
		if (stream === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		return { stream, mimeType: file.mimeType, disposition, fileName };
	}

	private isAtLocation(file: StoredFile, container: string, path: string): boolean {
		const locator = locatorFromStoredFile(file, this.config.storageProvider);
		return locator.container === container && locator.path === path;
	}

	/** An invalid, forged or expired capability is a 403 — the caller holds no valid grant. */
	private verify<TPayload>(verification: () => TPayload): TPayload {
		try {
			return verification();
		} catch (error) {
			if (error instanceof LocalTransferTokenError) {
				throw new ForbiddenException({ message: "Invalid or expired transfer token", error: "LOCAL_TRANSFER_TOKEN_INVALID" });
			}
			throw error;
		}
	}

	/** The routes exist only for the local driver; for remote providers they are simply not there. */
	private assertEnabled(): void {
		if (!this.config.useLocalStorage) {
			throw new NotFoundException({ message: "Local storage transfer is not enabled", error: "LOCAL_STORAGE_DISABLED" });
		}
	}
}
