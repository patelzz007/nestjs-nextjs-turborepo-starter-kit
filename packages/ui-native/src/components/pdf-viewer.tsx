// A PDF document, page under page, with a toolbar: previous / next page and
// where you are ("Page 2 of 12"), zoom out / in ("150%"), search, and the
// document's actions — "Download" and "Open in…" (behind a "More" menu when
// there are both).
//
// Data-agnostic and controlled: the caller opens the document and passes its
// `state` — loading, failed (why), external (this device cannot draw pages
// in-app, e.g. Expo Go: only "Open in…" is offered), or ready with each
// page's size in PDF points. The caller also supplies `renderPage`, which
// turns one page into a bitmap address at a given pixel width; the viewer
// asks for a page only when it scrolls into view (a virtualised FlatList) and
// asks again, sharper, when the zoom changes. Which engine draws the pages —
// PDFKit, Android's PdfRenderer — is the app's business, not the kit's
// (docs/adr/056-in-house-pdf-viewer.md).
//
// Zoom is in steps of the viewer's width (lib/pdf-viewer-layout.ts): at fit-
// width the pages scroll vertically; zoomed in, the column also scrolls
// sideways. Every word is overridable through `labels`.
//
// Search is offered when the caller passes `onSearch` (its engine can find
// text): a search row opens under the toolbar, the caller answers with every
// match as boxes in fractions of the page (lib/pdf-viewer-layout.ts), and the
// viewer highlights them, jumps to the first match on or after the page being
// read, and steps through the rest (wrapping at either end).

import type { PdfOpenFailure } from "@workspace/shared";
import { cva, type VariantProps } from "class-variance-authority";
import { Image } from "expo-image";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import DownloadIcon from "lucide-react-native/icons/download";
import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import FileTextIcon from "lucide-react-native/icons/file-text";
import FileWarningIcon from "lucide-react-native/icons/file-exclamation-point";
import SearchIcon from "lucide-react-native/icons/search";
import ShareIcon from "lucide-react-native/icons/share";
import XIcon from "lucide-react-native/icons/x";
import ZoomInIcon from "lucide-react-native/icons/zoom-in";
import ZoomOutIcon from "lucide-react-native/icons/zoom-out";
import * as React from "react";
import {
	FlatList,
	type LayoutChangeEvent,
	type ListRenderItemInfo,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	PixelRatio,
	ScrollView,
	Text,
	View,
	type ViewInstance,
	type ViewStyle,
} from "react-native";

import { cn } from "../lib/cn";
import {
	clampPdfPageIndex,
	firstPdfMatchFrom,
	formatPdfZoom,
	nextPdfZoom,
	PDF_FIT_WIDTH_ZOOM,
	pdfHighlightFrame,
	pdfPageDisplayHeight,
	pdfPageIndexAt,
	pdfPageLayouts,
	pdfPageRenderWidthPx,
	previousPdfZoom,
	stepPdfMatch,
	type PdfMatchStep,
	type PdfPageLayout,
	type PdfPageSize,
	type PdfTextBox,
	type PdfTextMatch,
} from "../lib/pdf-viewer-layout";
import { Button } from "./button";
import { DropdownMenu, type DropdownMenuItemData } from "./dropdown-menu";
import { EmptyState } from "./empty";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { Input } from "./input";
import { Skeleton, SkeletonGroup } from "./skeleton";

export const pdfViewerVariants = cva("flex-1 overflow-hidden bg-muted", {
	variants: {
		/** `framed`: a rounded, bordered panel inside a screen. `flush`: edge to edge (a full-screen viewer). */
		variant: {
			framed: "rounded-lg border border-border",
			flush: "",
		},
	},
	defaultVariants: { variant: "framed" },
});

export type PdfViewerVariant = NonNullable<VariantProps<typeof pdfViewerVariants>["variant"]>;

/** What the viewer shows: the caller opens the document and reports how that went. */
export type PdfViewerState =
	| { readonly status: "loading" }
	| { readonly status: "failed"; readonly failure: PdfOpenFailure }
	/** Pages cannot be drawn in-app on this device (no PDF engine, e.g. Expo Go): offer another app instead. */
	| { readonly status: "external" }
	| { readonly status: "ready"; readonly pages: readonly PdfPageSize[] };

