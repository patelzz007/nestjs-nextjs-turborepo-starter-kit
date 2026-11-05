import { clampImageSize, DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX, resolveImageResizeConstraints, type ImageSize } from "@workspace/shared";
import { ImageCarousel } from "@workspace/ui/components/image-carousel";
import { ImageResizer } from "@workspace/ui/components/image-resizer";
import { UiKitLabelsProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import { createElement, useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import type { DocsCarouselProps, DocsImageResizerProps, MediaIslandPayload } from "./props";

/** How wide a carousel is drawn, for the browser's choice of image rendition: the prose column at most. */
export const DOCS_CAROUSEL_SIZES = "(min-width: 768px) 720px, 100vw";

/**
 * The docs' carousel: the `@workspace/ui` `ImageCarousel` (Embla — swipe, arrows, dots, a
 * counter, arrow keys). Each slide is keyed by its position: the same image may appear twice.
 */
export function docsCarouselElement(props: DocsCarouselProps): ReactElement {
	return createElement(ImageCarousel, {
		images: props.images.map((image, index) => ({ id: String(index), src: image.src, alt: image.alt })),
		ratio: props.ratio,
		sizes: DOCS_CAROUSEL_SIZES,
		frameClassName: "rounded-lg",
	});
}

/**
 * The smart side of the docs' resizable image: it owns the size the reader drags to, and keeps it
 * within the column — the `ImageResizer` itself is controlled. The column's width is measured once
 * the page runs (the build has no layout), so the server render and the first hydrated render
 * agree, and a narrow screen then shrinks the image to fit.
 */
function DocsImageResizer({ image, width, height, aspectRatio }: DocsImageResizerProps): ReactElement {
	const frameRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState<ImageSize>({ width, height });
	// The column's width; `null` until measured (and during the build).
	const [columnWidth, setColumnWidth] = useState<number | null>(null);

	useEffect((): (() => void) | undefined => {
		const column = frameRef.current?.parentElement;
		if (column === null || column === undefined) {
			return undefined;
		}
		const measure = (): void => {
			setColumnWidth(column.clientWidth);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(column);
		return (): void => {
			observer.disconnect();
		};
	}, []);

	// A column narrower than the smallest image (a hidden one measures 0) sets no bound.
	const maxWidth = columnWidth !== null && columnWidth >= DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX ? columnWidth : undefined;
	const shown = useMemo(
		(): ImageSize => (maxWidth === undefined ? size : clampImageSize(size, resolveImageResizeConstraints({ maxWidth, aspectRatio }))),
		[aspectRatio, maxWidth, size],
	);

	return createElement(ImageResizer, {
		ref: frameRef,
		src: image.src,
		alt: image.alt,
		value: shown,
		onValueChange: setSize,
		maxWidth,
		aspectRatio: aspectRatio ?? undefined,
	});
}

/**
 * One media island's tree — used for BOTH the build-time render and the browser hydration, so
 * the two are identical by construction. Every island is its own React root, so each carries the
 * kit's label provider with the English pack the docs are written in (it renders no DOM).
 */
export function docsMediaIslandElement(payload: MediaIslandPayload): ReactElement {
	const island = payload.kind === "carousel" ? docsCarouselElement(payload.props) : createElement(DocsImageResizer, payload.props);
	return createElement(UiKitLabelsProvider, { labels: UI_KIT_LABELS_EN, children: island });
}
