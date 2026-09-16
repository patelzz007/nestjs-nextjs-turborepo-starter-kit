import { Body, Controller, Delete, ForbiddenException, Get, Headers, Inject, Param, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	CompleteFileUploadSchema,
	CreateFileUploadUrlSchema,
	DocumentMimeTypeSchema,
	FileProcessingResultSchema,
	UuidParamSchema,
	apiContract,
	apiPath,
} from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { SkipEnvelope } from "../../../common/decorators/skip-envelope.decorator";
import { parseMultipartRequest } from "../../../common/multipart/parse-multipart-request";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { TypedConfigService } from "../../../config/typed-config.service";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import { OBJECT_STORAGE } from "../../storage/domain/storage.tokens";
import { locatorFromStoredFile, toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileService } from "../services/file.service";
import { KernelIntegrationHelper } from "../../authorization/kernel/kernel-integration.helper";

const FileIdParamSchema = z.object({ fileId: UuidParamSchema }).strict();

const LocalUploadFieldsSchema = z.object({ key: z.string().min(1) }).strict();

const LocalDownloadQuerySchema = z
	.object({
		container: z.string().min(1),
		path: z.string().min(1),
	})
	.strict();

const STORAGE_CALLBACK_SECRET_HEADER = "x-storage-callback-secret";

@ApiTags("Files")
@Controller(apiPath("/files"))
export class FilesController {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly files: FileService,
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
		private readonly kernelHelper: KernelIntegrationHelper,
	) {}

	@Post("upload-url")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a browser upload ticket" })
	@ApiOkResponse({ description: "Browser upload ticket created" })
	public async createUploadUrl(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(apiContract.files.uploadUrl.input)) body: z.output<typeof CreateFileUploadUrlSchema>,
	): Promise<ReturnType<FileService["createUploadUrl"]>> {
		await this.kernelHelper.requireAction(user.sub, "CREATE", "ORGANIZATION", {
			organizationId: body.organizationId,
		});
		
		return this.files.createUploadUrl(user.sub, body);
	}

	@Public()
	@Post("processing-callback")
	@ApiOperation({ summary: "External processing callback for file lifecycle updates" })
	@ApiOkResponse({ description: "Processing result applied" })
	public async processingCallback(
		@Headers(STORAGE_CALLBACK_SECRET_HEADER) callbackSecret: string | undefined,
		@Body(new ZodValidationPipe(FileProcessingResultSchema)) body: z.output<typeof FileProcessingResultSchema>,
	): Promise<{ success: true }> {
		this.assertProcessingCallbackAuthorized(callbackSecret);
		await this.files.applyProcessingResult(body);
		return { success: true };
	}

	@Public()
	@SkipEnvelope()
	@Get("local-download")
	@ApiOperation({ summary: "Serve a local filesystem object for signed/public URLs (development only)" })
	@ApiOkResponse({ description: "Local object bytes" })
	public async localDownload(
		@Query(new ZodValidationPipe(LocalDownloadQuerySchema)) query: z.output<typeof LocalDownloadQuerySchema>,
		@Res() reply: FastifyReply,
	): Promise<void> {
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
	@ApiOkResponse({ description: "Upload verified and queued for processing" })
	public completeUpload(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(FileIdParamSchema)) params: z.output<typeof FileIdParamSchema>,
		@Body(new ZodValidationPipe(CompleteFileUploadSchema)) body: z.output<typeof CompleteFileUploadSchema>,
	): ReturnType<FileService["completeUpload"]> {
		return this.files.completeUpload(user.sub, params.fileId, body);
	}

	@Get(":fileId")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get file metadata" })
	@ApiOkResponse({ description: "File metadata" })
	public getFile(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(FileIdParamSchema)) params: z.output<typeof FileIdParamSchema>,
	): Promise<{ file: ReturnType<FileService["mapFileRecord"]> }> {
		return this.files.getFile(user.sub, params.fileId).then((file) => ({ file }));
	}

	@Get(":fileId/download-url")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get a short-lived download URL for a private file" })
	@ApiOkResponse({ description: "Signed download URL" })
	public getDownloadUrl(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(FileIdParamSchema)) params: z.output<typeof FileIdParamSchema>,
	): ReturnType<FileService["getDownloadUrl"]> {
		return this.files.getDownloadUrl(user.sub, params.fileId);
	}

	@Delete(":fileId")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Soft-delete a file and queue physical deletion" })
	@ApiOkResponse({ description: "File queued for deletion" })
	public async deleteFile(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(FileIdParamSchema)) params: z.output<typeof FileIdParamSchema>,
	): Promise<{ success: true }> {
		await this.files.deleteFile(user.sub, params.fileId);
		return { success: true };
	}

	@Public()
	@Post(":fileId/local-upload")
	@ApiOperation({ summary: "Local filesystem shim for multipart POST uploads (development only)" })
	@ApiOkResponse({ description: "Local upload stored" })
	public async localUpload(
		@Param(new ZodValidationPipe(FileIdParamSchema)) params: z.output<typeof FileIdParamSchema>,
		@Req() request: FastifyRequest,
	): Promise<{ success: true }> {
		if (!this.config.useLocalStorage) {
			throw new ForbiddenException({ message: "Local upload is disabled when a remote provider is active", error: "LOCAL_UPLOAD_DISABLED" });
		}

		const file = await this.repository.findById(params.fileId);
		if (file === null) {
			throw new ForbiddenException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}

		const parsed = await parseMultipartRequest(request, LocalUploadFieldsSchema, { maxFiles: 1 });
		if (parsed.files.length === 0) {
			throw new ForbiddenException({ message: "Missing upload file", error: "FILE_OBJECT_MISSING" });
		}
		const uploaded = parsed.files[0];
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
		if (expected === null) {
			if (process.env.NODE_ENV === "production") {
				throw new UnauthorizedException({ message: "Processing callback secret is not configured", error: "CALLBACK_UNAUTHORIZED" });
			}
			return;
		}
		if (callbackSecret !== expected) {
			throw new UnauthorizedException({ message: "Invalid processing callback secret", error: "CALLBACK_UNAUTHORIZED" });
		}
	}
}
