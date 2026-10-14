"use client";

import { AspectRatio } from "@workspace/ui/components/aspect-ratio";
import { useImageLoadingStatus } from "@workspace/ui/hooks/use-image-loading-status";
import { useNearViewport } from "@workspace/ui/hooks/use-near-viewport";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { imageSrcSet, type ImageSourceEntry } from "@workspace/ui/lib/media/image-sources";
import { ImageOff } from "lucide-react";
import * as React from "react";

/** The default cover shape — wide, like the 1200×675 covers uploads are cropped for. */
export const COVER_IMAGE_DEFAULT_RATIO = 16 / 9;

/** One rendition of a cover image: its width in pixels and URL. */
export type CoverImageSource = ImageSourceEntry;

type CoverImageState = "loading" | "loaded" | "error";

export interface CoverImageProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
	/** Image URL; `null`/omitted shows the fallback. */
	readonly src: string | null | undefined;
	/**
	 * `<img alt>` semantics. Defaults to `""` (decorative): a cover sits next to
	 * the title that names it, so reading it out again adds nothing. Pass a
	 * description when the image is the only thing that says what it shows.
	 */
	readonly alt?: string | undefined;
	/** Width divided by height. */
	readonly ratio?: number | undefined;
	/** Loads the image before it scrolls into view — for the first, above-the-fold cover only. */
	readonly priority?: boolean | undefined;
	/**
	 * Renditions of the same image by width (any order), rendered as `srcset`
	 * so each screen downloads the smallest one that is still sharp for it.
	 */
	readonly sources?: readonly CoverImageSource[] | undefined;
	/** `sizes` for `sources`: how wide the frame is drawn (default: the full viewport width). */
	readonly sizes?: string | undefined;
	/** Shown in place of the image when there is none or it fails to load. */
	readonly fallback?: React.ReactNode;
}

/**
 * A cropped cover image in a fixed aspect ratio. Data-agnostic and stateless
 * for its caller: it fills the frame (`object-cover`), shows a muted surface
 * while loading (fading the image in, unless reduced motion is preferred), and
 * the `fallback` — by default a quiet "no image" mark — when there is no image
 * or it fails. The frame keeps its size throughout, so nothing shifts.
 * The ref reaches the frame.
 */
const CoverImage = React.forwardRef<HTMLDivElement, CoverImageProps>(function CoverImage(
	{ src, alt = "", ratio = COVER_IMAGE_DEFAULT_RATIO, priority = false, sources, sizes, fallback, className, ...props },
	ref,
): React.JSX.Element {
	const hasSource = src !== null && src !== undefined && src.length > 0;
	// Load tracking starts as the frame nears the viewport (at once for the priority cover), keeping covers lazy.
	const [frame, setFrame] = React.useState<HTMLDivElement | null>(null);
	const frameRef = React.useMemo(() => mergeRefs<HTMLDivElement>(setFrame, ref), [ref]);
	const isNearViewport = useNearViewport(frame, priority);
	const srcSet = imageSrcSet(sources);
	const resolvedSizes = srcSet === undefined ? undefined : (sizes ?? "100vw");
	// The tracker asks for the same rendition the <img> will, so each image is downloaded once.
	const loadingStatus = useImageLoadingStatus(src, isNearViewport, { srcSet, sizes: resolvedSizes });
	const state: CoverImageState = loadingStatus === "loaded" ? "loaded" : loadingStatus === "error" ? "error" : "loading";
	const showFallback = !hasSource || state === "error";

	return (
		<AspectRatio
			ref={frameRef}
			ratio={ratio}
			data-slot="cover-image"
			data-state={showFallback ? "fallback" : state}
			className={cn("overflow-hidden bg-muted", className)}
			{...props}>
			{hasSource && state !== "error" ? (
				<img
					src={src}
					srcSet={srcSet}
					sizes={resolvedSizes}
					alt={alt}
					loading={priority ? "eager" : "lazy"}
					decoding="async"
					className={cn(
						"absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
						state === "loaded" ? "opacity-100" : "opacity-0",
					)}
				/>
			) : null}
			{showFallback ? (
				<div className="absolute inset-0 flex items-center justify-center text-muted-foreground/60" aria-hidden={alt.length === 0 ? true : undefined}>
					{fallback ?? <ImageOff className="size-6" aria-hidden="true" />}
					{alt.length > 0 ? <span className="sr-only">{alt}</span> : null}
				</div>
			) : null}
		</AspectRatio>
	);
});
CoverImage.displayName = "CoverImage";

export { CoverImage };