/** Every word the viewer shows; the caller may replace any of them (e.g. to translate). */
export interface PdfViewerLabels {
	readonly loading: string;
	readonly previousPage: string;
	readonly nextPage: string;
	readonly zoomIn: string;
	readonly zoomOut: string;
	readonly openExternally: string;
	readonly download: string;
	/** The "More" menu's trigger and title, when there are several document actions. */
	readonly moreActions: string;
	readonly search: string;
	readonly searchPlaceholder: string;
	readonly closeSearch: string;
	readonly previousMatch: string;
	readonly nextMatch: string;
	readonly searching: string;
	readonly noMatches: string;
	readonly searchFailed: string;
	/** "3 of 12" — which match is shown. */
	readonly matchIndicator: (match: number, matchCount: number) => string;
	readonly retry: string;
	readonly empty: string;
	readonly externalTitle: string;
	readonly externalDescription: string;
	readonly pageFailed: string;
	readonly failureTitle: string;
	/** Why the document could not be shown, one sentence per failure. */
	readonly failures: Readonly<Record<PdfOpenFailure, string>>;
	/** "Page 2 of 12" — the toolbar's indicator, as screen readers say it. */
	readonly pageIndicator: (page: number, pageCount: number) => string;
	/** "2 / 12" — the toolbar's indicator as shown: short, so it fits beside the toolbar's buttons on a phone. */
	readonly pageIndicatorShort: (page: number, pageCount: number) => string;
	/** "Page 2 of 12" — each page's name for screen readers. */
	readonly pageImage: (page: number, pageCount: number) => string;
}

function pageOf(page: number, pageCount: number): string {
	return `Page ${String(page)} of ${String(pageCount)}`;
}

function pageOfShort(page: number, pageCount: number): string {
	return `${String(page)} / ${String(pageCount)}`;
}

export const DEFAULT_PDF_VIEWER_LABELS: PdfViewerLabels = {
	loading: "Loading document…",
	previousPage: "Previous page",
	nextPage: "Next page",
	zoomIn: "Zoom in",
	zoomOut: "Zoom out",
	openExternally: "Open in another app",
	download: "Download",
	moreActions: "More actions",
	search: "Search in document",
	searchPlaceholder: "Search in document",
	closeSearch: "Close search",
	previousMatch: "Previous match",
	nextMatch: "Next match",
	searching: "Searching…",
	noMatches: "No matches",
	searchFailed: "Search failed. Try again.",
	matchIndicator: (match: number, matchCount: number): string => `${String(match)} of ${String(matchCount)}`,
	retry: "Try again",
	empty: "This document has no pages.",
	externalTitle: "Open this document in another app",
	externalDescription: "This version of the app cannot show PDF pages itself. Open the document in your phone's PDF viewer instead.",
	pageFailed: "This page could not be shown.",
	failureTitle: "Can't show this document",
	failures: {
		empty: "The file is empty.",
		too_large: "The file is larger than 50 MB. Open it in another app to read it.",
		not_a_pdf: "The file isn't a PDF.",
		password_protected: "The PDF is password protected.",
		unreadable: "The PDF is damaged and can't be read.",
		unavailable: "The file couldn't be loaded. Try again.",
	},
	pageIndicator: pageOf,
	pageIndicatorShort: pageOfShort,
	pageImage: pageOf,
};

/** Turns page `pageIndex` (0-based) into a bitmap `widthPx` pixels wide; resolves with its address. */
export type PdfPageRenderer = (pageIndex: number, widthPx: number) => Promise<string>;

/** Finds `query` in the document: every match, in page order; rejects when the search could not run. */
export type PdfTextSearcher = (query: string) => Promise<readonly PdfTextMatch[]>;

