"use client";

// The Carousel examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Carousel1Example } from "@/components/component-gallery/examples/carousel/carousel-1";
import { Carousel2Example } from "@/components/component-gallery/examples/carousel/carousel-2";
import { Carousel3Example } from "@/components/component-gallery/examples/carousel/carousel-3";
import { Carousel4Example } from "@/components/component-gallery/examples/carousel/carousel-4";
import { Carousel5Example } from "@/components/component-gallery/examples/carousel/carousel-5";
import { Carousel6Example } from "@/components/component-gallery/examples/carousel/carousel-6";
import { Carousel7Example } from "@/components/component-gallery/examples/carousel/carousel-7";
import { Carousel8Example } from "@/components/component-gallery/examples/carousel/carousel-8";
import { Carousel9Example } from "@/components/component-gallery/examples/carousel/carousel-9";
import { Carousel10Example } from "@/components/component-gallery/examples/carousel/carousel-10";
import { Carousel11Example } from "@/components/component-gallery/examples/carousel/carousel-11";

export const CAROUSEL_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-carousel-1", label: "Basic", component: Carousel1Example },
	{ id: "c-carousel-2", label: "Vertical", component: Carousel2Example },
	{ id: "c-carousel-3", label: "Multiple Items", component: Carousel3Example },
	{ id: "c-carousel-4", label: "Responsive Basis", component: Carousel4Example },
	{ id: "c-carousel-5", label: "Autoplay", component: Carousel5Example },
	{ id: "c-carousel-6", label: "Centered Alignment", component: Carousel6Example },
	{ id: "c-carousel-7", label: "Custom Spacing", component: Carousel7Example },
	{ id: "c-carousel-8", label: "Image Overlays", component: Carousel8Example },
	{ id: "c-carousel-9", label: "Thumbnail Strip", component: Carousel9Example },
	{ id: "c-carousel-10", label: "Overlay Thumbnails", component: Carousel10Example },
	{ id: "c-carousel-11", label: "Dots Navigation", component: Carousel11Example },
];

export function CarouselExamples(): React.JSX.Element {
	return <ExampleGrid examples={CAROUSEL_EXAMPLES} />;
}
