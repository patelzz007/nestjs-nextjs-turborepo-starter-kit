import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { digestStream, readStreamPrefix } from "./object-stream.util";

const CHUNKS: [Buffer, Buffer, Buffer] = [Buffer.from("%PDF-"), Buffer.from("1.7 "), Buffer.from("body")];

describe("digestStream", () => {
	it("hashes and counts a multi-chunk stream exactly like the whole buffer", async () => {
		const whole = Buffer.concat(CHUNKS);

		await expect(digestStream(Readable.from(CHUNKS))).resolves.toEqual({
			sha256Hex: createHash("sha256").update(whole).digest("hex"),
			sizeBytes: whole.length,
		});
	});
});

describe("readStreamPrefix", () => {
	it("returns exactly the requested leading bytes across chunk boundaries and destroys the stream", async () => {
		const stream = Readable.from(CHUNKS);

		await expect(readStreamPrefix(stream, 7)).resolves.toEqual(Buffer.from("%PDF-1."));
		expect(stream.destroyed).toBe(true);
	});

	it("returns the whole object when it is shorter than the prefix", async () => {
		await expect(readStreamPrefix(Readable.from([Buffer.from("ab")]), 16)).resolves.toEqual(Buffer.from("ab"));
	});
});
