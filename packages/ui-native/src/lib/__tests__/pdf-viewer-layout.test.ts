import {
	clampPdfPageIndex,
	firstPdfMatchFrom,
	PDF_HIGHLIGHT_PADDING_X,
	PDF_HIGHLIGHT_PADDING_Y,
	pdfHighlightFrame,
	stepPdfMatch,
	type PdfTextMatch,
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

const PAGE_WIDTH = 300;
const PAGE_HEIGHT = 400;

/** Compares a frame field by field, to well under a point (fractions of a page are not exact in floating point). */
function expectFrame(actual: ReturnType<typeof pdfHighlightFrame>, expected: ReturnType<typeof pdfHighlightFrame>): void {
	expect(actual.left).toBeCloseTo(expected.left);
	expect(actual.top).toBeCloseTo(expected.top);
	expect(actual.width).toBeCloseTo(expected.width);
	expect(actual.height).toBeCloseTo(expected.height);
}

describe("pdfHighlightFrame", () => {
	it("places a box drawn in fractions of the page over the page as drawn, with room around the word", () => {
		expectFrame(pdfHighlightFrame({ left: 0.1, top: 0.25, width: 0.5, height: 0.05 }, PAGE_WIDTH, PAGE_HEIGHT), {
			left: 30 - PDF_HIGHLIGHT_PADDING_X,
			top: 100 - PDF_HIGHLIGHT_PADDING_Y,
			width: 150 + 2 * PDF_HIGHLIGHT_PADDING_X,
			height: 20 + 2 * PDF_HIGHLIGHT_PADDING_Y,
		});
	});

	it("never lets the padding or a spilling box run off the page", () => {
		expectFrame(pdfHighlightFrame({ left: -0.1, top: 0.95, width: 0.3, height: 0.1 }, PAGE_WIDTH, PAGE_HEIGHT), {
			left: 0,
			top: 380 - PDF_HIGHLIGHT_PADDING_Y,
			width: 60 + PDF_HIGHLIGHT_PADDING_X,
			height: 20 + PDF_HIGHLIGHT_PADDING_Y,
		});
	});
});

const MATCHES: readonly PdfTextMatch[] = [
	{ pageIndex: 0, rects: [] },
	{ pageIndex: 2, rects: [] },
	{ pageIndex: 5, rects: [] },
];

describe("firstPdfMatchFrom", () => {
	it("starts at the first match on or after the page being read", () => {
		expect(firstPdfMatchFrom(MATCHES, 0)).toBe(0);
		expect(firstPdfMatchFrom(MATCHES, 1)).toBe(1);
		expect(firstPdfMatchFrom(MATCHES, 2)).toBe(1);
	});

	it("goes back to the first match when every match is before the page", () => {
		expect(firstPdfMatchFrom(MATCHES, 9)).toBe(0);
		expect(firstPdfMatchFrom([], 3)).toBe(0);
	});
});

describe("stepPdfMatch", () => {
	it("moves to the next and previous match, wrapping at either end", () => {
		expect(stepPdfMatch(0, 3, "next")).toBe(1);
		expect(stepPdfMatch(2, 3, "next")).toBe(0);
		expect(stepPdfMatch(0, 3, "previous")).toBe(2);
		expect(stepPdfMatch(1, 3, "previous")).toBe(0);
	});

	it("stays at the start when there are no matches", () => {
		expect(stepPdfMatch(0, 0, "next")).toBe(0);
	});
});
