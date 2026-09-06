import { createHash } from "node:crypto";

/** Builds a stable RFC-4122-style UUID from a namespace + key (idempotent across re-seeds). */
export function deterministicUuid(namespace: string, key: string): string {
	const hash = createHash("sha256").update(`${namespace}:${key}`).digest();
	const bytes = Buffer.from(hash.subarray(0, 16));
	bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x40, 6);
	bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
