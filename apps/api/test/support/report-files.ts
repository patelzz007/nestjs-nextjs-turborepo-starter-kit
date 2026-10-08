// ── Readers for exported report files (tests only) ───────────────────────
// Turn the bytes of a CSV / XLSX / PDF export back into something a test can
// assert on, WITHOUT the libraries that wrote them: a PDF's text is read from
// its (inflated) content streams, an XLSX sheet's XML from the zip.
import type { Readable } from "node:stream";
import { inflateSync } from "node:zlib";

import { isStringPrimitive } from "@workspace/shared";
import { strFromU8, unzipSync } from "fflate";

/** Collects a stream into one buffer. */
export function readAll(stream: Readable): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on("data", (chunk: Buffer | string) => {
			chunks.push(isStringPrimitive(chunk) ? Buffer.from(chunk, "utf8") : chunk);
		});
		stream.on("end", () => {
			resolve(Buffer.concat(chunks));
		});
		stream.on("error", reject);
	});
}

/** One indirect object of a PDF: its dictionary text and its (inflated) stream, if any. */
interface PdfObject {
	readonly dictionary: string;
	readonly stream: string | null;
}

/** Every `N 0 obj … endobj` of the file, with Flate streams inflated. */
function pdfObjects(pdf: Buffer): Map<number, PdfObject> {
	const text = pdf.toString("latin1");
	const objects = new Map<number, PdfObject>();
	for (const match of text.matchAll(/(?<id>\d+) 0 obj\b(?<body>[\s\S]*?)endobj/g)) {
		const id = Number(match.groups?.id);
		const body = match.groups?.body ?? "";
		const streamAt = body.indexOf("stream");
		if (streamAt === -1) {
			objects.set(id, { dictionary: body, stream: null });
			continue;
		}
		const dictionary = body.slice(0, streamAt);
		const raw = body.slice(streamAt + "stream".length, body.lastIndexOf("endstream")).replace(/^\r?\n/, "");
		const bytes = Buffer.from(raw, "latin1");
		let stream: string;
		try {
			stream = dictionary.includes("/FlateDecode") ? inflateSync(bytes).toString("latin1") : raw;
		} catch {
			stream = raw;
		}
		objects.set(id, { dictionary, stream });
	}
	return objects;
}

/** A `ToUnicode` CMap (as PDFKit writes it: `bfrange` with arrays, or `bfchar`) → code → text. */
function parseToUnicode(cmap: string): Map<number, string> {
	const decodeUtf16 = (hex: string): string => Buffer.from(hex.replace(/\s+/g, ""), "hex").swap16().toString("utf16le");
	const map = new Map<number, string>();
	for (const range of cmap.matchAll(/<(?<start>[0-9a-fA-F]+)>\s*<(?<end>[0-9a-fA-F]+)>\s*\[(?<targets>[^\]]*)\]/g)) {
		const first = Number.parseInt(range.groups?.start ?? "0", 16);
		[...(range.groups?.targets ?? "").matchAll(/<(?<hex>[0-9a-fA-F\s]*)>/g)].forEach((entry, offset) => {
			map.set(first + offset, decodeUtf16(entry.groups?.hex ?? ""));
		});
	}
	for (const block of cmap.matchAll(/beginbfchar(?<pairs>[\s\S]*?)endbfchar/g)) {
		for (const pair of (block.groups?.pairs ?? "").matchAll(/<(?<code>[0-9a-fA-F]+)>\s*<(?<text>[0-9a-fA-F\s]+)>/g)) {
			map.set(Number.parseInt(pair.groups?.code ?? "0", 16), decodeUtf16(pair.groups?.text ?? ""));
		}
	}
	return map;
}

/**
 * The text a PDF draws, one string per text-showing operator (`TJ` / `Tj`), in
 * drawing order. Embedded (Type0) fonts are decoded through their `ToUnicode`
 * CMap — so a shaped Indic run reads in GLYPH order (e.g. the Devanagari i-sign
 * before its consonant), exactly as the glyphs were placed. Standard-font text
 * is decoded as Windows-1252.
 */
export function pdfTextRuns(pdf: Buffer): string[] {
	const objects = pdfObjects(pdf);
	const fonts = new Map<string, Map<number, string> | null>();
	for (const match of pdf.toString("latin1").matchAll(/\/(?<fontName>F\d+) (?<objectId>\d+) 0 R/g)) {
		const font = objects.get(Number(match.groups?.objectId));
		const toUnicode = /\/ToUnicode (?<objectId>\d+) 0 R/.exec(font?.dictionary ?? "")?.groups?.objectId;
		const cmap = toUnicode === undefined ? undefined : objects.get(Number(toUnicode))?.stream;
		fonts.set(match.groups?.fontName ?? "", cmap === undefined || cmap === null ? null : parseToUnicode(cmap));
	}
	const contentIds = new Set([...pdf.toString("latin1").matchAll(/\/Contents (?<objectId>\d+) 0 R/g)].map((match) => Number(match.groups?.objectId)));
	const runs: string[] = [];
	for (const [id, object] of objects) {
		if (object.stream === null || !contentIds.has(id)) continue;
		let font: Map<number, string> | null = null;
		for (const match of object.stream.matchAll(/\/(?<fontName>F\d+)\s+[\d.]+\s+Tf|\[(?<array>[^\]]*)\]\s*TJ|<(?<hex>[0-9a-fA-F]*)>\s*Tj/g)) {
			const fontName: string | undefined = match.groups?.fontName;
			if (fontName !== undefined) {
				font = fonts.get(fontName) ?? null;
				continue;
			}
			const operand = match.groups?.array ?? `<${match.groups?.hex ?? ""}>`;
			const hex = [...operand.matchAll(/<(?<hex>[0-9a-fA-F]*)>/g)].map((chunk) => chunk.groups?.hex ?? "").join("");
			if (font === null) {
				runs.push(Buffer.from(hex, "hex").toString("latin1"));
				continue;
			}
			const codes = hex.match(/.{4}/g) ?? [];
			runs.push(codes.map((code) => font?.get(Number.parseInt(code, 16)) ?? "\uFFFD").join(""));
		}
	}
	return runs;
}

/** Every file inside an XLSX (a zip), as text, by path (`xl/worksheets/sheet1.xml`, …). */
export function xlsxParts(xlsx: Buffer): Map<string, string> {
	return new Map(Object.entries(unzipSync(new Uint8Array(xlsx))).map(([path, bytes]) => [path, strFromU8(bytes)]));
}
