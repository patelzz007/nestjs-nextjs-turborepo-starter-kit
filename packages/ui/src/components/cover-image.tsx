"use client";

import { AspectRatio } from "@workspace/ui/components/aspect-ratio";
import { cn } from "@workspace/ui/lib/core/utils";
import { ImageOff } from "lucide-react";
import * as React from "react";

/** The default cover shape — wide, like the 1200×675 covers uploads are cropped for. */
export const COVER_IMAGE_DEFAULT_RATIO = 16 / 9;

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
	{ src, alt = "", ratio = COVER_IMAGE_DEFAULT_RATIO, priority = false, fallback, className, ...props },
	ref,
): React.JSX.Element {
	const hasSource = src !== null && src !== undefined && src.length > 0;
	const [loadState, setLoadState] = React.useState<{ readonly src: string | null; readonly state: CoverImageState }>({ src: null, state: "loading" });
	// A new `src` starts loading again — derived during render instead of reset in an effect.
	const state: CoverImageState = hasSource && loadState.src === src ? loadState.state : "loading";
	const showFallback = !hasSource || state === "error";

	const handleLoad = React.useCallback((): void => {
		setLoadState({ src: src ?? null, state: "loaded" });
	}, [src]);
	const handleError = React.useCallback((): void => {
		setLoadState({ src: src ?? null, state: "error" });
	}, [src]);
	// A server-rendered image can finish loading before React attaches `onLoad`; catch it on mount.
	const detectAlreadyLoaded = React.useCallback(
		(image: HTMLImageElement | null): void => {
			if (image !== null && image.complete && image.naturalWidth > 0) {
				handleLoad();
			}
		},
		[handleLoad],
	);

	return (
		<AspectRatio ref={ref} ratio={ratio} data-slot="cover-image" data-state={showFallback ? "fallback" : state} className={cn("overflow-hidden bg-muted", className)} {...props}>
			{hasSource && state !== "error" ? (
				<img
					ref={detectAlreadyLoaded}
					src={src}
					alt={alt}
					loading={priority ? "eager" : "lazy"}
					decoding="async"
					onLoad={handleLoad}
					onError={handleError}
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
