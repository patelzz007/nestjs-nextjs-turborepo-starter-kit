import { cn } from "@workspace/ui/lib/core/utils";
import Image from "next/image";
import type * as React from "react";

// ── Sample slides shared by the Carousel examples ───────────────────────────
// Photos come from Unsplash's CDN — the image host the admin already allows
// (`next.config.ts` → `images.remotePatterns`). Each slide carries a stable
// id, so the examples never key their lists by array index.

/** Unsplash photo ids, in the order the slides show them. */
const SAMPLE_PHOTO_IDS: readonly string[] = [
	"photo-1486312338219-ce68d2c6f44d",
	"photo-1461749280684-dccba630e2f6",
	"photo-1451187580459-43490279c0fa",
	"photo-1504384308090-c894fdcc538d",
	"photo-1541701494587-cb58502866ab",
	"photo-1579546929518-9e396f3cc809",
	"photo-1618005182384-a83a8bd57fbe",
	"photo-1620121692029-d088224ddc74",
	"photo-1620641788421-7a1c342ea42e",
	"photo-1607990281513-2c110a25bd8c",
];

/** Slides are numbered from one for people, while indexes count from zero. */
const FIRST_SLIDE_NUMBER = 1;
/** JPEG quality requested from the image CDN. */
const PHOTO_QUALITY = 80;

export interface CarouselSampleSlide {
	/** Stable list key. */
	readonly id: string;
	/** Zero-based position, as Embla's `scrollTo` expects. */
	readonly index: number;
	/** One-based number shown to people ("Slide 3"). */
	readonly number: number;
	readonly photoId: string;
}

function unsplashPhotoUrl(photoId: string, widthPx: number, heightPx: number): string {
	return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${String(widthPx)}&h=${String(heightPx)}&q=${String(PHOTO_QUALITY)}`;
}

/** The first `count` sample slides (at most one per sample photo). */
export function carouselSampleSlides(count: number): readonly CarouselSampleSlide[] {
	return SAMPLE_PHOTO_IDS.slice(0, count).map((photoId: string, index: number): CarouselSampleSlide => ({
		id: `slide-${String(index + FIRST_SLIDE_NUMBER)}`,
		index,
		number: index + FIRST_SLIDE_NUMBER,
		photoId,
	}));
}

export interface CarouselSlidePhotoProps {
	readonly slide: CarouselSampleSlide;
	/** Intrinsic width requested from the CDN, in pixels. */
	readonly widthPx: number;
	/** Intrinsic height requested from the CDN, in pixels. */
	readonly heightPx: number;
	/** Alt text prefix: "Slide" for main slides, "Thumbnail" for thumbnail strips. */
	readonly altPrefix?: string;
	readonly className?: string;
}

/** A slide's photo, drawn in greyscale like the original examples. */
export function CarouselSlidePhoto({ slide, widthPx, heightPx, altPrefix = "Slide", className }: CarouselSlidePhotoProps): React.JSX.Element {
	return (
		<Image
			src={unsplashPhotoUrl(slide.photoId, widthPx, heightPx)}
			alt={`${altPrefix} ${String(slide.number)}`}
			width={widthPx}
			height={heightPx}
			className={cn("h-full w-full object-cover grayscale", className)}
		/>
	);
}
