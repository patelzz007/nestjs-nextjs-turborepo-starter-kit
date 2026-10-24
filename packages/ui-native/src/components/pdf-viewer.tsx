// A PDF document, page under page, with a toolbar: previous / next page and
// where you are ("Page 2 of 12"), zoom out / in ("150%"), and "Open in…".
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

import type { PdfOpenFailure } from "@workspace/shared";
import { cva, type VariantProps } from "class-variance-authority";
import { Image } from "expo-image";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import FileTextIcon from "lucide-react-native/icons/file-text";
import FileWarningIcon from "lucide-react-native/icons/file-exclamation-point";
import ShareIcon from "lucide-react-native/icons/share";
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
} from "react-native";

import { cn } from "../lib/cn";
import {
	clampPdfPageIndex,
	formatPdfZoom,
	nextPdfZoom,
	PDF_FIT_WIDTH_ZOOM,
	pdfPageDisplayHeight,
	pdfPageIndexAt,
	pdfPageLayouts,
	pdfPageRenderWidthPx,
	previousPdfZoom,
	type PdfPageLayout,
	type PdfPageSize,
} from "../lib/pdf-viewer-layout";
import { Button } from "./button";
import { EmptyState } from "./empty";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
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
	readonly retry: string;
	readonly empty: string;
	readonly externalTitle: string;
	readonly externalDescription: string;
	readonly pageFailed: string;
	readonly failureTitle: string;
	/** Why the document could not be shown, one sentence per failure. */
	readonly failures: Readonly<Record<PdfOpenFailure, string>>;
	/** "Page 2 of 12" — the toolbar's indicator. */
	readonly pageIndicator: (page: number, pageCount: number) => string;
	/** "Page 2 of 12" — each page's name for screen readers. */
	readonly pageImage: (page: number, pageCount: number) => string;
}

function pageOf(page: number, pageCount: number): string {
	return `Page ${String(page)} of ${String(pageCount)}`;
}

export const DEFAULT_PDF_VIEWER_LABELS: PdfViewerLabels = {
	loading: "Loading document…",
	previousPage: "Previous page",
	nextPage: "Next page",
	zoomIn: "Zoom in",
	zoomOut: "Zoom out",
	openExternally: "Open in another app",
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
	pageImage: pageOf,
};

/** Turns page `pageIndex` (0-based) into a bitmap `widthPx` pixels wide; resolves with its address. */
export type PdfPageRenderer = (pageIndex: number, widthPx: number) => Promise<string>;

export interface PdfViewerProps {
	readonly state: PdfViewerState;
	readonly renderPage: PdfPageRenderer;
	/** Offered after a failure; without it there is no retry button. */
	readonly onRetry?: (() => void) | undefined;
	/** Hands the document to another app ("Open in…"); without it the action is hidden. */
	readonly onOpenExternally?: (() => void) | undefined;
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
		{ state, renderPage, onRetry, onOpenExternally, labels, variant = "framed", className, testID },
		ref,
	): React.JSX.Element {
		const text = React.useMemo((): PdfViewerLabels => ({ ...DEFAULT_PDF_VIEWER_LABELS, ...labels }), [labels]);
		return (
			<View ref={ref} testID={testID} className={cn(pdfViewerVariants({ variant }), className)}>
				{state.status === "ready" ? (
					<PdfDocument pages={state.pages} renderPage={renderPage} onOpenExternally={onOpenExternally} labels={text} testID={testID} />
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
	readonly labels: PdfViewerLabels;
	readonly testID: string | undefined;
}

interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

const UNMEASURED_VIEWPORT: ViewportSize = { width: 0, height: 0 };

/** The open document: the toolbar over the scrolling column of pages. */
function PdfDocument({ pages, renderPage, onOpenExternally, labels, testID }: PdfDocumentProps): React.JSX.Element {
	const listRef = React.useRef<FlatList<PdfPageSize>>(null);
	const [viewport, setViewport] = React.useState<ViewportSize>(UNMEASURED_VIEWPORT);
	const [zoom, setZoom] = React.useState(PDF_FIT_WIDTH_ZOOM);
	const [pageIndex, setPageIndex] = React.useState(0);
	const pageCount = pages.length;

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
				accessibilityLabel={labels.pageImage(index + 1, pageCount)}
				failedLabel={labels.pageFailed}
				testID={testID === undefined ? undefined : `${testID}-page-${String(index + 1)}`}
			/>
		),
		[labels, pageCount, pageWidth, renderPage, renderWidthPx, testID],
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
				<Text className="font-sans-medium min-w-0 shrink text-center text-sm text-foreground" accessibilityLiveRegion="polite" numberOfLines={1}>
					{pageCount === 0 ? "" : labels.pageIndicator(pageIndex + 1, pageCount)}
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
				{onOpenExternally === undefined ? null : (
					<IconButton icon={ShareIcon} label={labels.openExternally} variant="ghost" size="sm" onPress={onOpenExternally} {...partTestId(testID, "open-externally")} />
				)}
			</View>
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

interface PdfPageProps {
	readonly pageIndex: number;
	readonly width: number;
	readonly height: number;
	readonly renderWidthPx: number;
	readonly renderPage: PdfPageRenderer;
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
	accessibilityLabel,
	failedLabel,
	testID,
}: PdfPageProps): React.JSX.Element {
	const [image, setImage] = React.useState<PdfPageImage>(RENDERING);
	const frameStyle = React.useMemo(() => ({ width, height, marginTop: PAGE_GAP }), [width, height]);
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
		</View>
	);
});
