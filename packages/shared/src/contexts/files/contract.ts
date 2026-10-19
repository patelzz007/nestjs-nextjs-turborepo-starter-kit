// API contract leaves owned by the `files` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { singleResponse } from "../../contracts/response";
import { DeleteSuccessDataSchema } from "../../schemas/api/api-response";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import { filesRoutes } from "./routes";
import {
	CompleteFileUploadResponseSchema,
	CompleteFileUploadSchema,
	CreateFileUploadUrlResponseSchema,
	CreateFileUploadUrlSchema,
	FileDetailResponseSchema,
	FileDownloadResponseSchema,
} from "./schemas/storage";

/** Contract leaves composed into `apiContract.files`. */
export const filesContract = {
	uploadUrl: defineContract({
		method: "POST",
		path: filesRoutes.uploadUrl,
		input: CreateFileUploadUrlSchema,
		response: singleResponse(CreateFileUploadUrlResponseSchema),
	}),
	complete: defineContract({
		method: "POST",
		path: filesRoutes.complete,
		input: z.intersection(z.object({ fileId: UuidParamSchema }).strict(), CompleteFileUploadSchema),
		response: singleResponse(CompleteFileUploadResponseSchema),
	}),
	detail: defineContract({
		method: "GET",
		path: filesRoutes.detail,
		input: z.object({ fileId: UuidParamSchema }).strict(),
		response: singleResponse(FileDetailResponseSchema),
	}),
	downloadUrl: defineContract({
		method: "GET",
		path: filesRoutes.downloadUrl,
		input: z.object({ fileId: UuidParamSchema }).strict(),
		response: singleResponse(FileDownloadResponseSchema),
	}),
	delete: defineContract({
		method: "DELETE",
		path: filesRoutes.delete,
		input: z.object({ fileId: UuidParamSchema }).strict(),
		response: singleResponse(DeleteSuccessDataSchema),
	}),
};
