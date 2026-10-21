import { Controller, Delete, Get, Headers, HttpStatus, Inject, Post } from "@nestjs/common";
import { CommandBus, QueryBus, type Command, type Query } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	CompleteFileUploadResponseSchema,
	CompleteFileUploadSchema,
	CreateFileUploadUrlResponseSchema,
	CreateFileUploadUrlSchema,
	CreateTenantFileUploadUrlSchema,
	DeleteSuccessDataSchema,
	FileDetailResponseSchema,
	FileDownloadResponseSchema,
	FileProcessingResultSchema,
	SuccessAckResponseSchema,
	TenantSlugParamSchema,
	UuidParamSchema,
	apiContract,
	apiPath,
	type CompleteFileUploadResponse,
	type CreateFileUploadUrlResponse,
	type CreateTenantFileUploadUrlInput,
	type DeleteSuccessData,
	type FileDetailResponse,
	type FileDownloadResponse,
	type SuccessAckResponse,
} from "@workspace/shared";
import { z } from "zod";

import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ApplyFileProcessingResultCommand } from "../../application/commands/apply-file-processing-result/apply-file-processing-result.command";
import { CompleteFileUploadCommand } from "../../application/commands/complete-file-upload/complete-file-upload.command";
import { DeleteFileCommand } from "../../application/commands/delete-file/delete-file.command";
import { RequestFileUploadCommand } from "../../application/commands/request-file-upload/request-file-upload.command";
import { GetFileDownloadUrlQuery } from "../../application/queries/get-file-download-url/get-file-download-url.query";
import { GetFileQuery } from "../../application/queries/get-file/get-file.query";
import { FILES_SCAN_VERDICT_OPERATION } from "../../application/ports/files.tokens";
import { FileUploadForbiddenError } from "../../domain/errors/files.errors";

const FileIdParamSchema = z.object({ fileId: UuidParamSchema }).strict();

/** The one CommandBus / QueryBus capability the controller uses (the buses satisfy it). */
export interface FilesCommandDispatch {
	execute<TResult>(command: Command<TResult>): Promise<TResult>;
}

export interface FilesQueryDispatch {
	execute<TResult>(query: Query<TResult>): Promise<TResult>;
}

const STORAGE_CALLBACK_SECRET_HEADER = "x-storage-callback-secret";

/**
 * `/files`: every route makes one command or query call. Per-category
 * authorization (own avatar, product, store branding, owner-only KYB, reward
 * images) happens inside the handlers through the owners' registered
 * `FileCategoryAccessRule`s; the processing callback's shared secret is checked
 * by its command before anything is read.
 */
@ApiTags("Files")
@Controller(apiPath("/files"))
export class FilesController {
	public constructor(
		@Inject(CommandBus) private readonly commandBus: FilesCommandDispatch,
		@Inject(QueryBus) private readonly queryBus: FilesQueryDispatch,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("upload-url")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a browser upload ticket" })
	@ZodResponse(CreateFileUploadUrlResponseSchema, { status: HttpStatus.CREATED, description: "Browser upload ticket created" })
	public async createUploadUrl(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.files.uploadUrl.input) body: z.output<typeof CreateFileUploadUrlSchema>,
	): Promise<CreateFileUploadUrlResponse> {
		return this.commandBus.execute(new RequestFileUploadCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@PublicOperation(FILES_SCAN_VERDICT_OPERATION)
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
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@Headers(STORAGE_CALLBACK_SECRET_HEADER) callbackSecret: string | undefined,
		@ZodBody(FileProcessingResultSchema) body: z.output<typeof FileProcessingResultSchema>,
	): Promise<SuccessAckResponse> {
		await this.commandBus.execute(new ApplyFileProcessingResultCommand(actor, callbackSecret ?? null, body));
		return { success: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":fileId/complete")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Complete a direct upload after browser upload" })
	@ZodResponse(CompleteFileUploadResponseSchema, { status: HttpStatus.CREATED, description: "Upload verified and queued for processing" })
	public async completeUpload(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>,
		@ZodBody(CompleteFileUploadSchema) body: z.output<typeof CompleteFileUploadSchema>,
	): Promise<CompleteFileUploadResponse> {
		return this.commandBus.execute(new CompleteFileUploadCommand(actor, params.fileId, body));
	}

	@Get(":fileId")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get file metadata" })
	@ZodResponse(FileDetailResponseSchema, { description: "File metadata" })
	public async getFile(@CurrentActor() actor: ActorContext, @ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>): Promise<FileDetailResponse> {
		return this.queryBus.execute(new GetFileQuery(actor, params.fileId));
	}

	@Get(":fileId/download-url")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get a short-lived download URL for a private file" })
	@ZodResponse(FileDownloadResponseSchema, { description: "Signed download URL" })
	public async getDownloadUrl(@CurrentActor() actor: ActorContext, @ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>): Promise<FileDownloadResponse> {
		return this.queryBus.execute(new GetFileDownloadUrlQuery(actor, params.fileId));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Delete(":fileId")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Soft-delete a file and queue physical deletion" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "File queued for deletion" })
	public async deleteFile(@CurrentActor() actor: ActorContext, @ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>): Promise<DeleteSuccessData> {
		await this.commandBus.execute(new DeleteFileCommand(actor, params.fileId));
		return { success: true };
	}
}

/**
 * Tenant-owned uploads (store logo and banner, reward images, KYB evidence): the tenant is the one
 * `:tenantSlug` resolved and the guard verified for the caller (multi-tenancy plan D23), never a
 * body field. A caller the route did not bind to the tenant (no membership, no support grant) is
 * refused before any row or ticket exists; the category owner's access rule then checks the capability.
 */
@ApiTags("Files")
@Controller(apiPath("/tenants"))
export class TenantFilesController {
	public constructor(@Inject(CommandBus) private readonly commandBus: FilesCommandDispatch) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/files/upload-url")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a browser upload ticket for a tenant-owned file" })
	@ZodResponse(CreateFileUploadUrlResponseSchema, { status: HttpStatus.CREATED, description: "Browser upload ticket created" })
	public async createUploadUrl(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodBody(CreateTenantFileUploadUrlSchema) body: CreateTenantFileUploadUrlInput,
	): Promise<CreateFileUploadUrlResponse> {
		if (actor.tenantId === null) {
			throw new FileUploadForbiddenError("Not allowed to upload files for this tenant");
		}
		return this.commandBus.execute(new RequestFileUploadCommand(actor, { ...body, tenantId: actor.tenantId }));
	}
}
