import { Controller, Delete, Get, Headers, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	CompleteFileUploadResponseSchema,
	CompleteFileUploadSchema,
	CreateFileUploadUrlResponseSchema,
	CreateFileUploadUrlSchema,
	DeleteSuccessDataSchema,
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
import { z } from "zod";

import { ZodBody, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { secureEquals } from "../../../common/utils/secure-equals";
import { TypedConfigService } from "../../../config/typed-config.service";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { SkipMutationIntent } from "../../auth/decorators/skip-mutation-intent.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { FileService } from "../services/file.service";
import { FileAuthorizationService, type FileActor } from "../services/file-authorization.service";

const FileIdParamSchema = z.object({ fileId: UuidParamSchema }).strict();

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
	// Server-to-server integration (the processing worker sends no Origin); authenticated by the shared secret.
	@SkipMutationIntent()
	@Post("processing-callback")
	@ApiOperation({
		summary: "External processing callback for file lifecycle updates",
		description:
			"Applies an out-of-process scanner/processing result. Accepted only while the file is awaiting a verdict (SCANNING); any later delivery — including a replay — is rejected with 409.",
	})
	@ZodResponse(SuccessAckResponseSchema, { status: HttpStatus.CREATED, description: "Processing result applied" })
	public async processingCallback(
		@Headers(STORAGE_CALLBACK_SECRET_HEADER) callbackSecret: string | undefined,
		@ZodBody(FileProcessingResultSchema) body: z.output<typeof FileProcessingResultSchema>,
	): Promise<SuccessAckResponse> {
		this.assertProcessingCallbackAuthorized(callbackSecret);
		await this.files.applyProcessingResult(body);
		return { success: true };
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
		await this.files.deleteStoredFile(file, user.sub);
		return { success: true };
	}

	private assertProcessingCallbackAuthorized(callbackSecret: string | undefined): void {
		const expected = this.config.storage.processingCallbackSecret;
		// Fail closed in EVERY environment: without STORAGE_PROCESSING_CALLBACK_SECRET
		// nobody can prove they are the processing worker.
		if (expected === null) {
			throw new UnauthorizedException({ message: "Processing callback secret is not configured", error: "CALLBACK_UNAUTHORIZED" });
		}
		// Constant-time comparison: the secret must not leak through response timing.
		if (callbackSecret === undefined || !secureEquals(callbackSecret, expected)) {
			throw new UnauthorizedException({ message: "Invalid processing callback secret", error: "CALLBACK_UNAUTHORIZED" });
		}
	}
}
