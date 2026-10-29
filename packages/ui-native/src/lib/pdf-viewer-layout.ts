// The PdfViewer's arithmetic, kept pure so every rule is tested without a
// renderer: which zoom steps exist, how wide a page is drawn and rendered,
// where each page sits in the scrolling list and which page is on screen.
// Page sizes are in PDF points (1/72 inch), as the platform engines report
// them; on screen a page is scaled to the viewer's width times the zoom.

/** The zoom steps, as multiples of "page fits the viewer's width" (1). There is no point zooming out past fit-width on a phone. */
export const PDF_ZOOM_STEPS: readonly number[] = [1, 1.25, 1.5, 2, 3];

/** Fit-width: the zoom the viewer opens at. */
export const PDF_FIT_WIDTH_ZOOM = 1;

/**
 * The widest bitmap one page is rendered at, in pixels. A 3× zoom on a 3× phone
 * would ask for ~3,500 px (≈50 MB per A4 page as ARGB); past this the page is
 * scaled up instead — still sharp enough to read, and memory stays bounded.
 */
export const MAX_PDF_PAGE_RENDER_WIDTH_PX = 2048;

/** A zoom of 1 is 100%. */
const PERCENT = 100;

/** A page's size in PDF points. */
export interface PdfPageSize {
	readonly width: number;
	readonly height: number;
}

/** Where one page sits in the list: its drawn height and its offset from the top, in layout points. */
export interface PdfPageLayout {
	readonly length: number;
	readonly offset: number;
	readonly index: number;
}

/** The zoom step after `zoom`, or `zoom` itself at the largest step. */
export function nextPdfZoom(zoom: number): number {
	return PDF_ZOOM_STEPS.find((step: number): boolean => step > zoom) ?? zoom;
}

/** The zoom step before `zoom`, or `zoom` itself at fit-width. */
export function previousPdfZoom(zoom: number): number {
	return PDF_ZOOM_STEPS.findLast((step: number): boolean => step < zoom) ?? zoom;
}

/** "150%" — the zoom as the toolbar shows it. */
export function formatPdfZoom(zoom: number): string {
	return `${String(Math.round(zoom * PERCENT))}%`;
}

/** `index` moved inside `0 … pageCount - 1` (0 for a document without pages). */
export function clampPdfPageIndex(index: number, pageCount: number): number {
	return Math.min(Math.max(0, Math.round(index)), Math.max(0, pageCount - 1));
}

/** The height a page is drawn at when it is `displayWidth` wide, keeping its proportions. */
export function pdfPageDisplayHeight(page: PdfPageSize, displayWidth: number): number {
	return page.width <= 0 ? 0 : (displayWidth * page.height) / page.width;
}

/** The bitmap width to render a page drawn `displayWidth` wide on a screen of `pixelRatio`, capped at {@link MAX_PDF_PAGE_RENDER_WIDTH_PX}. */
export function pdfPageRenderWidthPx(displayWidth: number, pixelRatio: number): number {
	return Math.max(1, Math.min(MAX_PDF_PAGE_RENDER_WIDTH_PX, Math.round(displayWidth * pixelRatio)));
}

/** Each page's place in the list (with `gap` between pages), for FlatList's `getItemLayout`. */
export function pdfPageLayouts(pages: readonly PdfPageSize[], displayWidth: number, gap: number): PdfPageLayout[] {
	const layouts: PdfPageLayout[] = [];
	let offset = 0;
	pages.forEach((page: PdfPageSize, index: number): void => {
		const length = pdfPageDisplayHeight(page, displayWidth) + gap;
		layouts.push({ length, offset, index });
		offset += length;
	});
	return layouts;
}

/**
 * The page shown at a scroll position: the last page whose top is above the
 * viewport's middle — so a page counts as "current" once it fills most of the
 * screen, not the moment its top edge appears.
 */
export function pdfPageIndexAt(scrollOffset: number, viewportHeight: number, layouts: readonly PdfPageLayout[]): number {
	const middle = scrollOffset + viewportHeight / 2;
	const current = layouts.findLast((layout: PdfPageLayout): boolean => layout.offset <= middle);
	return current?.index ?? 0;
}

// ── Search ──────────────────────────────────────────────────────────────────
// A search match arrives from the app's engine as boxes in fractions of the
// page (0 at its left / top edge, 1 at its right / bottom edge), so the viewer
// can draw it over the page at any width and zoom.

/** One box of a match, as fractions of the page as it is shown (top-left origin). */
export interface PdfTextBox {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

/** One match of a search: the page it is on (0-based) and its boxes, one per line it spans. */
export interface PdfTextMatch {
	readonly pageIndex: number;
	readonly rects: readonly PdfTextBox[];
}

/** A highlight's place over a page drawn `pageWidth` × `pageHeight` points, kept inside the page. */
export interface PdfHighlightFrame {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

const PAGE_START = 0;
const PAGE_END = 1;

/** Room around a highlighted word, in points, so the highlight frames it instead of hugging the letters. */
export const PDF_HIGHLIGHT_PADDING_X = 3;
export const PDF_HIGHLIGHT_PADDING_Y = 2;

function clamp(value: number, max: number): number {
	return Math.min(Math.max(value, PAGE_START), max);
}

/**
 * Where `box` is drawn over a page `pageWidth` × `pageHeight` points big: grown by the highlight's
 * padding on every side, and cut at the page's edges so it never spills off the page.
 */
export function pdfHighlightFrame(box: PdfTextBox, pageWidth: number, pageHeight: number): PdfHighlightFrame {
	const left = clamp(box.left * pageWidth - PDF_HIGHLIGHT_PADDING_X, pageWidth);
	const top = clamp(box.top * pageHeight - PDF_HIGHLIGHT_PADDING_Y, pageHeight);
	const right = clamp((box.left + box.width) * pageWidth + PDF_HIGHLIGHT_PADDING_X, pageWidth);
	const bottom = clamp((box.top + box.height) * pageHeight + PDF_HIGHLIGHT_PADDING_Y, pageHeight);
	return { left, top, width: right - left, height: bottom - top };
}

/** The match to show first: the first one on or after the page the person is reading, else the first of all. */
export function firstPdfMatchFrom(matches: readonly PdfTextMatch[], pageIndex: number): number {
	const onward = matches.findIndex((match: PdfTextMatch): boolean => match.pageIndex >= pageIndex);
	return Math.max(onward, PAGE_START);
}

/** Search directions: the next match or the previous one. */
export type PdfMatchStep = "next" | "previous";

/** The match after (or before) `current`, wrapping around at either end. */
export function stepPdfMatch(current: number, total: number, step: PdfMatchStep): number {
	if (total <= PAGE_START) {
		return PAGE_START;
	}
	const offset = step === "next" ? PAGE_END : -PAGE_END;
	return (current + offset + total) % total;
}
