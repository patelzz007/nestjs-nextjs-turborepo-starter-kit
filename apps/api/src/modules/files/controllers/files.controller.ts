import { Body, Controller, Delete, ForbiddenException, Get, Headers, Inject, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
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
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { parseMultipartRequest } from "../../../common/multipart/parse-multipart-request";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { TypedConfigService } from "../../../config/typed-config.service";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { OBJECT_STORAGE } from "../../storage/storage.tokens";
import type { ObjectStorageService } from "../../storage/storage.types";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileService } from "../services/file.service";

const FileIdParamSchema = z.object({ fileId: UuidParamSchema }).strict();

const LocalUploadFieldsSchema = z.object({ key: z.string().min(1) }).strict();

const STORAGE_CALLBACK_SECRET_HEADER = "x-storage-callback-secret";

@ApiTags("Files")
@Controller(apiPath("/files"))
export class FilesController {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly files: FileService,
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
	) {}

	@Post("upload-url")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a presigned POST upload URL" })
	@ApiOkResponse({ description: "Presigned upload URL created" })
	public createUploadUrl(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(apiContract.files.uploadUrl.input)) body: z.output<typeof CreateFileUploadUrlSchema>,
	): ReturnType<FileService["createUploadUrl"]> {
		return this.files.createUploadUrl(user.sub, body);
	}

	@Post(":fileId/complete")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Complete a direct upload after S3 POST" })
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
	@Post("processing-callback")
	@ApiOperation({ summary: "Processing/scanner callback for file lifecycle updates" })
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
	@Post(":fileId/local-upload")
	@ApiOperation({ summary: "Local filesystem shim for presigned POST uploads (development only)" })
	@ApiOkResponse({ description: "Local upload stored" })
	public async localUpload(
		@Param(new ZodValidationPipe(FileIdParamSchema)) params: z.output<typeof FileIdParamSchema>,
		@Req() request: FastifyRequest,
	): Promise<{ success: true }> {
		if (this.config.useS3Storage) {
			throw new ForbiddenException({ message: "Local upload is disabled when S3 is enabled", error: "LOCAL_UPLOAD_DISABLED" });
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
		await this.storage.upload({
			bucket: file.storageBucket,
			path: file.storagePath,
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
