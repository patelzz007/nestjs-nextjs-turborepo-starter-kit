import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import { z } from "zod";

/** What a byte stream may yield (Node streams yield Buffers; object-mode sources may yield strings). */
export const StreamChunkSchema = z.union([z.instanceof(Uint8Array), z.string()]);

export type StreamChunk = z.output<typeof StreamChunkSchema>;

/** Normalizes one validated chunk from a byte stream (string chunks are encoded as UTF-8). */
export function streamChunkToBuffer(chunk: StreamChunk): Buffer {
	const asString = z.string().safeParse(chunk);
	if (asString.success) {
		return Buffer.from(asString.data, "utf8");
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

/** The stream held more bytes than the caller allows. */
export class StreamTooLargeError extends Error {
	public constructor(public readonly maxBytes: number) {
		super(`The object is larger than ${String(maxBytes)} bytes`);
		this.name = "StreamTooLargeError";
	}
}

/** Reads a whole stream into memory — refused past `maxBytes` (the stream is released), so a caller's bound always holds. */
export async function readStreamFully(stream: Readable, maxBytes: number): Promise<Buffer> {
	const chunks: Buffer[] = [];
	let collected = 0;
	for await (const chunk of stream) {
		const buffer = streamChunkToBuffer(StreamChunkSchema.parse(chunk));
		collected += buffer.length;
		if (collected > maxBytes) {
			stream.destroy();
			throw new StreamTooLargeError(maxBytes);
		}
		chunks.push(buffer);
	}
	return Buffer.concat(chunks);
}
