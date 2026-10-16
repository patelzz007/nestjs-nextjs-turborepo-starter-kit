import { DEFAULT_PDF_FILE_NAME } from "@workspace/shared";

import { ROUTES } from "../../../runtime/routes";
import { PDF_SOURCE_NAME_MAX_LENGTH, pdfSourceOfRouteParams, pdfViewerHref } from "../pdf-source";

const SIGNED_URL = "https://storage.example.com/kyb/statement.pdf?X-Amz-Signature=abc";

describe("pdfSourceOfRouteParams", () => {
	it("reads a web address and its name", () => {
		expect(pdfSourceOfRouteParams({ url: SIGNED_URL, name: "Bank statement.pdf" })).toEqual({ kind: "remote", url: SIGNED_URL, fileName: "Bank statement.pdf" });
	});

	it("accepts plain http, which local object storage serves", () => {
		expect(pdfSourceOfRouteParams({ url: "http://localhost:9000/bucket/a.pdf" })).toEqual({
			kind: "remote",
			url: "http://localhost:9000/bucket/a.pdf",
			fileName: DEFAULT_PDF_FILE_NAME,
		});
	});

	it("falls back to a generic name for a missing, blank or overlong one", () => {
		expect(pdfSourceOfRouteParams({ url: SIGNED_URL, name: "  " })?.fileName).toBe(DEFAULT_PDF_FILE_NAME);
		expect(pdfSourceOfRouteParams({ url: SIGNED_URL, name: "a".repeat(PDF_SOURCE_NAME_MAX_LENGTH + 1) })?.fileName).toBe(DEFAULT_PDF_FILE_NAME);
		expect(pdfSourceOfRouteParams({ url: SIGNED_URL, name: ["a", "b"] })?.fileName).toBe(DEFAULT_PDF_FILE_NAME);
	});

	it.each([["file:///etc/hosts"], ["content://downloads/1"], ["javascript:alert(1)"], ["starter://settings"], ["not a url"]])("never opens %s", (url: string) => {
		expect(pdfSourceOfRouteParams({ url })).toBeNull();
	});

	it("names no document without an address", () => {
		expect(pdfSourceOfRouteParams({})).toBeNull();
		expect(pdfSourceOfRouteParams({ url: [SIGNED_URL, SIGNED_URL] })).toBeNull();
	});
});

describe("pdfViewerHref", () => {
	it("is the viewer's route with the document as params, which the route reads back", () => {
		const href = pdfViewerHref(SIGNED_URL, "Bank statement.pdf");

		expect(href).toEqual({ pathname: ROUTES.pdfViewer, params: { url: SIGNED_URL, name: "Bank statement.pdf" } });
		expect(pdfSourceOfRouteParams(href.params)).toEqual({ kind: "remote", url: SIGNED_URL, fileName: "Bank statement.pdf" });
	});
});