export interface PdfViewerProps {
	readonly state: PdfViewerState;
	readonly renderPage: PdfPageRenderer;
	/** Offered after a failure; without it there is no retry button. */
	readonly onRetry?: (() => void) | undefined;
	/** Hands the document to another app ("Open in…"); without it the action is hidden. */
	readonly onOpenExternally?: (() => void) | undefined;
	/** Saves a copy where the person keeps files ("Download"); without it the action is hidden. */
	readonly onDownload?: (() => void) | undefined;
	/** Finds text in the document; without it there is no search. */
	readonly onSearch?: PdfTextSearcher | undefined;
	readonly labels?: Partial<PdfViewerLabels> | undefined;
	readonly variant?: PdfViewerVariant | undefined;
	/** Extra classes for the frame, merged last (layout: `flex-1`, `min-h-96`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** Space above each page and around the column, in points (each page's slot in the list is its height plus this gap). */
const PAGE_GAP = 12;
/** How often (ms) the list reports its scroll position: often enough for the indicator, rarely enough for the JS thread. */
const SCROLL_EVENT_THROTTLE_MS = 64;
/** Pages kept rendered beyond the viewport, in screens (FlatList `windowSize`): bitmaps are large. */
const PAGE_WINDOW_SIZE = 3;
/** Pages drawn in the first frame. */
const INITIAL_PAGES = 2;
/** The placeholder's proportions before a document is open: an A4 page (210 × 297 mm). */
const PLACEHOLDER_PAGE: PdfPageSize = { width: 210, height: 297 };
/** The loading skeleton's page shape. */
const PLACEHOLDER_PAGE_STYLE = { aspectRatio: PLACEHOLDER_PAGE.width / PLACEHOLDER_PAGE.height };
/** Space on either side of the page column. */
const PAGE_COLUMN_GUTTER_STYLE = { paddingHorizontal: PAGE_GAP };
/** Space below the last page. */
const PAGE_LIST_END_STYLE = { paddingBottom: PAGE_GAP };

/** The `testID` prop of one of the viewer's parts — none when the caller gave the viewer no id. */
function partTestId(testID: string | undefined, part: string): { readonly testID?: string } {
	return testID === undefined ? {} : { testID: `${testID}-${part}` };
}

export const PdfViewer = React.memo(
	React.forwardRef<ViewInstance, PdfViewerProps>(function PdfViewer(
		{ state, renderPage, onRetry, onOpenExternally, onDownload, onSearch, labels, variant = "framed", className, testID },
		ref,
	): React.JSX.Element {
		const text = React.useMemo((): PdfViewerLabels => ({ ...DEFAULT_PDF_VIEWER_LABELS, ...labels }), [labels]);
		return (
			<View ref={ref} testID={testID} className={cn(pdfViewerVariants({ variant }), className)}>
				{state.status === "ready" ? (
					<PdfDocument
						pages={state.pages}
						renderPage={renderPage}
						onOpenExternally={onOpenExternally}
						onDownload={onDownload}
						onSearch={onSearch}
						labels={text}
						testID={testID}
					/>
				) : (
					<PdfStatus state={state} onRetry={onRetry} onOpenExternally={onOpenExternally} labels={text} testID={testID} />
				)}
			</View>
		);
	}),
);

interface PdfStatusProps {
	readonly state: Exclude<PdfViewerState, { readonly status: "ready" }>;
	readonly onRetry: (() => void) | undefined;
	readonly onOpenExternally: (() => void) | undefined;
	readonly labels: PdfViewerLabels;
	readonly testID: string | undefined;
}

/** Every state but "ready": a page-shaped skeleton, a failure, or the way to another app. */
function PdfStatus({ state, onRetry, onOpenExternally, labels, testID }: PdfStatusProps): React.JSX.Element {
	switch (state.status) {
		case "loading":
			return (
				<SkeletonGroup accessibilityLabel={labels.loading} className="flex-1 p-3" {...partTestId(testID, "loading")}>
					<View className="w-full" style={PLACEHOLDER_PAGE_STYLE}>
						<Skeleton className="size-full rounded-sm" />
					</View>
				</SkeletonGroup>
			);
		case "failed":
			return (
				<View className="p-4">
					<EmptyState icon={FileWarningIcon} title={labels.failureTitle} message={labels.failures[state.failure]} {...partTestId(testID, "failed")}>
						{onRetry === undefined ? null : <Button label={labels.retry} variant="secondary" onPress={onRetry} />}
						{onOpenExternally === undefined || state.failure === "not_a_pdf" || state.failure === "empty" ? null : (
							<Button label={labels.openExternally} variant="ghost" icon={ShareIcon} onPress={onOpenExternally} />
						)}
					</EmptyState>
				</View>
			);
		case "external":
			return (
				<View className="p-4">
					<EmptyState icon={FileTextIcon} title={labels.externalTitle} message={labels.externalDescription} {...partTestId(testID, "external")}>
						{onOpenExternally === undefined ? null : <Button label={labels.openExternally} icon={ShareIcon} onPress={onOpenExternally} />}
					</EmptyState>
				</View>
			);
	}
}

interface PdfDocumentProps {
	readonly pages: readonly PdfPageSize[];
	readonly renderPage: PdfPageRenderer;
	readonly onOpenExternally: (() => void) | undefined;
	readonly onDownload: (() => void) | undefined;
	readonly onSearch: PdfTextSearcher | undefined;
	readonly labels: PdfViewerLabels;
	readonly testID: string | undefined;
}

/** Where a search got to: closed, the row open with nothing asked yet, running, answered, or failed. */
type PdfSearchState =
	| { readonly status: "closed" }
	| { readonly status: "open" }
	| { readonly status: "searching" }
	| { readonly status: "found"; readonly matches: readonly PdfTextMatch[]; readonly current: number }
	| { readonly status: "failed" };

const SEARCH_CLOSED: PdfSearchState = { status: "closed" };
const SEARCH_OPEN: PdfSearchState = { status: "open" };

/** One highlight over a page: a box of a match, and whether that match is the one being shown. */
interface PdfPageHighlight {
	readonly key: string;
	readonly box: PdfTextBox;
	readonly active: boolean;
}

const NO_HIGHLIGHTS: readonly PdfPageHighlight[] = [];

/** A highlighter darkens the paper, never the print: multiply keeps black text black under the yellow. */
const HIGHLIGHTER_BLEND: ViewStyle["mixBlendMode"] = "multiply";
/** Each page blends on its own (the highlights multiply onto the page, not onto the list behind it). */
const PAGE_BLEND_ISOLATION: ViewStyle["isolation"] = "isolate";

/** Every page's highlights, by page index, from a search's matches. */
function highlightsByPage(search: PdfSearchState): ReadonlyMap<number, readonly PdfPageHighlight[]> {
	const byPage = new Map<number, PdfPageHighlight[]>();
	if (search.status !== "found") {
		return byPage;
	}
	search.matches.forEach((match: PdfTextMatch, matchIndex: number): void => {
		const highlights = byPage.get(match.pageIndex) ?? [];
		match.rects.forEach((box: PdfTextBox, boxIndex: number): void => {
			highlights.push({ key: `${String(matchIndex)}-${String(boxIndex)}`, box, active: matchIndex === search.current });
		});
		byPage.set(match.pageIndex, highlights);
	});
	return byPage;
}

/** The document's actions: download and "Open in…", each only when the caller offers it. */
type PdfDocumentAction = "download" | "open-externally";

interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

const UNMEASURED_VIEWPORT: ViewportSize = { width: 0, height: 0 };

/** The open document: the toolbar over the scrolling column of pages. */
function PdfDocument({ pages, renderPage, onOpenExternally, onDownload, onSearch, labels, testID }: PdfDocumentProps): React.JSX.Element {
	const listRef = React.useRef<FlatList<PdfPageSize>>(null);
	const [viewport, setViewport] = React.useState<ViewportSize>(UNMEASURED_VIEWPORT);
	const [zoom, setZoom] = React.useState(PDF_FIT_WIDTH_ZOOM);
	const [pageIndex, setPageIndex] = React.useState(0);
	const [query, setQuery] = React.useState("");
	const [search, setSearch] = React.useState<PdfSearchState>(SEARCH_CLOSED);
	/** Counts searches, so only the latest one's answer is shown. */
	const searchRun = React.useRef(0);
	const pageCount = pages.length;
	const highlights = React.useMemo(() => highlightsByPage(search), [search]);

	const pageWidth = Math.max(0, viewport.width - 2 * PAGE_GAP) * zoom;
	const listStyle = React.useMemo(() => ({ width: pageWidth, height: viewport.height }), [pageWidth, viewport.height]);
	const renderWidthPx = pdfPageRenderWidthPx(pageWidth, PixelRatio.get());
	const layouts = React.useMemo((): PdfPageLayout[] => pdfPageLayouts(pages, pageWidth, PAGE_GAP), [pages, pageWidth]);

	const measure = React.useCallback((event: LayoutChangeEvent): void => {
		const { width, height } = event.nativeEvent.layout;
		setViewport((current: ViewportSize): ViewportSize => (current.width === width && current.height === height ? current : { width, height }));
	}, []);

	const goToPage = React.useCallback(
		(index: number): void => {
			const target = clampPdfPageIndex(index, pageCount);
			setPageIndex(target);
			listRef.current?.scrollToIndex({ index: target, animated: true });
		},
		[pageCount],
	);
	const showPrevious = React.useCallback((): void => {
		goToPage(pageIndex - 1);
	}, [goToPage, pageIndex]);
	const showNext = React.useCallback((): void => {
		goToPage(pageIndex + 1);
	}, [goToPage, pageIndex]);

	// Zooming changes every page's height: keep the current page in view.
	const zoomTo = React.useCallback(
		(nextZoom: number): void => {
			setZoom(nextZoom);
			requestAnimationFrame((): void => {
				listRef.current?.scrollToIndex({ index: pageIndex, animated: false });
			});
		},
		[pageIndex],
	);
	const zoomIn = React.useCallback((): void => {
		zoomTo(nextPdfZoom(zoom));
	}, [zoom, zoomTo]);
	const zoomOut = React.useCallback((): void => {
		zoomTo(previousPdfZoom(zoom));
	}, [zoom, zoomTo]);

	const trackPage = React.useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>): void => {
			setPageIndex(pdfPageIndexAt(event.nativeEvent.contentOffset.y, event.nativeEvent.layoutMeasurement.height, layouts));
		},
		[layouts],
	);

	const openSearch = React.useCallback((): void => {
		setSearch(SEARCH_OPEN);
	}, []);
	const closeSearch = React.useCallback((): void => {
		searchRun.current += 1;
		setQuery("");
		setSearch(SEARCH_CLOSED);
	}, []);
	const runSearch = React.useCallback((): void => {
		const wanted = query.trim();
		if (onSearch === undefined || wanted.length === 0) {
			return;
		}
		searchRun.current += 1;
		const run = searchRun.current;
		setSearch({ status: "searching" });
		onSearch(wanted).then(
			(matches: readonly PdfTextMatch[]): void => {
				if (run !== searchRun.current) {
					return;
				}
				const current = firstPdfMatchFrom(matches, pageIndex);
				setSearch({ status: "found", matches, current });
				const first = matches.at(current);
				if (first !== undefined) {
					goToPage(first.pageIndex);
				}
			},
			(): void => {
				if (run === searchRun.current) {
					setSearch({ status: "failed" });
				}
			},
		);
	}, [goToPage, onSearch, pageIndex, query]);
	const stepMatch = React.useCallback(
		(step: PdfMatchStep): void => {
			if (search.status !== "found") {
				return;
			}
			const current = stepPdfMatch(search.current, search.matches.length, step);
			setSearch({ ...search, current });
			const match = search.matches.at(current);
			if (match !== undefined) {
				goToPage(match.pageIndex);
			}
		},
		[goToPage, search],
	);
	const showPreviousMatch = React.useCallback((): void => {
		stepMatch("previous");
	}, [stepMatch]);
	const showNextMatch = React.useCallback((): void => {
		stepMatch("next");
	}, [stepMatch]);

	const actions = React.useMemo((): readonly DropdownMenuItemData<PdfDocumentAction>[] => {
		const offered: DropdownMenuItemData<PdfDocumentAction>[] = [];
		if (onDownload !== undefined) {
			offered.push({ value: "download", label: labels.download, icon: DownloadIcon });
		}
		if (onOpenExternally !== undefined) {
			offered.push({ value: "open-externally", label: labels.openExternally, icon: ShareIcon });
		}
		return offered;
	}, [labels, onDownload, onOpenExternally]);
	const runAction = React.useCallback(
		(action: PdfDocumentAction): void => {
			switch (action) {
				case "download":
					onDownload?.();
					return;
				case "open-externally":
					onOpenExternally?.();
					return;
			}
		},
		[onDownload, onOpenExternally],
	);

	const getItemLayout = React.useCallback(
		(_data: ArrayLike<PdfPageSize> | null | undefined, index: number): PdfPageLayout => layouts.at(index) ?? { length: 0, offset: 0, index },
		[layouts],
	);
	const keyOfPage = React.useCallback((_page: PdfPageSize, index: number): string => String(index), []);
	const renderItem = React.useCallback(
		({ item, index }: ListRenderItemInfo<PdfPageSize>): React.JSX.Element => (
			<PdfPage
				pageIndex={index}
				width={pageWidth}
				height={pdfPageDisplayHeight(item, pageWidth)}
				renderWidthPx={renderWidthPx}
				renderPage={renderPage}
				highlights={highlights.get(index) ?? NO_HIGHLIGHTS}
				accessibilityLabel={labels.pageImage(index + 1, pageCount)}
				failedLabel={labels.pageFailed}
				testID={testID === undefined ? undefined : `${testID}-page-${String(index + 1)}`}
			/>
		),
		[highlights, labels, pageCount, pageWidth, renderPage, renderWidthPx, testID],
	);

	const isZoomed = zoom > PDF_FIT_WIDTH_ZOOM;
	const hasMeasured = viewport.width > 0;

	return (
		<>
			<View role="toolbar" className="flex-row items-center gap-1 border-b border-border bg-card px-2 py-1.5" {...partTestId(testID, "toolbar")}>
				<IconButton
					icon={ChevronLeftIcon}
					label={labels.previousPage}
					variant="ghost"
					size="sm"
					onPress={showPrevious}
					disabled={pageIndex <= 0}
					{...partTestId(testID, "previous")}
				/>
				<Text
					accessibilityLabel={pageCount === 0 ? undefined : labels.pageIndicator(pageIndex + 1, pageCount)}
					className="font-sans-medium min-w-0 shrink text-center text-sm text-foreground"
					accessibilityLiveRegion="polite"
					numberOfLines={1}>
					{pageCount === 0 ? "" : labels.pageIndicatorShort(pageIndex + 1, pageCount)}
				</Text>
				<IconButton
					icon={ChevronRightIcon}
					label={labels.nextPage}
					variant="ghost"
					size="sm"
					onPress={showNext}
					disabled={pageIndex >= pageCount - 1}
					{...partTestId(testID, "next")}
				/>
				<View className="flex-1" />
				<IconButton icon={ZoomOutIcon} label={labels.zoomOut} variant="ghost" size="sm" onPress={zoomOut} disabled={!isZoomed} {...partTestId(testID, "zoom-out")} />
				<Text className="w-12 text-center font-mono text-xs text-muted-foreground" {...partTestId(testID, "zoom")}>
					{formatPdfZoom(zoom)}
				</Text>
				<IconButton
					icon={ZoomInIcon}
					label={labels.zoomIn}
					variant="ghost"
					size="sm"
					onPress={zoomIn}
					disabled={nextPdfZoom(zoom) === zoom}
					{...partTestId(testID, "zoom-in")}
				/>
				{onSearch === undefined ? null : (
					<IconButton icon={SearchIcon} label={labels.search} variant="ghost" size="sm" onPress={openSearch} {...partTestId(testID, "search")} />
				)}
				<PdfActions actions={actions} onSelect={runAction} onDownload={onDownload} onOpenExternally={onOpenExternally} labels={labels} testID={testID} />
			</View>
			{search.status === "closed" ? null : (
				<PdfSearchBar
					query={query}
					onQueryChange={setQuery}
					onSubmit={runSearch}
					search={search}
					onPrevious={showPreviousMatch}
					onNext={showNextMatch}
					onClose={closeSearch}
					labels={labels}
					testID={testID}
				/>
			)}
			<View className="flex-1" onLayout={measure} {...partTestId(testID, "viewport")}>
				{pageCount === 0 ? (
					<View className="p-4">
						<EmptyState icon={FileTextIcon} message={labels.empty} />
					</View>
				) : hasMeasured ? (
					<ScrollView horizontal scrollEnabled={isZoomed} bounces={false} showsHorizontalScrollIndicator={isZoomed} contentContainerStyle={PAGE_COLUMN_GUTTER_STYLE}>
						<FlatList
							ref={listRef}
							data={pages}
							keyExtractor={keyOfPage}
							renderItem={renderItem}
							extraData={highlights}
							getItemLayout={getItemLayout}
							onScroll={trackPage}
							scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
							initialNumToRender={INITIAL_PAGES}
							windowSize={PAGE_WINDOW_SIZE}
							removeClippedSubviews
							contentContainerStyle={PAGE_LIST_END_STYLE}
							style={listStyle}
							{...partTestId(testID, "pages")}
						/>
					</ScrollView>
				) : null}
			</View>
		</>
	);
}

