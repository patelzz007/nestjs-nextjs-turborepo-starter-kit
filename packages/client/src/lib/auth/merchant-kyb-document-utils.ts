import type { JsonObject, MerchantKybDocument, MerchantKybProfileResponse, MerchantKybStoredDocument } from "@workspace/shared";
import { JsonPrimitiveSchema, MerchantKybDocumentMimeTypeSchema, MerchantKybStoredDocumentSchema, MERCHANT_KYB_MAX_DOCUMENT_BYTES } from "@workspace/shared";
import { z } from "zod";

const DataUrlSchema = z.string().regex(/^data:[^;]+;base64,/);
const StoredDocumentsSchema = z.array(MerchantKybStoredDocumentSchema);

function formatMaxDocumentSize(): string {
	const megabytes = Math.floor(MERCHANT_KYB_MAX_DOCUMENT_BYTES / (1024 * 1024));
	return `${String(megabytes)} MB`;
}

export function readMerchantKybDocument(file: File): Promise<MerchantKybDocument> {
	if (file.size > MERCHANT_KYB_MAX_DOCUMENT_BYTES) {
		return Promise.reject(new Error(`Each file must be ${formatMaxDocumentSize()} or smaller.`));
	}

	const mimeParsed = MerchantKybDocumentMimeTypeSchema.safeParse(file.type);
	if (!mimeParsed.success) {
		return Promise.reject(new Error("Only PDF, JPEG, PNG, or WebP files are allowed."));
	}

	return readFileDataUrl(file).then((dataUrl): MerchantKybDocument => {
		const dataUrlParsed = DataUrlSchema.safeParse(dataUrl);
		if (!dataUrlParsed.success) {
			throw new Error("Unable to read file.");
		}

		const commaIndex = dataUrl.indexOf(",");
		const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";
		if (base64.length === 0) {
			throw new Error("Unable to read file.");
		}

		return {
			fileName: file.name,
			mimeType: mimeParsed.data,
			sizeBytes: file.size,
			contentBase64: base64,
		};
	});
}

function readFileDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject): void => {
		const reader = new FileReader();
		reader.onload = (): void => {
			const parsed = z.string().safeParse(reader.result);
			if (!parsed.success) {
				reject(new Error("Unable to read file."));
				return;
			}
			resolve(parsed.data);
		};
		reader.onerror = (): void => {
			reject(new Error("Unable to read file."));
		};
		reader.readAsDataURL(file);
	});
}

export function readStoredKybDocuments(kybFields: JsonObject | null): MerchantKybStoredDocument[] {
	if (kybFields === null) {
		return [];
	}

	const parsed = StoredDocumentsSchema.safeParse(kybFields.documents);
	if (!parsed.success) {
		return [];
	}

	return parsed.data;
}

export function hasSubmittedMerchantKyb(profile: MerchantKybProfileResponse): boolean {
	if (profile.kybFields === null) {
		return false;
	}

	const submittedAt = JsonPrimitiveSchema.safeParse(profile.kybFields.submittedAt);
	return submittedAt.success && submittedAt.data !== null;
}

export function formatKybDocumentSize(sizeBytes: number): string {
	if (sizeBytes < 1024) {
		return `${String(sizeBytes)} B`;
	}
	if (sizeBytes < 1024 * 1024) {
		return `${String(Math.round(sizeBytes / 1024))} KB`;
	}
	return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildKybDocumentDataUrl(document: MerchantKybDocument | MerchantKybStoredDocument): string {
	return `data:${document.mimeType};base64,${document.contentBase64}`;
}
