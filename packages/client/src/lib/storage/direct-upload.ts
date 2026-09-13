import { type CompleteFileUploadResponse, type CreateFileUploadUrlInput, type CreateFileUploadUrlResponse, type DocumentMimeType } from "@workspace/shared";

import type { ApiClient } from "../api/use-api";
import type { ApiRouter } from "../api/endpoints";

export async function calculateFileSha256Hex(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const digest = await crypto.subtle.digest("SHA-256", buffer);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export interface DirectUploadResult {
	readonly fileId: string;
	readonly response: CompleteFileUploadResponse;
}

export type DirectUploadInput = Omit<CreateFileUploadUrlInput, "checksumSha256" | "sizeBytes">;

/**
 * POST a presigned multipart form to local/S3 storage. When the bucket lacks browser CORS rules,
 * S3 may still store the object (204) while the browser blocks the response — we continue to
 * `/files/:id/complete` and let the API verify via HeadObject.
 */
async function postMultipartUploadToStorage(uploadUrl: string, formData: FormData): Promise<void> {
	try {
		const uploadResponse = await fetch(uploadUrl, { method: "POST", body: formData });
		if (uploadResponse.ok || uploadResponse.status === 204) {
			return;
		}
		const errorBody = await uploadResponse.text();
		throw new Error(errorBody.length > 0 ? `Direct upload to object storage failed: ${errorBody}` : "Direct upload to object storage failed");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const isLikelyCorsBlock = error instanceof TypeError || message.toLowerCase().includes("failed to fetch");
		if (!isLikelyCorsBlock) {
			throw error;
		}
	}
}

/** PUT the file bytes to a signed URL (Firebase and other providers). */
async function putSignedUploadToStorage(uploadUrl: string, file: File, headers: Readonly<Record<string, string>>): Promise<void> {
	const uploadResponse = await fetch(uploadUrl, {
		method: "PUT",
		body: file,
		headers,
	});
	if (uploadResponse.ok || uploadResponse.status === 204) {
		return;
	}
	const errorBody = await uploadResponse.text();
	throw new Error(errorBody.length > 0 ? `Direct upload to object storage failed: ${errorBody}` : "Direct upload to object storage failed");
}

export async function uploadFileWithTicket(ticket: CreateFileUploadUrlResponse, file: File): Promise<void> {
	if (ticket.method === "PUT") {
		const headers = ticket.headers ?? {};
		await putSignedUploadToStorage(ticket.uploadUrl, file, headers);
		return;
	}

	const formData = new FormData();
	const fields = ticket.fields ?? {};
	for (const [key, value] of Object.entries(fields)) {
		formData.append(key, value);
	}
	formData.append("file", file, file.name);
	await postMultipartUploadToStorage(ticket.uploadUrl, formData);
}

export async function uploadFileDirect(api: ApiClient<ApiRouter>, input: DirectUploadInput, file: File): Promise<DirectUploadResult> {
	const checksumSha256 = await calculateFileSha256Hex(file);
	const presignBody: CreateFileUploadUrlInput = {
		...input,
		checksumSha256,
		sizeBytes: file.size,
		mimeType: toDocumentMimeType(file),
	};
	const presignedEnvelope = await api.files.uploadUrl.mutate(presignBody);
	const ticket: CreateFileUploadUrlResponse = presignedEnvelope.data;

	await uploadFileWithTicket(ticket, file);

	const completedEnvelope = await api.files.complete.mutate({
		fileId: ticket.fileId,
		checksumSha256,
	});
	return { fileId: ticket.fileId, response: completedEnvelope.data };
}

export function toDocumentMimeType(file: File): DocumentMimeType {
	if (file.type === "application/pdf") {
		return "application/pdf";
	}
	if (file.type === "image/jpeg") {
		return "image/jpeg";
	}
	if (file.type === "image/png") {
		return "image/png";
	}
	if (file.type === "image/webp") {
		return "image/webp";
	}
	if (file.type === "image/avif") {
		return "image/avif";
	}
	throw new Error("Unsupported file type");
}
