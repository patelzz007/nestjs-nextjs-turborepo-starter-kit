import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { PdfOpenFailure } from "@workspace/shared";
import * as React from "react";
import { PixelRatio } from "react-native";

import { MAX_PDF_PAGE_RENDER_WIDTH_PX, type PdfPageSize, type PdfTextMatch } from "../../lib/pdf-viewer-layout";
import { DEFAULT_PDF_VIEWER_LABELS, PdfViewer, type PdfPageRenderer, type PdfViewerState } from "../pdf-viewer";

const VIEWER = "viewer";
const LETTER: PdfPageSize = { width: 612, height: 792 };
const THREE_PAGES: PdfViewerState = { status: "ready", pages: [LETTER, LETTER, LETTER] };
/** A phone-width viewer: 390 pt wide, so a page is 390 − 2 × 12 = 366 pt wide at fit-width. */
const VIEWPORT = { width: 390, height: 700 };
const FIT_WIDTH_PAGE = 366;

/** A renderer that answers every page at once, naming the page and width it was asked for. */
function instantRenderer(): jest.Mock<Promise<string>, [number, number]> {
	return jest.fn<Promise<string>, [number, number]>((pageIndex: number, widthPx: number): Promise<string> =>
		Promise.resolve(`file:///cache/page-${String(pageIndex)}-${String(widthPx)}.png`),
	);
}

/** Gives the page area its size, as the native layout pass would. */
async function layOut(): Promise<void> {
	await fireEvent(screen.getByTestId(`${VIEWER}-viewport`), "layout", { nativeEvent: { layout: { x: 0, y: 0, ...VIEWPORT } } });
}

async function renderViewer(state: PdfViewerState, renderPage: PdfPageRenderer, extra: Partial<React.ComponentProps<typeof PdfViewer>> = {}): Promise<void> {
	await render(<PdfViewer state={state} renderPage={renderPage} testID={VIEWER} {...extra} />);
}

beforeEach(() => {
	jest.spyOn(PixelRatio, "get").mockReturnValue(2);
});

describe("PdfViewer — before the document is open", () => {
	it("shows a page-shaped skeleton, announced as loading", async () => {
		await renderViewer({ status: "loading" }, instantRenderer());

		expect(screen.getByRole("progressbar", { name: DEFAULT_PDF_VIEWER_LABELS.loading })).toBeOnTheScreen();
		expect(screen.queryByRole("toolbar")).toBeNull();
	});

	it("says why a document failed, with a retry and a way to another app", async () => {
		const onRetry = jest.fn<undefined, []>();
		const onOpenExternally = jest.fn<undefined, []>();
		await renderViewer({ status: "failed", failure: "password_protected" }, instantRenderer(), { onRetry, onOpenExternally });

		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.failureTitle)).toBeOnTheScreen();
		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.failures.password_protected)).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.retry }));
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.openExternally }));
		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(onOpenExternally).toHaveBeenCalledTimes(1);
	});

	it.each<[PdfOpenFailure]>([["not_a_pdf"], ["empty"]])("does not offer another app for a file that is no PDF at all (%s)", async (failure) => {
		await renderViewer({ status: "failed", failure }, instantRenderer(), { onOpenExternally: jest.fn<undefined, []>() });

		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.failures[failure])).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.openExternally })).toBeNull();
	});

	it("leaves out the actions it was given no handler for", async () => {
		await renderViewer({ status: "failed", failure: "unavailable" }, instantRenderer());

		expect(screen.queryByRole("button")).toBeNull();
	});

	it("offers another app when this device cannot draw pages", async () => {
		const onOpenExternally = jest.fn<undefined, []>();
		await renderViewer({ status: "external" }, instantRenderer(), { onOpenExternally });

		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.externalTitle)).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.openExternally }));
		expect(onOpenExternally).toHaveBeenCalledTimes(1);
	});
});

