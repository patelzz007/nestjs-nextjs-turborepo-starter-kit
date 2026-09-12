import {
	API_VERSION_PREFIX,
	ApiErrorBodySchema,
	ApiErrorResponseSchema,
	createApiSuccessEnvelopeSchema,
	JsonValueSchema,
	MUTATION_INTENT_HEADER,
	MUTATION_INTENT_VALUE,
	type JsonValue,
} from "@workspace/shared";
import { type ZodType } from "zod";

import type { PendingFileUpload } from "./pending-file";

async function readResponseJson(response: Response): Promise<JsonValue> {
	const text: string = await response.text();
	return JsonValueSchema.parse(text.length === 0 ? null : JSON.parse(text));
}

function readErrorMessage(body: JsonValue): string {
	const envelope = ApiErrorResponseSchema.safeParse(body);
	if (envelope.success) {
		return envelope.data.error.message;
	}
	const flat = ApiErrorBodySchema.safeParse(body);
	if (flat.success) {
		return flat.data.message;
	}
	return "Request failed";
}

export function appendFormFields(formData: FormData, fields: Record<string, string>): void {
	for (const [key, value] of Object.entries(fields)) {
		formData.append(key, value);
	}
}

export function appendPendingFiles(formData: FormData, fieldName: string, files: readonly PendingFileUpload[]): void {
	for (const file of files) {
		formData.append(fieldName, file.file, file.fileName);
	}
}

export async function parseApiEnvelope<T>(response: Response, schema: ZodType<T>): Promise<T> {
	const body: JsonValue = await readResponseJson(response);
	if (!response.ok) {
		throw new Error(readErrorMessage(body));
	}
	const envelope = createApiSuccessEnvelopeSchema(schema).safeParse(body);
	if (envelope.success) {
		return envelope.data.data;
	}
	return schema.parse(body);
}

export function buildVersionedApiUrl(baseUrl: string, path: string): string {
	return `${baseUrl}${API_VERSION_PREFIX}${path}`;
}

/** Headers required for cookie-authenticated unsafe requests (multipart uploads bypass the API client). */
export function multipartMutationHeaders(extra?: Readonly<Record<string, string>>): Record<string, string> {
	return { [MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE, ...extra };
}
