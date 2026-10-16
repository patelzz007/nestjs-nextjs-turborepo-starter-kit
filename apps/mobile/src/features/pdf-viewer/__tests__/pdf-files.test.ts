import { buildTextPdf, MAX_PDF_VIEWER_FILE_BYTES, PDF_MEDIA_TYPE } from "@workspace/shared";

import { hasFolder, putFile, serveDownload } from "../../../../test/expo-file-system-fake";
import { failNext, openings, pickNext } from "../../../../test/expo-document-picker-fake";
import { failNextShare, shares } from "../../../../test/expo-sharing-fake";
import { checkLocalPdf, downloadPdf, PDF_DOWNLOADS_FOLDER, PDF_UTI, pickPdf, SAMPLE_PDF_NAME, sharePdf, writeSamplePdf } from "../pdf-files";

const encoder = new TextEncoder();
const PDF_BYTES = encoder.encode(buildTextPdf([{ title: "Statement", lines: ["Balance: 120.00"] }]));
const SIGNED_URL = "https://storage.example.com/statement.pdf?X-Amz-Signature=abc";
const PICKED_URI = "file:///cache/DocumentPicker/statement.pdf";

describe("downloadPdf", () => {
	it("downloads into its own cache folder, under the document's file name", async () => {
		serveDownload(SIGNED_URL, PDF_BYTES);

		const uri = await downloadPdf(SIGNED_URL, "reports/Bank statement");

		expect(uri).toMatch(new RegExp(`^file:///cache/${PDF_DOWNLOADS_FOLDER}/[0-9a-f-]{36}/Bank statement\\.pdf$`));
		expect(hasFolder(uri.slice(0, uri.lastIndexOf("/")))).toBe(true);
		expect(checkLocalPdf(uri)).toEqual({ ok: true });
	});

	it("rejects when the address serves nothing", async () => {
		await expect(downloadPdf("https://storage.example.com/missing.pdf", "missing.pdf")).rejects.toThrow();
	});
});

describe("checkLocalPdf", () => {
	it("accepts a PDF", () => {
		putFile(PICKED_URI, PDF_BYTES);
		expect(checkLocalPdf(PICKED_URI)).toEqual({ ok: true });
	});

	it("rejects an empty file, a file that is no PDF, and one over the size limit", () => {
		putFile("file:///cache/empty.pdf", new Uint8Array());
		putFile("file:///cache/photo.pdf", encoder.encode("ÿJFIF not a pdf"));
		const huge = new Uint8Array(MAX_PDF_VIEWER_FILE_BYTES + 1);
		huge.set(PDF_BYTES);
		putFile("file:///cache/huge.pdf", huge);

		expect(checkLocalPdf("file:///cache/empty.pdf")).toEqual({ ok: false, failure: "empty" });
		expect(checkLocalPdf("file:///cache/photo.pdf")).toEqual({ ok: false, failure: "not_a_pdf" });
		expect(checkLocalPdf("file:///cache/huge.pdf")).toEqual({ ok: false, failure: "too_large" });
	});

	it("throws for a file that is not there", () => {
		expect(() => checkLocalPdf("file:///cache/gone.pdf")).toThrow();
	});
});

describe("pickPdf", () => {
	it("asks for one PDF, copied where the app can read it", async () => {
		await pickPdf();
		expect(openings()).toEqual([{ type: PDF_MEDIA_TYPE, copyToCacheDirectory: true, multiple: false }]);
	});

	it("names the picked file", async () => {
		pickNext({ uri: PICKED_URI, name: "statement.pdf", mimeType: PDF_MEDIA_TYPE, size: PDF_BYTES.length, lastModified: 0 });
		await expect(pickPdf()).resolves.toEqual({ kind: "picked", uri: PICKED_URI, fileName: "statement.pdf" });
	});

	it("is null when the person backs out", async () => {
		await expect(pickPdf()).resolves.toBeNull();
	});

	it("rejects when the picker cannot open", async () => {
		failNext(new Error("picker unavailable"));
		await expect(pickPdf()).rejects.toThrow("picker unavailable");
	});
});

describe("sharePdf", () => {
	it("hands the file over as a PDF, titled with its name", async () => {
		await sharePdf(PICKED_URI, "statement.pdf");
		expect(shares()).toEqual([{ url: PICKED_URI, options: { mimeType: PDF_MEDIA_TYPE, UTI: PDF_UTI, dialogTitle: "statement.pdf" } }]);
	});

	it("rejects when no app takes it", async () => {
		failNextShare(new Error("no app"));
		await expect(sharePdf(PICKED_URI, "statement.pdf")).rejects.toThrow("no app");
	});
});

describe("writeSamplePdf", () => {
	it("writes a valid PDF into the cache and names it", () => {
		const source = writeSamplePdf();

		const sampleUri = `file:///cache/${PDF_DOWNLOADS_FOLDER}/${SAMPLE_PDF_NAME}`;
		expect(source).toEqual({ kind: "picked", uri: sampleUri, fileName: SAMPLE_PDF_NAME });
		expect(checkLocalPdf(sampleUri)).toEqual({ ok: true });
	});
});