describe("PdfViewer — an open document", () => {
	it("renders each visible page at the screen's density and names it for screen readers", async () => {
		const renderPage = instantRenderer();
		await renderViewer(THREE_PAGES, renderPage);
		await layOut();

		expect(renderPage).toHaveBeenCalledWith(0, FIT_WIDTH_PAGE * 2);
		const firstPage = screen.getByRole("image", { name: "Page 1 of 3" });
		expect(firstPage).toHaveStyle({ width: FIT_WIDTH_PAGE, height: (FIT_WIDTH_PAGE * LETTER.height) / LETTER.width });
		expect(screen.getByTestId(`${VIEWER}-page-1-image`)).toHaveProp(
			"source",
			expect.arrayContaining([expect.objectContaining({ uri: `file:///cache/page-0-${String(FIT_WIDTH_PAGE * 2)}.png` })]),
		);
	});

	it("shows where you are, and moves a page at a time within the document", async () => {
		await renderViewer(THREE_PAGES, instantRenderer());
		await layOut();

		expect(screen.getByText("1 / 3")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.previousPage })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.nextPage }));
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.nextPage }));
		expect(screen.getByText("3 / 3")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.nextPage })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.previousPage }));
		expect(screen.getByText("2 / 3")).toBeOnTheScreen();
	});

	it("follows the page in the middle of the screen as it scrolls", async () => {
		await renderViewer(THREE_PAGES, instantRenderer());
		await layOut();

		const pageSlot = (FIT_WIDTH_PAGE * LETTER.height) / LETTER.width + 12;
		await fireEvent.scroll(screen.getByTestId(`${VIEWER}-pages`), {
			nativeEvent: { contentOffset: { x: 0, y: pageSlot * 2 }, layoutMeasurement: VIEWPORT, contentSize: { width: FIT_WIDTH_PAGE, height: pageSlot * 3 } },
		});
		expect(screen.getByText("3 / 3")).toBeOnTheScreen();
	});

	it("zooms in steps, re-rendering pages sharper, and back out to fit-width", async () => {
		const renderPage = instantRenderer();
		await renderViewer(THREE_PAGES, renderPage);
		await layOut();

		expect(screen.getByText("100%")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.zoomOut })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.zoomIn }));
		expect(screen.getByText("125%")).toBeOnTheScreen();
		expect(renderPage).toHaveBeenCalledWith(0, Math.round(FIT_WIDTH_PAGE * 1.25 * 2));

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.zoomIn }));
		expect(screen.getByText("150%")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.zoomIn }));
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.zoomIn }));
		expect(screen.getByText("300%")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.zoomIn })).toBeDisabled();
		expect(renderPage).toHaveBeenLastCalledWith(expect.any(Number), MAX_PDF_PAGE_RENDER_WIDTH_PX);

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.zoomOut }));
		expect(screen.getByText("200%")).toBeOnTheScreen();
	});

	it("tells which page could not be drawn, and keeps the others", async () => {
		const renderPage = jest.fn<Promise<string>, [number, number]>((pageIndex: number): Promise<string> =>
			pageIndex === 1 ? Promise.reject(new Error("bitmap allocation failed")) : Promise.resolve(`file:///cache/page-${String(pageIndex)}.png`),
		);
		await renderViewer(THREE_PAGES, renderPage);
		await layOut();

		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.pageFailed)).toBeOnTheScreen();
		expect(screen.getByTestId(`${VIEWER}-page-1-image`)).toBeOnTheScreen();
	});

	it("ignores a page that finishes rendering after the viewer is gone", async () => {
		const pending: { resolve: ((uri: string) => void) | null } = { resolve: null };
		const renderPage = jest.fn<Promise<string>, [number, number]>(
			(): Promise<string> =>
				new Promise<string>((resolve: (uri: string) => void): void => {
					pending.resolve = resolve;
				}),
		);
		await renderViewer({ status: "ready", pages: [LETTER] }, renderPage);
		await layOut();
		await screen.unmount();

		await act(async (): Promise<void> => {
			pending.resolve?.("file:///cache/late.png");
			await Promise.resolve();
		});
		expect(renderPage).toHaveBeenCalledTimes(1);
	});

	it("offers another app from the toolbar when the caller handles it", async () => {
		const onOpenExternally = jest.fn<undefined, []>();
		await renderViewer(THREE_PAGES, instantRenderer(), { onOpenExternally });

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.openExternally }));
		expect(onOpenExternally).toHaveBeenCalledTimes(1);
	});

	it("says so when the document has no pages", async () => {
		await renderViewer({ status: "ready", pages: [] }, instantRenderer());
		await layOut();

		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.empty)).toBeOnTheScreen();
	});

	it('shows the page as a short "1 / 3" that screen readers hear as "Page 1 of 3"', async () => {
		await renderViewer(THREE_PAGES, instantRenderer());
		await layOut();

		expect(screen.getByText("1 / 3")).toHaveProp("accessibilityLabel", "Page 1 of 3");
		expect(DEFAULT_PDF_VIEWER_LABELS.pageIndicatorShort(2, 12)).toBe("2 / 12");
	});

	it("uses the caller's words and frame", async () => {
		await renderViewer(THREE_PAGES, instantRenderer(), {
			labels: { pageIndicatorShort: (page: number, pageCount: number): string => `${String(page)}/${String(pageCount)}`, zoomIn: "Agrandir" },
			variant: "flush",
		});
		await layOut();

		expect(screen.getByText("1/3")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Agrandir" })).toBeOnTheScreen();
		expect(screen.getByTestId(VIEWER)).toHaveProp("className", expect.not.stringContaining("border"));
	});
});