interface PdfActionsProps {
	readonly actions: readonly DropdownMenuItemData<PdfDocumentAction>[];
	readonly onSelect: (action: PdfDocumentAction) => void;
	readonly onDownload: (() => void) | undefined;
	readonly onOpenExternally: (() => void) | undefined;
	readonly labels: PdfViewerLabels;
	readonly testID: string | undefined;
}

/** The document's actions in the toolbar: one as its own button, several behind "More" (a phone toolbar has no room for both). */
function PdfActions({ actions, onSelect, onDownload, onOpenExternally, labels, testID }: PdfActionsProps): React.JSX.Element | null {
	if (actions.length > 1) {
		return (
			<DropdownMenu label={labels.moreActions} items={actions} onSelect={onSelect} icon={EllipsisVerticalIcon} variant="ghost" size="icon" {...partTestId(testID, "more")} />
		);
	}
	if (onDownload !== undefined) {
		return <IconButton icon={DownloadIcon} label={labels.download} variant="ghost" size="sm" onPress={onDownload} {...partTestId(testID, "download")} />;
	}
	if (onOpenExternally !== undefined) {
		return <IconButton icon={ShareIcon} label={labels.openExternally} variant="ghost" size="sm" onPress={onOpenExternally} {...partTestId(testID, "open-externally")} />;
	}
	return null;
}

