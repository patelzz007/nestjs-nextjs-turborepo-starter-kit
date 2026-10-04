import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import { z } from "zod";

/** What a byte stream may yield (Node streams yield Buffers; object-mode sources may yield strings). */
export const StreamChunkSchema = z.union([z.instanceof(Uint8Array), z.string()]);

export type StreamChunk = z.output<typeof StreamChunkSchema>;

/** Normalizes one validated chunk from a byte stream (string chunks are encoded as UTF-8). */
export function streamChunkToBuffer(chunk: StreamChunk): Buffer {
	if (typeof chunk === "string") {
		return Buffer.from(chunk, "utf8");
	}
	return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
}

/** Streams an object through SHA-256 and counts its bytes — constant memory regardless of object size. */
export async function digestStream(stream: Readable): Promise<{ readonly sha256Hex: string; readonly sizeBytes: number }> {
	const hash = createHash("sha256");
	let sizeBytes = 0;
	for await (const chunk of stream) {
		const buffer = streamChunkToBuffer(StreamChunkSchema.parse(chunk));
		hash.update(buffer);
		sizeBytes += buffer.length;
	}
	return { sha256Hex: hash.digest("hex"), sizeBytes };
}

/** Reads at most `length` leading bytes, then releases the stream. */
export async function readStreamPrefix(stream: Readable, length: number): Promise<Buffer> {
	const chunks: Buffer[] = [];
	let collected = 0;
	try {
		for await (const chunk of stream) {
			const buffer = streamChunkToBuffer(StreamChunkSchema.parse(chunk));
			chunks.push(buffer);
			collected += buffer.length;
			if (collected >= length) {
				break;
			}
		}
	} finally {
		stream.destroy();
	}
	return Buffer.concat(chunks).subarray(0, length);
}
