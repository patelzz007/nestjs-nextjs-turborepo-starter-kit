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