interface PdfSearchBarProps {
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
	readonly onSubmit: () => void;
	readonly search: Exclude<PdfSearchState, { readonly status: "closed" }>;
	readonly onPrevious: () => void;
	readonly onNext: () => void;
	readonly onClose: () => void;
	readonly labels: PdfViewerLabels;
	readonly testID: string | undefined;
}

/** What the search row says about the latest search ("3 of 12", "No matches"…); nothing before the first one. */
function searchStatusText(search: PdfSearchBarProps["search"], labels: PdfViewerLabels): string {
	switch (search.status) {
		case "open":
			return "";
		case "searching":
			return labels.searching;
		case "failed":
			return labels.searchFailed;
		case "found":
			return search.matches.length === 0 ? labels.noMatches : labels.matchIndicator(search.current + 1, search.matches.length);
	}
}

/** The search row under the toolbar: the query, how the search went, and previous / next match. */
function PdfSearchBar({ query, onQueryChange, onSubmit, search, onPrevious, onNext, onClose, labels, testID }: PdfSearchBarProps): React.JSX.Element {
	const canStep = search.status === "found" && search.matches.length > 1;
	return (
		<View accessibilityRole="search" className="flex-row items-center gap-1 border-b border-border bg-card px-2 py-1.5" {...partTestId(testID, "search-bar")}>
			<Input
				value={query}
				onChange={onQueryChange}
				onSubmitEditing={onSubmit}
				placeholder={labels.searchPlaceholder}
				accessibilityLabel={labels.searchPlaceholder}
				returnKeyType="search"
				autoCapitalize="none"
				autoCorrect={false}
				autoFocus
				size="sm"
				className="min-w-0 flex-1"
				{...partTestId(testID, "search-input")}
			/>
			<Text className="font-sans text-xs text-muted-foreground" accessibilityLiveRegion="polite" numberOfLines={1} {...partTestId(testID, "search-status")}>
				{searchStatusText(search, labels)}
			</Text>
			<IconButton
				icon={ChevronUpIcon}
				label={labels.previousMatch}
				variant="ghost"
				size="sm"
				onPress={onPrevious}
				disabled={!canStep}
				{...partTestId(testID, "previous-match")}
			/>
			<IconButton icon={ChevronDownIcon} label={labels.nextMatch} variant="ghost" size="sm" onPress={onNext} disabled={!canStep} {...partTestId(testID, "next-match")} />
			<IconButton icon={XIcon} label={labels.closeSearch} variant="ghost" size="sm" onPress={onClose} {...partTestId(testID, "close-search")} />
		</View>
	);
}

