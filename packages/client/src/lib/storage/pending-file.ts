import type { DocumentMimeType, FileUploadPolicy } from "@workspace/shared";
import { DocumentMimeTypeSchema } from "@workspace/shared";

export interface PendingFileUpload {
	readonly file: File;
	readonly fileName: string;
	readonly mimeType: DocumentMimeType;
	readonly sizeBytes: number;
}

function formatMaxFileSize(maxBytes: number): string {
	const megabytes = Math.floor(maxBytes / (1024 * 1024));
	return `${String(megabytes)} MB`;
}

export function validatePendingFile(file: File, policy: FileUploadPolicy): PendingFileUpload {
	if (file.size > policy.maxBytesPerFile) {
		throw new Error(`Each file must be ${formatMaxFileSize(policy.maxBytesPerFile)} or smaller.`);
	}
	const mimeParsed = DocumentMimeTypeSchema.safeParse(file.type);
	if (!mimeParsed.success || !policy.allowedMimeTypes.includes(mimeParsed.data)) {
		throw new Error(policy.invalidMimeMessage);
	}
	return {
		file,
		fileName: file.name,
		mimeType: mimeParsed.data,
		sizeBytes: file.size,
	};
}
