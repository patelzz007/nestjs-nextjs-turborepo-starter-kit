import {
	clampPdfPageIndex,
	formatPdfZoom,
	MAX_PDF_PAGE_RENDER_WIDTH_PX,
	nextPdfZoom,
	PDF_FIT_WIDTH_ZOOM,
	PDF_ZOOM_STEPS,
	pdfPageDisplayHeight,
	pdfPageIndexAt,
	pdfPageLayouts,
	pdfPageRenderWidthPx,
	previousPdfZoom,
	type PdfPageSize,
} from "../pdf-viewer-layout";

/** US Letter and A4 landscape, in points. */
const LETTER: PdfPageSize = { width: 612, height: 792 };
const A4_LANDSCAPE: PdfPageSize = { width: 842, height: 595 };

describe("zoom steps", () => {
	it("opens at fit-width, the smallest step", () => {
		expect(PDF_FIT_WIDTH_ZOOM).toBe(Math.min(...PDF_ZOOM_STEPS));
	});

	it("moves one step at a time and stays put at either end", () => {
		expect(nextPdfZoom(1)).toBe(1.25);
		expect(nextPdfZoom(2)).toBe(3);
		expect(nextPdfZoom(3)).toBe(3);
		expect(previousPdfZoom(3)).toBe(2);
		expect(previousPdfZoom(1.25)).toBe(1);
		expect(previousPdfZoom(1)).toBe(1);
	});

	it("snaps a zoom between steps to the neighbouring step", () => {
		expect(nextPdfZoom(1.1)).toBe(1.25);
		expect(previousPdfZoom(1.1)).toBe(1);
	});

	it("shows the zoom as a whole percentage", () => {
		expect(formatPdfZoom(1)).toBe("100%");
		expect(formatPdfZoom(1.25)).toBe("125%");
		expect(formatPdfZoom(1.333)).toBe("133%");
	});
});

describe("clampPdfPageIndex", () => {
	it("keeps an index inside the document", () => {
		expect(clampPdfPageIndex(-1, 5)).toBe(0);
		expect(clampPdfPageIndex(2, 5)).toBe(2);
		expect(clampPdfPageIndex(9, 5)).toBe(4);
	});

	it("rounds a fractional index and is 0 for a document without pages", () => {
		expect(clampPdfPageIndex(1.6, 5)).toBe(2);
		expect(clampPdfPageIndex(3, 0)).toBe(0);
	});
});

describe("page sizes", () => {
	it("keeps a page's proportions at the drawn width", () => {
		expect(pdfPageDisplayHeight(LETTER, 306)).toBe(396);
		expect(pdfPageDisplayHeight(A4_LANDSCAPE, 842)).toBe(595);
	});

	it("draws a page without width as nothing rather than dividing by zero", () => {
		expect(pdfPageDisplayHeight({ width: 0, height: 100 }, 300)).toBe(0);
	});

	it("renders at the screen's pixel density, never past the cap, never below one pixel", () => {
		expect(pdfPageRenderWidthPx(360, 3)).toBe(1080);
		expect(pdfPageRenderWidthPx(360.4, 2)).toBe(721);
		expect(pdfPageRenderWidthPx(1080, 3)).toBe(MAX_PDF_PAGE_RENDER_WIDTH_PX);
		expect(pdfPageRenderWidthPx(0, 3)).toBe(1);
	});
});

describe("page layouts", () => {
	const GAP = 10;
	const layouts = pdfPageLayouts([LETTER, A4_LANDSCAPE, LETTER], 612, GAP);

	it("gives each page its height plus the gap, one after the other", () => {
		expect(layouts).toEqual([
			{ index: 0, offset: 0, length: 792 + GAP },
			{ index: 1, offset: 802, length: (612 * 595) / 842 + GAP },
			{ index: 2, offset: 802 + (612 * 595) / 842 + GAP, length: 792 + GAP },
		]);
	});

	it("has no layouts for no pages", () => {
		expect(pdfPageLayouts([], 300, GAP)).toEqual([]);
	});

	it("names the page that fills the viewport's middle as the current one", () => {
		const viewport = 600;
		expect(pdfPageIndexAt(0, viewport, layouts)).toBe(0);
		expect(pdfPageIndexAt(800 - viewport / 2, viewport, layouts)).toBe(0);
		expect(pdfPageIndexAt(805 - viewport / 2, viewport, layouts)).toBe(1);
		expect(pdfPageIndexAt(10_000, viewport, layouts)).toBe(2);
	});

	it("is on the first page of an empty list", () => {
		expect(pdfPageIndexAt(100, 600, [])).toBe(0);
	});
});
