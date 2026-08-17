"use client";

import { cn } from "@workspace/ui/lib/utils";
import { ZoomIn } from "lucide-react";
import * as React from "react";

import { handleLightboxClick } from "@/components/lightbox";

/**
 * DocsImage — the `img` element override for the docs renderer: framed with a
 * subtle border + hover zoom, a zoom affordance (bottom-right, hover-revealed
 * on desktop, always tappable on touch) that opens the shared lightbox, and a
 * caption when the markdown provides alt text.
 */
export interface DocsImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	readonly src?: string | Blob;
	readonly alt?: string;
}

export function DocsImage({ src, alt, className, ...props }: DocsImageProps): React.JSX.Element {
	const srcString = typeof src === "string" ? src : undefined;
	const isExternal = srcString?.startsWith("http") ?? false;

	return (
		<figure className="group/image not-prose my-8">
			<div className="relative overflow-hidden rounded-xl border border-border/40 bg-muted/20">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={srcString}
					alt={alt ?? ""}
					className={cn("max-h-125 w-full object-contain transition-all duration-500 group-hover/image:scale-[1.02]", className)}
					loading="lazy"
					width={isExternal ? undefined : 800}
					height={isExternal ? undefined : 450}
					{...props}
				/>
				<button
					type="button"
					aria-label="Zoom image"
					className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 group-hover/image:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
					data-lightbox-src={srcString ?? ""}
					data-lightbox-alt={alt ?? ""}
					onClick={handleLightboxClick}>
					<ZoomIn className="size-4" />
				</button>
				<div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-black/5 transition-all duration-500 ring-inset group-hover/image:ring-primary/20 dark:ring-white/5" />
			</div>
			{alt ? <figcaption className="mt-2 text-center text-xs leading-relaxed text-muted-foreground/50 italic">{alt}</figcaption> : null}
		</figure>
	);
}
