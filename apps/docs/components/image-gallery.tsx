"use client";

import { cn } from "@workspace/ui/lib/utils";
import { ZoomIn } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { handleLightboxClick } from "@/components/lightbox";

/**
 * ImageGallery — the card-grid presentation for image-bearing docs tables
 * (e.g. the email-template gallery). The remark plugin converts such tables
 * into `<ImageGallery items="…">` with the items as a JSON string attribute;
 * this component parses + validates it (rule 13 — a malformed payload can
 * never render a broken card).
 *
 * Each card is a mini showcase: the screenshot is shown in FULL
 * (`object-contain` — never cropped) inside a padded frame with a quiet
 * dot-grid texture behind it, a hover zoom + ring, an "Open full size" zoom
 * affordance (bottom-right) that opens the shared image lightbox, and a
 * caption bar (title + optional accent description).
 */

const ImageGalleryItemSchema = z.object({
	title: z.string(),
	description: z.string(),
	src: z.string(),
	alt: z.string(),
});

export interface ImageGalleryProps {
	/** JSON-string array of gallery items (emitted by the remark plugin). */
	readonly items?: string;
	readonly className?: string;
}

/** Flattens a nested caption string to a single line for the card footer. */
function flattenCaption(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

export function ImageGallery({ items, className }: ImageGalleryProps): React.JSX.Element {
	let parsedItems: z.infer<typeof ImageGalleryItemSchema>[] = [];
	if (items !== undefined) {
		try {
			const raw: unknown = JSON.parse(items);
			if (Array.isArray(raw)) {
				parsedItems = raw
					.map((item) => ImageGalleryItemSchema.safeParse(item))
					.filter((result): result is { readonly success: true; readonly data: z.infer<typeof ImageGalleryItemSchema> } => result.success)
					.map((result) => result.data);
			}
		} catch {
			parsedItems = [];
		}
	}

	if (parsedItems.length === 0) {
		return <p className="text-sm text-muted-foreground italic">No previews available.</p>;
	}

	return (
		<div className={cn("not-prose my-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}>
			{parsedItems.map((item) => {
				const title = flattenCaption(item.title);
				const description = flattenCaption(item.description);
				return (
					<figure
						key={item.src}
						className="group/gallery flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
						{/* Screenshot frame — full image, never cropped. */}
						<div className="bg-dot-grid relative h-56 overflow-hidden bg-muted/40 sm:h-64">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={item.src}
								alt={item.alt}
								loading="lazy"
								className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover/gallery:scale-[1.02]"
							/>
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
