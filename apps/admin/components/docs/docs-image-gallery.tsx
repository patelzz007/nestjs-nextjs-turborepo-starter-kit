"use client";

import { ZoomIn } from "lucide-react";
import * as React from "react";

import { ImageGalleryItemSchema, type ImageGalleryItem } from "@/lib/docs/image-gallery";
import { handleLightboxClick } from "@/lib/docs/lightbox";
import { cn } from "@/lib/utils";

/**
 * DocsImageGallery — the card-grid presentation for image-bearing docs tables
 * (e.g. the email-template gallery in `docs/email.md`). The renderer routes
 * any table whose body rows all contain an image here instead of the data
 * table chrome.
 *
 * Dumb and presentational (rules 9–11): items arrive via props — a caption
 * title + optional description + the screenshot `src`/`alt` — and the
 * component knows nothing about where they came from.
 *
 * Each card is a mini **showcase**: the screenshot is shown in FULL
 * (`object-contain` — never cropped, so long vertical templates stay intact)
 * inside a padded frame with a quiet **dot-grid texture** behind it, with a
 * subtle hover zoom + ring, a **"Open full size" zoom affordance**
 * (bottom-right, hover-revealed on desktop, always tappable on touch) that
 * opens the shared image lightbox, and a caption bar (title + accent
 * description). The grid is 1-up on mobile, 2-up on small screens, 3-up on
 * wide screens — every item is a card, nothing scrolls.
 */
export interface DocsImageGalleryProps {
	readonly items: readonly ImageGalleryItem[];
	readonly className?: string;
}

/** Flattens a nested caption string to a single line for the card footer. */
function flattenCaption(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

export function DocsImageGallery({ items, className = "" }: DocsImageGalleryProps): React.JSX.Element {
	// Rule 13 — validate what the renderer passed so a malformed item can never
	// render a broken card (unknown fields are dropped, bad values fall back to
	// empty strings via `.catch` semantics of safeParse + defaults below).
	const validated: readonly ImageGalleryItem[] = items
		.map((item) => ImageGalleryItemSchema.safeParse(item))
		.filter((result): result is { readonly success: true; readonly data: ImageGalleryItem } => result.success)
		.map((result) => result.data);

	if (validated.length === 0) {
		return <p className="text-sm text-muted-foreground italic">No previews available.</p>;
	}

	return (
		<div className={cn("not-prose my-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}>
			{validated.map((item) => {
				const title = flattenCaption(item.title);
				const description = flattenCaption(item.description);
				return (
					<figure
						key={item.src}
						className="group/gallery flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
						{/* Screenshot frame — full image, never cropped. A faint dot grid
						    (`bg-dot-grid`, shared with the docs banner) reads as a neutral
						    "stage" behind shorter images, so `object-contain` always looks
						    deliberate. */}
						<div className="bg-dot-grid relative h-56 overflow-hidden bg-muted/40 sm:h-64">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={item.src}
								alt={item.alt}
								loading="lazy"
								className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover/gallery:scale-[1.02]"
							/>
							{/* Zoom affordance — hover-revealed on desktop, always
							    tappable on touch (matches the renderer's img pattern). */}
							<button
								type="button"
								aria-label={`Open ${title || "image"} full size`}
								title="Open full size"
								className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 py-1.5 pr-3 pl-2.5 text-xs font-medium text-white opacity-0 shadow-md backdrop-blur-sm transition-all duration-200 group-hover/gallery:opacity-100 hover:bg-black/70 focus-visible:opacity-100 max-lg:opacity-100"
								data-lightbox-src={item.src}
								data-lightbox-alt={item.alt}
								onClick={handleLightboxClick}>
								<ZoomIn className="size-3.5" />
								<span className="hidden sm:inline">Open full size</span>
							</button>
							<div className="pointer-events-none absolute inset-0 rounded-t-xl ring-1 ring-black/5 transition-all duration-500 ring-inset group-hover/gallery:ring-primary/25 dark:ring-white/5" />
						</div>

						{/* Caption bar — title + optional accent description */}
						<figcaption className="flex items-baseline justify-between gap-3 border-t border-border/50 bg-muted/10 px-4 py-3">
							<span className="truncate text-sm font-medium text-foreground">{title || "Preview"}</span>
							{description.length > 0 ? <span className="shrink-0 text-xs text-muted-foreground/80">{description}</span> : null}
						</figcaption>
					</figure>
				);
			})}
		</div>
	);
}
