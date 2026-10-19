import { Readable } from "node:stream";

import { Zip, ZipPassThrough } from "fflate";

import { StreamChunkSchema, streamChunkToBuffer } from "./object-stream.util";
import { sanitizeFileName } from "./sanitize-file-name.util";

/** One file of a ZIP archive: its name inside the archive, its modification time, and how to open its bytes. */
export interface ZipArchiveEntry {
	readonly name: string;
	/** Epoch milliseconds; ZIP stores it at two-second precision, from 1980 on. */
	readonly modifiedAt: number;
	/** Opens the file's bytes — called only when the archive reaches this entry, so one source is open at a time. */
	readonly open: () => Promise<Readable>;
}

/**
 * An uploaded file's name as an archive entry, prefixed with its 1-based
 * position so the archive lists the files in order (`3, 12, "IMG 1.webp"` →
 * `"03-IMG 1.webp"`). The name goes through {@link sanitizeFileName}, so an
 * entry never carries a path that would extract outside its folder.
 */
export function zipArchiveEntryName(position: number, total: number, fileName: string): string {
	return `${String(position).padStart(String(total).length, "0")}-${sanitizeFileName(fileName)}`;
}

/**
 * Streams `entries` as one ZIP archive. Entries are stored as they are (no
 * recompression: images and PDFs are compressed already), one source at a
 * time, pulled as the reader consumes the archive — memory stays at a chunk
 * or two whatever the files weigh. A source that fails to open or read
 * destroys the stream with that error, so a reader never gets a truncated
 * archive presented as complete.
 */
export function zipArchiveStream(entries: readonly ZipArchiveEntry[]): Readable {
	return Readable.from(zipArchiveChunks(entries), { objectMode: false });
}

async function* zipArchiveChunks(entries: readonly ZipArchiveEntry[]): AsyncGenerator<Uint8Array> {
	const output: Uint8Array[] = [];
	const failures: Error[] = [];
	const archive = new Zip((error, chunk) => {
		if (error === null) {
			output.push(chunk);
		} else {
			failures.push(error);
		}
	});
	// fflate writes synchronously as entries are pushed; hand each piece on as soon as it exists.
	function* drain(): Generator<Uint8Array> {
		const [failure] = failures;
		if (failure !== undefined) {
			throw failure;
		}
		yield* output.splice(0);
	}

	for (const entry of entries) {
		const source = await entry.open();
		const file = new ZipPassThrough(entry.name);
		file.mtime = entry.modifiedAt;
		archive.add(file);
		for await (const chunk of source) {
			file.push(streamChunkToBuffer(StreamChunkSchema.parse(chunk)));
			yield* drain();
		}
		file.push(new Uint8Array(), true);
		yield* drain();
	}
	archive.end();
	yield* drain();
}
