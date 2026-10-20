import { Controller, Get, HttpStatus, Inject, Post, Req, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, FileVariantKindSchema, SuccessAckResponseSchema, UuidParamSchema, type SuccessAckResponse } from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { SkipEnvelope } from "../../../../platform/presentation/http/validation/decorators/skip-envelope.decorator";
import { ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import {
	LOCAL_DOWNLOAD_TOKEN_QUERY_PARAM,
	LOCAL_PUBLIC_ASSET_CACHE_CONTROL,
	type LocalObjectDownload,
	type LocalStorageTransferPort,
} from "../../application/ports/local-storage-transfer.port";
import { LOCAL_STORAGE_TRANSFER } from "../../application/ports/files.tokens";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";

const FileIdParamSchema = z.object({ fileId: UuidParamSchema }).strict();
const FileVariantParamsSchema = z.object({ fileId: UuidParamSchema, variant: FileVariantKindSchema }).strict();
/** Upper bound for a transfer token in a query string. */
const MAX_TOKEN_LENGTH = 4_096;
const LocalDownloadQuerySchema = z.object({ [LOCAL_DOWNLOAD_TOKEN_QUERY_PARAM]: z.string().min(1).max(MAX_TOKEN_LENGTH) }).strict();

/** Characters allowed verbatim in the `filename=` fallback of Content-Disposition. */
const UNSAFE_FILENAME_CHARACTERS = /[^\w.\-() ]/g;

function contentDisposition(download: LocalObjectDownload): string {
	const fallback = download.fileName.replace(UNSAFE_FILENAME_CHARACTERS, "_");
	return `${download.disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(download.fileName)}`;
}

/** Private objects (signed links) are never cached. */
const PRIVATE_OBJECT_CACHE_CONTROL = "private, no-store";

async function sendObject(reply: FastifyReply, download: LocalObjectDownload, cacheControl: string): Promise<void> {
	await reply
		.header("Content-Type", download.mimeType)
		.header("Content-Disposition", contentDisposition(download))
		.header("X-Content-Type-Options", "nosniff")
		.header("Cache-Control", cacheControl)
		.send(download.stream);
}

/**
 * Transfer endpoints of the development-only local storage driver (the role
 * S3/GCS play for remote providers). Public because the browser calls them
 * directly with a signed ticket/link, exactly like a presigned URL; every
 * request is authorized by that capability token or, for public assets, by
 * the file row. They answer 404 unless STORAGE_PROVIDER=local.
 */
@ApiTags("Files")
@Controller(apiPath("/files"))
export class LocalStorageTransferController {
	public constructor(@Inject(LOCAL_STORAGE_TRANSFER) private readonly transfers: LocalStorageTransferPort) {}

	@Public()
	@PublicOperation("files.local_object.read")
	@SkipEnvelope()
	@Get("local-download")
	@ApiOperation({ summary: "Download a private object through a signed, expiring local-storage link (development only)" })
	@ApiOkResponse({ description: "Object bytes" })
	public async localDownload(@ZodQuery(LocalDownloadQuerySchema) query: z.output<typeof LocalDownloadQuerySchema>, @Res() reply: FastifyReply): Promise<void> {
		await sendObject(reply, await this.transfers.download(query.token), PRIVATE_OBJECT_CACHE_CONTROL);
	}

	@Public()
	@PublicOperation("files.local_object.read")
	@SkipEnvelope()
	// Plays the CDN's role: a page shows many public images (reward covers), so browsers cache them like
	// the CDN copy, and the credential-guarding `strict` limit does not apply (the `default` one still does).
	@SkipThrottle({ strict: true })
	@Get(":fileId/local-public")
	@ApiOperation({ summary: "Serve a READY public asset from local storage (development only)" })
	@ApiOkResponse({ description: "Object bytes" })
	public async localPublic(@ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>, @Res() reply: FastifyReply): Promise<void> {
		await sendObject(reply, await this.transfers.downloadPublic(params.fileId), LOCAL_PUBLIC_ASSET_CACHE_CONTROL);
	}

	@Public()
	@PublicOperation("files.local_variant.read")
	@SkipEnvelope()
	// A rendition of a public image — cached and throttled exactly like the file itself (above).
	@SkipThrottle({ strict: true })
	@Get(":fileId/variants/:variant/local-public")
	@ApiOperation({ summary: "Serve a rendition of a READY public image from local storage (development only)" })
	@ApiOkResponse({ description: "Object bytes" })
	public async localPublicVariant(@ZodParams(FileVariantParamsSchema) params: z.output<typeof FileVariantParamsSchema>, @Res() reply: FastifyReply): Promise<void> {
		await sendObject(reply, await this.transfers.downloadPublicVariant(params.fileId, params.variant), LOCAL_PUBLIC_ASSET_CACHE_CONTROL);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@PublicOperation("files.local_object.read")
	// Not a cookie-authenticated mutation: the browser posts the form straight from the ticket (like an S3
	// presigned POST) and the only credential is the signed upload token in the body, so there is no ambient
	// authority for a cross-site request to ride on.
	@SkipMutationIntent()
	@Post(":fileId/local-upload")
	@ApiOperation({ summary: "Receive a browser multipart upload for a signed local-storage ticket (development only)" })
	@ZodResponse(SuccessAckResponseSchema, { status: HttpStatus.CREATED, description: "Local upload stored" })
	public async localUpload(@ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>, @Req() request: FastifyRequest): Promise<SuccessAckResponse> {
		await this.transfers.upload(params.fileId, request);
		return { success: true };
	}
}
