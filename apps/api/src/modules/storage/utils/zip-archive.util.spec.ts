import { Readable } from "node:stream";

import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import { StreamChunkSchema, streamChunkToBuffer } from "./object-stream.util";
import { zipArchiveEntryName, zipArchiveStream, type ZipArchiveEntry } from "./zip-archive.util";

/** 2026-10-13T10:00:00Z — any instant after 1980 that ZIP can store. */
const MODIFIED_AT = 1_791_885_600_000;

async function collect(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(streamChunkToBuffer(StreamChunkSchema.parse(chunk)));
	}
	return Buffer.concat(chunks);
}

function entryOf(name: string, ...chunks: string[]): ZipArchiveEntry {
	return { name, modifiedAt: MODIFIED_AT, open: () => Promise.resolve(Readable.from(chunks.map((chunk) => Buffer.from(chunk)))) };
}

describe("zipArchiveEntryName", () => {
	it("prefixes the 1-based position, padded to the width of the total", () => {
		expect(zipArchiveEntryName(3, 12, "IMG 1.webp")).toBe("03-IMG 1.webp");
		expect(zipArchiveEntryName(3, 9, "IMG 1.webp")).toBe("3-IMG 1.webp");
	});

	it("keeps only the file name of a path, so nothing extracts outside its folder", () => {
		expect(zipArchiveEntryName(1, 2, "../../etc/passwd")).toBe("1-passwd");
		expect(zipArchiveEntryName(1, 2, "C:\\photos\\brunch.webp")).toBe("1-brunch.webp");
	});
});

describe("zipArchiveStream", () => {
	it("archives every entry under its name, byte for byte, in order", async () => {
		const archive = await collect(zipArchiveStream([entryOf("01-first.txt", "hello ", "world"), entryOf("02-second.txt", "second")]));

		const files = unzipSync(archive);
		expect(Object.keys(files)).toEqual(["01-first.txt", "02-second.txt"]);
		expect(strFromU8(files["01-first.txt"] ?? new Uint8Array())).toBe("hello world");
		expect(strFromU8(files["02-second.txt"] ?? new Uint8Array())).toBe("second");
	});

	it("opens one source at a time, as the reader reaches it", async () => {
		const second = vi.fn(() => Promise.resolve(Readable.from([Buffer.from("b")])));
		const stream = zipArchiveStream([entryOf("a.txt", "a"), { name: "b.txt", modifiedAt: MODIFIED_AT, open: second }]);

		const iterator = stream[Symbol.asyncIterator]();
		await iterator.next();
		expect(second).not.toHaveBeenCalled();

		await collect(stream);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("fails the stream when a source cannot be opened, rather than ending a partial archive", async () => {
		const stream = zipArchiveStream([
			entryOf("a.txt", "a"),
			{ name: "b.txt", modifiedAt: MODIFIED_AT, open: (): Promise<Readable> => Promise.reject(new Error("object missing")) },
		]);

		await expect(collect(stream)).rejects.toThrow("object missing");
	});

	it("is a valid, empty archive without entries", async () => {
		expect(unzipSync(await collect(zipArchiveStream([])))).toEqual({});
	});
});
