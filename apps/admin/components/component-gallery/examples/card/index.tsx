"use client";

// The Card examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Card1Example } from "@/components/component-gallery/examples/card/card-1";
import { Card2Example } from "@/components/component-gallery/examples/card/card-2";
import { Card3Example } from "@/components/component-gallery/examples/card/card-3";
import { Card4Example } from "@/components/component-gallery/examples/card/card-4";
import { Card5Example } from "@/components/component-gallery/examples/card/card-5";
import { Card6Example } from "@/components/component-gallery/examples/card/card-6";
import { Card7Example } from "@/components/component-gallery/examples/card/card-7";
import { Card8Example } from "@/components/component-gallery/examples/card/card-8";
import { Card9Example } from "@/components/component-gallery/examples/card/card-9";
import { Card10Example } from "@/components/component-gallery/examples/card/card-10";
import { Card11Example } from "@/components/component-gallery/examples/card/card-11";
import { Card12Example } from "@/components/component-gallery/examples/card/card-12";
import { Card13Example } from "@/components/component-gallery/examples/card/card-13";
import { Card14Example } from "@/components/component-gallery/examples/card/card-14";
import { Card15Example } from "@/components/component-gallery/examples/card/card-15";
import { Card16Example } from "@/components/component-gallery/examples/card/card-16";
import { Card17Example } from "@/components/component-gallery/examples/card/card-17";
import { Card18Example } from "@/components/component-gallery/examples/card/card-18";

export const CARD_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-card-1", label: "Basic", component: Card1Example },
	{ id: "c-card-2", label: "Bordered Header", component: Card2Example },
	{ id: "c-card-3", label: "Border Separation", component: Card3Example },
	{ id: "c-card-4", label: "Header & Footer", component: Card4Example },
	{ id: "c-card-5", label: "Link Action", component: Card5Example },
	{ id: "c-card-6", label: "Dropdown Menu", component: Card6Example },
	{ id: "c-card-7", label: "Inset Image", component: Card7Example },
	{ id: "c-card-8", label: "Image Hover Zoom", component: Card8Example },
	{ id: "c-card-9", label: "Full Image", component: Card9Example },
	{ id: "c-card-10", label: "Image Shadow Fade", component: Card10Example },
	{ id: "c-card-11", label: "Stacked Depth", component: Card11Example },
	{ id: "c-card-12", label: "Login Form", component: Card12Example },
	{ id: "c-card-13", label: "Billing Usage", component: Card13Example },
	{ id: "c-card-14", label: "Deployment Status", component: Card14Example },
	{ id: "c-card-15", label: "Stat Trend", component: Card15Example },
	{ id: "c-card-16", label: "Badge & Actions", component: Card16Example },
	{ id: "c-card-17", label: "Icon & Link", component: Card17Example },
	{ id: "c-card-18", label: "Label & Link", component: Card18Example },
];

export function CardExamples(): React.JSX.Element {
	return <ExampleGrid examples={CARD_EXAMPLES} />;
}