interface PdfPageProps {
	readonly pageIndex: number;
	readonly width: number;
	readonly height: number;
	readonly renderWidthPx: number;
	readonly renderPage: PdfPageRenderer;
	/** The search's highlights on this page; none outside a search. */
	readonly highlights: readonly PdfPageHighlight[];
	readonly accessibilityLabel: string;
	readonly failedLabel: string;
	readonly testID: string | undefined;
}

/** What one page shows: a skeleton while it renders, then its bitmap — or why it could not be drawn. */
type PdfPageImage = { readonly status: "rendering" } | { readonly status: "rendered"; readonly uri: string } | { readonly status: "failed" };

const RENDERING: PdfPageImage = { status: "rendering" };
const FAILED: PdfPageImage = { status: "failed" };

/** One page: rendered when it first appears and again at each new width; the old bitmap stays until the new one is ready. */
const PdfPage = React.memo(function PdfPage({
	pageIndex,
	width,
	height,
	renderWidthPx,
	renderPage,
	highlights,
	accessibilityLabel,
	failedLabel,
	testID,
}: PdfPageProps): React.JSX.Element {
	const [image, setImage] = React.useState<PdfPageImage>(RENDERING);
	// Its own blending layer: the search highlights multiply onto this page's bitmap, nothing behind it.
	const frameStyle = React.useMemo((): ViewStyle => ({ width, height, marginTop: PAGE_GAP, isolation: PAGE_BLEND_ISOLATION }), [width, height]);
	const imageStyle = React.useMemo(() => ({ width, height }), [width, height]);
	const imageSource = React.useMemo(() => (image.status === "rendered" ? { uri: image.uri } : null), [image]);

	React.useEffect((): (() => void) => {
		const current = { active: true };
		renderPage(pageIndex, renderWidthPx).then(
			(uri: string): void => {
				if (current.active) {
					setImage({ status: "rendered", uri });
				}
			},
			(): void => {
				if (current.active) {
					setImage(FAILED);
				}
			},
		);
		return (): void => {
			current.active = false;
		};
	}, [pageIndex, renderPage, renderWidthPx]);

	return (
		<View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} className="overflow-hidden rounded-sm bg-card" style={frameStyle} testID={testID}>
			{imageSource !== null ? (
				<Image source={imageSource} accessible={false} contentFit="contain" style={imageStyle} {...partTestId(testID, "image")} />
			) : image.status === "failed" ? (
				<View className="size-full items-center justify-center gap-2 p-4">
					<Icon icon={FileWarningIcon} size="lg" colorClassName="accent-muted-foreground" />
					<Text className="text-center font-sans text-sm text-muted-foreground">{failedLabel}</Text>
				</View>
			) : (
				<SkeletonGroup className="size-full">
					<Skeleton className="size-full" />
				</SkeletonGroup>
			)}
			{highlights.map((highlight: PdfPageHighlight): React.JSX.Element => (
				<PdfHighlight key={highlight.key} highlight={highlight} pageWidth={width} pageHeight={height} testID={testID} />
			))}
		</View>
	);
});

interface PdfHighlightProps {
	readonly highlight: PdfPageHighlight;
	readonly pageWidth: number;
	readonly pageHeight: number;
	readonly testID: string | undefined;
}

/**
 * One match box over the page, like a highlighter pen: the `document-match` tokens (the same yellow in
 * every theme, as a page is white in every theme) multiplied onto the page, so the paper turns yellow
 * and the print stays black and readable — no outline, which would cover small print. The shown match
 * is the stronger yellow. Decorative: the search row announces where it is.
 */
function PdfHighlight({ highlight, pageWidth, pageHeight, testID }: PdfHighlightProps): React.JSX.Element {
	const frameStyle = React.useMemo(
		() => ({ ...pdfHighlightFrame(highlight.box, pageWidth, pageHeight), mixBlendMode: HIGHLIGHTER_BLEND }),
		[highlight.box, pageWidth, pageHeight],
	);
	return (
		<View
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className={cn("absolute rounded", highlight.active ? "bg-document-match-active" : "bg-document-match")}
			style={frameStyle}
			{...partTestId(testID, highlight.active ? "highlight-active" : "highlight")}
		/>
	);
}
