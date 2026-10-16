// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { MAX_PDF_VIEWER_FILE_BYTES, PDF_MEDIA_TYPE } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePdfDocument, type PdfDocumentState, type PdfViewerSource } from "../use-pdf-document";

interface HookProps {
	readonly source: PdfViewerSource | null;
}

const PDF_BYTES = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n";
const BLOB_URL = "blob:http://localhost/0f2c";

const createObjectURL = vi.fn((_object: Blob): string => BLOB_URL);
const revokeObjectURL = vi.fn((): void => undefined);

beforeEach(() => {
	URL.createObjectURL = createObjectURL;
	URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function pdfFile(name = "invoice.pdf", type = PDF_MEDIA_TYPE): File {
	return new File([PDF_BYTES], name, { type });
}

function fileSource(file: File): PdfViewerSource {
	return { kind: "file", file };
}

describe("usePdfDocument", () => {
	it("is idle with no source", () => {
		const { result } = renderHook(() => usePdfDocument(null));
		expect(result.current).toEqual({ status: "idle" });
	});

	it("hands a signed URL straight to the frame, downloading from the attachment URL when there is one", () => {
		const { result, rerender } = renderHook(({ source }: { source: PdfViewerSource }) => usePdfDocument(source), {
			initialProps: { source: { kind: "url", url: "https://files.example/a?sig=1", fileName: "a.pdf" } },
		});
		expect(result.current).toEqual({ status: "ready", fileName: "a.pdf", viewUrl: "https://files.example/a?sig=1", downloadUrl: "https://files.example/a?sig=1" });
		rerender({ source: { kind: "url", url: "https://files.example/a?sig=1", fileName: "a.pdf", downloadUrl: "https://files.example/a?sig=2" } });
		expect(result.current).toMatchObject({ downloadUrl: "https://files.example/a?sig=2" });
		expect(createObjectURL).not.toHaveBeenCalled();
	});

	it("checks a picked PDF, then shows it from a blob URL", async () => {
		const file = pdfFile();
		const source = fileSource(file);
		const { result } = renderHook(() => usePdfDocument(source));
		expect(result.current).toEqual({ status: "checking", fileName: "invoice.pdf" });
		await waitFor(() => {
			expect(result.current).toEqual({ status: "ready", fileName: "invoice.pdf", viewUrl: BLOB_URL, downloadUrl: BLOB_URL });
		});
		expect(createObjectURL).toHaveBeenCalledWith(file);
	});

	it("re-types a PDF the OS did not label as one, so the browser still renders it", async () => {
		const source = fileSource(pdfFile("scan", ""));
		const { result } = renderHook(() => usePdfDocument(source));
		await waitFor(() => {
			expect(result.current.status).toBe("ready");
		});
		const [call] = createObjectURL.mock.calls;
		const blob = call?.at(0);
		expect(blob).toBeInstanceOf(Blob);
		expect(blob).not.toBeInstanceOf(File);
		expect(blob?.type).toBe(PDF_MEDIA_TYPE);
	});

	it("rejects a picked file that is not a PDF, without creating a URL", async () => {
		const source = fileSource(new File(["<html></html>"], "page.pdf", { type: PDF_MEDIA_TYPE }));
		const { result } = renderHook(() => usePdfDocument(source));
		await waitFor(() => {
			expect(result.current).toEqual({ status: "failed", fileName: "page.pdf", failure: "not_a_pdf" });
		});
		expect(createObjectURL).not.toHaveBeenCalled();
	});

	it("rejects an empty file and a file over the size limit", async () => {
		const emptySource = fileSource(new File([], "empty.pdf"));
		const empty = renderHook(() => usePdfDocument(emptySource));
		await waitFor(() => {
			expect(empty.result.current).toMatchObject({ status: "failed", failure: "empty" });
		});
		const large = pdfFile("large.pdf");
		Object.defineProperty(large, "size", { value: MAX_PDF_VIEWER_FILE_BYTES + 1 });
		const largeSource = fileSource(large);
		const tooLarge = renderHook(() => usePdfDocument(largeSource));
		await waitFor(() => {
			expect(tooLarge.result.current).toMatchObject({ status: "failed", failure: "too_large" });
		});
	});

	it("reports a file the browser cannot read as unavailable", async () => {
		const file = pdfFile();
		vi.spyOn(file, "slice").mockImplementation((): Blob => {
			throw new DOMException("The file was moved", "NotReadableError");
		});
		const source = fileSource(file);
		const { result } = renderHook(() => usePdfDocument(source));
		await waitFor(() => {
			expect(result.current).toEqual({ status: "failed", fileName: "invoice.pdf", failure: "unavailable" });
		});
	});

	it("revokes the blob URL when the file changes and when the viewer unmounts", async () => {
		const { result, rerender, unmount } = renderHook<PdfDocumentState, HookProps>(({ source }: HookProps) => usePdfDocument(source), {
			initialProps: { source: fileSource(pdfFile()) },
		});
		await waitFor(() => {
			expect(result.current.status).toBe("ready");
		});
		rerender({ source: fileSource(pdfFile("second.pdf")) });
		expect(revokeObjectURL).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(result.current).toMatchObject({ status: "ready", fileName: "second.pdf" });
		});
		unmount();
		expect(revokeObjectURL).toHaveBeenCalledTimes(2);
	});

	it("revokes the URL of a file replaced before it finished checking", async () => {
		const { result, rerender } = renderHook<PdfDocumentState, HookProps>(({ source }: HookProps) => usePdfDocument(source), {
			initialProps: { source: fileSource(pdfFile()) },
		});
		rerender({ source: null });
		expect(result.current).toEqual({ status: "idle" });
		await waitFor(() => {
			expect(revokeObjectURL).toHaveBeenCalledWith(BLOB_URL);
		});
	});
});