/** Two matches on the second page and one on the third: one box each. */
const MATCHES: readonly PdfTextMatch[] = [
	{ pageIndex: 1, rects: [{ left: 0.1, top: 0.1, width: 0.2, height: 0.02 }] },
	{ pageIndex: 1, rects: [{ left: 0.1, top: 0.5, width: 0.2, height: 0.02 }] },
	{ pageIndex: 2, rects: [{ left: 0.4, top: 0.3, width: 0.2, height: 0.02 }] },
];

/** Opens the search row and searches for `query`. */
async function searchFor(query: string): Promise<void> {
	await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.search }));
	const input = screen.getByTestId(`${VIEWER}-search-input`);
	await fireEvent.changeText(input, query);
	await fireEvent(input, "submitEditing");
}

describe("PdfViewer — search", () => {
	it("offers search only when the caller can search", async () => {
		await renderViewer(THREE_PAGES, instantRenderer());

		expect(screen.queryByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.search })).toBeNull();
	});

	it("asks for the trimmed query, says which match is shown, and highlights the matches on the pages", async () => {
		const onSearch = jest.fn<Promise<readonly PdfTextMatch[]>, [string]>((): Promise<readonly PdfTextMatch[]> => Promise.resolve(MATCHES));
		await renderViewer(THREE_PAGES, instantRenderer(), { onSearch });
		await layOut();

		await searchFor("  balance ");

		expect(onSearch).toHaveBeenCalledWith("balance");
		expect(await screen.findByText(DEFAULT_PDF_VIEWER_LABELS.matchIndicator(1, 3))).toBeOnTheScreen();
		expect(screen.getByText("2 / 3")).toBeOnTheScreen();
		// The boxes are decorative, hidden from screen readers: the search row announces the match.
		expect(screen.getAllByTestId(`${VIEWER}-page-2-highlight-active`, { includeHiddenElements: true })).toHaveLength(1);
		expect(screen.getAllByTestId(`${VIEWER}-page-2-highlight`, { includeHiddenElements: true })).toHaveLength(1);
	});

	it("steps through the matches, wrapping at either end", async () => {
		await renderViewer(THREE_PAGES, instantRenderer(), { onSearch: (): Promise<readonly PdfTextMatch[]> => Promise.resolve(MATCHES) });
		await layOut();
		await searchFor("balance");
		await screen.findByText(DEFAULT_PDF_VIEWER_LABELS.matchIndicator(1, 3));

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.previousMatch }));
		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.matchIndicator(3, 3))).toBeOnTheScreen();
		expect(screen.getByText("3 / 3")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.nextMatch }));
		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.matchIndicator(1, 3))).toBeOnTheScreen();
	});

	it("says when nothing matched or the search failed, with nothing to step through", async () => {
		const none = jest.fn<Promise<readonly PdfTextMatch[]>, [string]>((): Promise<readonly PdfTextMatch[]> => Promise.resolve([]));
		await renderViewer(THREE_PAGES, instantRenderer(), { onSearch: none });
		await layOut();
		await searchFor("zebra");
		expect(await screen.findByText(DEFAULT_PDF_VIEWER_LABELS.noMatches)).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.nextMatch })).toBeDisabled();
		await screen.unmount();

		await renderViewer(THREE_PAGES, instantRenderer(), { onSearch: (): Promise<readonly PdfTextMatch[]> => Promise.reject(new Error("engine")) });
		await layOut();
		await searchFor("zebra");
		expect(await screen.findByText(DEFAULT_PDF_VIEWER_LABELS.searchFailed)).toBeOnTheScreen();
	});

	it("does not search for nothing, and clears the highlights when closed", async () => {
		const onSearch = jest.fn<Promise<readonly PdfTextMatch[]>, [string]>((): Promise<readonly PdfTextMatch[]> => Promise.resolve(MATCHES));
		await renderViewer(THREE_PAGES, instantRenderer(), { onSearch });
		await layOut();

		await searchFor("   ");
		expect(onSearch).not.toHaveBeenCalled();

		await fireEvent.changeText(screen.getByTestId(`${VIEWER}-search-input`), "balance");
		await fireEvent(screen.getByTestId(`${VIEWER}-search-input`), "submitEditing");
		await screen.findByText(DEFAULT_PDF_VIEWER_LABELS.matchIndicator(1, 3));
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.closeSearch }));

		expect(screen.queryByTestId(`${VIEWER}-search-bar`)).toBeNull();
		expect(screen.queryByTestId(`${VIEWER}-page-2-highlight-active`, { includeHiddenElements: true })).toBeNull();
	});

	it("shows only the latest search's answer", async () => {
		const answers: ((matches: readonly PdfTextMatch[]) => void)[] = [];
		const onSearch = (): Promise<readonly PdfTextMatch[]> =>
			new Promise<readonly PdfTextMatch[]>((resolve): void => {
				answers.push(resolve);
			});
		await renderViewer(THREE_PAGES, instantRenderer(), { onSearch });
		await layOut();
		await searchFor("first");
		await fireEvent(screen.getByTestId(`${VIEWER}-search-input`), "submitEditing");
		const [first, second] = answers;

		await act(async (): Promise<void> => {
			second?.([]);
			first?.(MATCHES);
			await Promise.resolve();
		});

		expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.noMatches)).toBeOnTheScreen();
	});
});

describe("PdfViewer — document actions", () => {
	it("puts Download and Open in… behind More when it has both", async () => {
		const onDownload = jest.fn<undefined, []>();
		const onOpenExternally = jest.fn<undefined, []>();
		await renderViewer(THREE_PAGES, instantRenderer(), { onDownload, onOpenExternally });

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.moreActions }));
		await fireEvent.press(await screen.findByText(DEFAULT_PDF_VIEWER_LABELS.download));
		expect(onDownload).toHaveBeenCalledTimes(1);

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.moreActions }));
		await fireEvent.press(await screen.findByText(DEFAULT_PDF_VIEWER_LABELS.openExternally));
		expect(onOpenExternally).toHaveBeenCalledTimes(1);
	});

	it("shows a lone Download as its own button", async () => {
		const onDownload = jest.fn<undefined, []>();
		await renderViewer(THREE_PAGES, instantRenderer(), { onDownload });

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.download }));

		expect(onDownload).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.moreActions })).toBeNull();
	});
});
