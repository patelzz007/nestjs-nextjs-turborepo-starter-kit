import { Controller, Delete, ForbiddenException, Get, Headers, HttpStatus, Inject, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	CompleteFileUploadResponseSchema,
	CompleteFileUploadSchema,
	CreateFileUploadUrlResponseSchema,
	CreateFileUploadUrlSchema,
	DeleteSuccessDataSchema,
	DocumentMimeTypeSchema,
	FileDetailResponseSchema,
	FileDownloadResponseSchema,
	FileProcessingResultSchema,
	SuccessAckResponseSchema,
	UuidParamSchema,
	apiContract,
	apiPath,
	type DeleteSuccessData,
	type FileDetailResponse,
	type SuccessAckResponse,
} from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { SkipEnvelope } from "../../../common/decorators/skip-envelope.decorator";
import { parseMultipartRequest } from "../../../common/multipart/parse-multipart-request";
import { ZodBody, ZodQuery, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { TypedConfigService } from "../../../config/typed-config.service";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import { OBJECT_STORAGE } from "../../storage/domain/storage.tokens";
import { locatorFromStoredFile, toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileService } from "../services/file.service";
import { FileAuthorizationService, type FileActor } from "../services/file-authorization.service";

const FileIdParamSchema = z.object({ fileId: UuidParamSchema }).strict();

const LocalUploadFieldsSchema = z.object({ key: z.string().min(1) }).strict();

const LocalDownloadQuerySchema = z
	.object({
		container: z.string().min(1),
		path: z.string().min(1),
	})
	.strict();

const STORAGE_CALLBACK_SECRET_HEADER = "x-storage-callback-secret";

function toFileActor(user: AccessTokenPayload): FileActor {
	return { id: user.sub, isSuperAdmin: user.isSuperAdmin };
}

@ApiTags("Files")
@Controller(apiPath("/files"))
export class FilesController {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly files: FileService,
		private readonly fileAuthorization: FileAuthorizationService,
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
	) {}

	// Per-category authorization (own avatar, product, store branding, owner-only KYB)
	// for every operation below: see FileAuthorizationService.
	@Post("upload-url")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a browser upload ticket" })
	@ZodResponse(CreateFileUploadUrlResponseSchema, { status: HttpStatus.CREATED, description: "Browser upload ticket created" })
	public async createUploadUrl(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(apiContract.files.uploadUrl.input) body: z.output<typeof CreateFileUploadUrlSchema>,
	): ReturnType<FileService["createUploadUrl"]> {
		await this.fileAuthorization.assertCanUpload(toFileActor(user), body);
		return this.files.createUploadUrl(user.sub, body);
	}

	@Public()
	@RlsBypass()
	@Post("processing-callback")
	@ApiOperation({ summary: "External processing callback for file lifecycle updates" })
	@ZodResponse(SuccessAckResponseSchema, { status: HttpStatus.CREATED, description: "Processing result applied" })
	public async processingCallback(
		@Headers(STORAGE_CALLBACK_SECRET_HEADER) callbackSecret: string | undefined,
		@ZodBody(FileProcessingResultSchema) body: z.output<typeof FileProcessingResultSchema>,
	): Promise<SuccessAckResponse> {
		this.assertProcessingCallbackAuthorized(callbackSecret);
		await this.files.applyProcessingResult(body);
		return { success: true };
	}

	@Public()
	@RlsBypass()
	@SkipEnvelope()
	@Get("local-download")
	@ApiOperation({ summary: "Serve a local filesystem object for signed/public URLs (development only)" })
	@ApiOkResponse({ description: "Local object bytes" })
	public async localDownload(@ZodQuery(LocalDownloadQuerySchema) query: z.output<typeof LocalDownloadQuerySchema>, @Res() reply: FastifyReply): Promise<void> {
		if (!this.config.useLocalStorage) {
			throw new ForbiddenException({ message: "Local download is only available for local storage", error: "LOCAL_DOWNLOAD_DISABLED" });
		}

		const locator = toStorageObjectLocator(this.config.storageProvider, query.container, query.path);
		const buffer = await this.storage.getObject(locator);
		if (buffer === null) {
			throw new ForbiddenException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		await reply.header("Content-Type", "application/octet-stream").send(buffer);
	}

	@Post(":fileId/complete")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Complete a direct upload after browser upload" })
	@ZodResponse(CompleteFileUploadResponseSchema, { status: HttpStatus.CREATED, description: "Upload verified and queued for processing" })
	public async completeUpload(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>,
		@ZodBody(CompleteFileUploadSchema) body: z.output<typeof CompleteFileUploadSchema>,
	): ReturnType<FileService["completeUpload"]> {
		const file = await this.files.requireFile(params.fileId);
		await this.fileAuthorization.assertCanComplete(toFileActor(user), file);
		return this.files.completeUpload(user.sub, params.fileId, body);
	}

	@Get(":fileId")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get file metadata" })
	@ZodResponse(FileDetailResponseSchema, { description: "File metadata" })
	public async getFile(@GetUser() user: AccessTokenPayload, @ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>): Promise<FileDetailResponse> {
		const file = await this.files.requireFile(params.fileId);
		await this.fileAuthorization.assertCanRead(toFileActor(user), file);
		return { file: this.files.mapFileRecord(file) };
	}

	@Get(":fileId/download-url")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get a short-lived download URL for a private file" })
	@ZodResponse(FileDownloadResponseSchema, { description: "Signed download URL" })
	public async getDownloadUrl(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>,
	): ReturnType<FileService["createDownloadUrl"]> {
		const file = await this.files.requireFile(params.fileId);
		await this.fileAuthorization.assertCanRead(toFileActor(user), file);
		return this.files.createDownloadUrl(file);
	}

	@Delete(":fileId")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Soft-delete a file and queue physical deletion" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "File queued for deletion" })
	public async deleteFile(@GetUser() user: AccessTokenPayload, @ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>): Promise<DeleteSuccessData> {
		const file = await this.files.requireFile(params.fileId);
		await this.fileAuthorization.assertCanDelete(toFileActor(user), file);
		await this.files.deleteStoredFile(file);
		return { success: true };
	}

	@Public()
	@RlsBypass()
	@Post(":fileId/local-upload")
	@ApiOperation({ summary: "Local filesystem shim for multipart POST uploads (development only)" })
	@ZodResponse(SuccessAckResponseSchema, { status: HttpStatus.CREATED, description: "Local upload stored" })
	public async localUpload(@ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>, @Req() request: FastifyRequest): Promise<SuccessAckResponse> {
		if (!this.config.useLocalStorage) {
			throw new ForbiddenException({ message: "Local upload is disabled when a remote provider is active", error: "LOCAL_UPLOAD_DISABLED" });
		}

		const file = await this.repository.findById(params.fileId);
		if (file === null) {
			throw new ForbiddenException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}

		const parsed = await parseMultipartRequest(request, LocalUploadFieldsSchema, { maxFiles: 1 });
		const [uploaded] = parsed.files;
		if (uploaded === undefined) {
			throw new ForbiddenException({ message: "Missing upload file", error: "FILE_OBJECT_MISSING" });
		}
		if (parsed.fields.key !== file.storagePath) {
			throw new ForbiddenException({ message: "Upload key mismatch", error: "FILE_KEY_MISMATCH" });
		}

		const mimeType = DocumentMimeTypeSchema.parse(uploaded.mimeType);
		const locator = locatorFromStoredFile(file, this.config.storageProvider);
		await this.storage.upload({
			locator,
			buffer: uploaded.buffer,
			mimeType,
		});
		return { success: true };
	}

	private assertProcessingCallbackAuthorized(callbackSecret: string | undefined): void {
		const expected = this.config.storageProcessingCallbackSecret;
		// Fail closed in EVERY environment: without STORAGE_PROCESSING_CALLBACK_SECRET
		// nobody can prove they are the processing worker.
		if (expected === null) {
			throw new UnauthorizedException({ message: "Processing callback secret is not configured", error: "CALLBACK_UNAUTHORIZED" });
		}
		if (callbackSecret !== expected) {
			throw new UnauthorizedException({ message: "Invalid processing callback secret", error: "CALLBACK_UNAUTHORIZED" });
		}
	}
}
