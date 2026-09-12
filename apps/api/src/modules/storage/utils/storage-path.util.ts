import { randomUUID } from "node:crypto";

import { sanitizeFileName } from "./sanitize-file-name.util";

/** Build a private object path under a namespace with quarantine/clean lifecycle segments. */
export function buildQuarantineObjectPath(namespace: string, ownerId: string, batchId: string, fileName: string): string {
	const safeName = sanitizeFileName(fileName);
	return `${namespace}/${ownerId}/quarantine/${batchId}/${randomUUID()}-${safeName}`;
}

export function buildCleanObjectPath(namespace: string, ownerId: string, batchId: string, fileName: string): string {
	const safeName = sanitizeFileName(fileName);
	return `${namespace}/${ownerId}/clean/${batchId}/${randomUUID()}-${safeName}`;
}

export function toCleanPathFromQuarantine(quarantinePath: string): string {
	return quarantinePath.replace("/quarantine/", "/clean/");
}
