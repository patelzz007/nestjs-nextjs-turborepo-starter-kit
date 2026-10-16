"use client";

// The Rating examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Rating1Example } from "@/components/component-gallery/examples/rating/rating-1";
import { Rating2Example } from "@/components/component-gallery/examples/rating/rating-2";
import { Rating3Example } from "@/components/component-gallery/examples/rating/rating-3";
import { Rating4Example } from "@/components/component-gallery/examples/rating/rating-4";
import { Rating5Example } from "@/components/component-gallery/examples/rating/rating-5";
import { Rating6Example } from "@/components/component-gallery/examples/rating/rating-6";
import { Rating7Example } from "@/components/component-gallery/examples/rating/rating-7";
import { Rating8Example } from "@/components/component-gallery/examples/rating/rating-8";
import { Rating9Example } from "@/components/component-gallery/examples/rating/rating-9";

export const RATING_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-rating-1", label: "Basic", component: Rating1Example },
	{ id: "c-rating-2", label: "Decimal Value", component: Rating2Example },
	{ id: "c-rating-3", label: "Show Value", component: Rating3Example },
	{ id: "c-rating-4", label: "Editable", component: Rating4Example },
	{ id: "c-rating-5", label: "Sizes", component: Rating5Example },
	{ id: "c-rating-6", label: "Review Summary", component: Rating6Example },
	{ id: "c-rating-7", label: "Half-Star Input", component: Rating7Example },
	{ id: "c-rating-8", label: "Emoji Reactions", component: Rating8Example },
	{ id: "c-rating-9", label: "Review Text", component: Rating9Example },
];

export function RatingExamples(): React.JSX.Element {
	return <ExampleGrid examples={RATING_EXAMPLES} />;
}
