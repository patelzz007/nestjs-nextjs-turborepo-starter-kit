import { Controller, Get, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, SuccessAckResponseSchema, UuidParamSchema, type SuccessAckResponse } from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { SkipEnvelope } from "../../../common/decorators/skip-envelope.decorator";
import { ZodParams, ZodQuery } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { SkipMutationIntent } from "../../auth/decorators/skip-mutation-intent.decorator";
import { LOCAL_DOWNLOAD_TOKEN_PARAM } from "../../storage/adapters/local/local-object-storage.adapter";
import { LocalStorageTransferService, type LocalObjectDownload } from "../services/local-storage-transfer.service";

const FileIdParamSchema = z.object({ fileId: UuidParamSchema }).strict();
/** Upper bound for a transfer token in a query string. */
const MAX_TOKEN_LENGTH = 4_096;
const LocalDownloadQuerySchema = z.object({ [LOCAL_DOWNLOAD_TOKEN_PARAM]: z.string().min(1).max(MAX_TOKEN_LENGTH) }).strict();

/** Characters allowed verbatim in the `filename=` fallback of Content-Disposition. */
const UNSAFE_FILENAME_CHARACTERS = /[^\w.\-() ]/g;

function contentDisposition(download: LocalObjectDownload): string {
	const fallback = download.fileName.replace(UNSAFE_FILENAME_CHARACTERS, "_");
	return `${download.disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(download.fileName)}`;
}

async function sendObject(reply: FastifyReply, download: LocalObjectDownload): Promise<void> {
	await reply
		.header("Content-Type", download.mimeType)
		.header("Content-Disposition", contentDisposition(download))
		.header("X-Content-Type-Options", "nosniff")
		.header("Cache-Control", "private, no-store")
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
	public constructor(private readonly transfers: LocalStorageTransferService) {}

	@Public()
	@RlsBypass()
	@SkipEnvelope()
	@Get("local-download")
	@ApiOperation({ summary: "Download a private object through a signed, expiring local-storage link (development only)" })
	@ApiOkResponse({ description: "Object bytes" })
	public async localDownload(@ZodQuery(LocalDownloadQuerySchema) query: z.output<typeof LocalDownloadQuerySchema>, @Res() reply: FastifyReply): Promise<void> {
		await sendObject(reply, await this.transfers.download(query.token));
	}

	@Public()
	@RlsBypass()
	@SkipEnvelope()
	@Get(":fileId/local-public")
	@ApiOperation({ summary: "Serve a READY public asset from local storage (development only)" })
	@ApiOkResponse({ description: "Object bytes" })
	public async localPublic(@ZodParams(FileIdParamSchema) params: z.output<typeof FileIdParamSchema>, @Res() reply: FastifyReply): Promise<void> {
		await sendObject(reply, await this.transfers.downloadPublic(params.fileId));
	}

	@Public()
	@RlsBypass()
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
