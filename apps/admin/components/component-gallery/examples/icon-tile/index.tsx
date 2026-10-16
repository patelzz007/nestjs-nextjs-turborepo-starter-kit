"use client";

// The IconTile examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { IconTile1Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-1";
import { IconTile2Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-2";
import { IconTile3Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-3";
import { IconTile4Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-4";
import { IconTile5Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-5";
import { IconTile6Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-6";
import { IconTile7Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-7";
import { IconTile8Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-8";
import { IconTile9Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-9";
import { IconTile10Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-10";
import { IconTile11Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-11";
import { IconTile12Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-12";
import { IconTile13Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-13";
import { IconTile14Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-14";
import { IconTile15Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-15";
import { IconTile16Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-16";
import { IconTile17Example } from "@/components/component-gallery/examples/icon-tile/icon-tile-17";

export const ICON_TILE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-icon-tile-1", label: "Default", component: IconTile1Example },
	{ id: "c-icon-tile-2", label: "Elevated", component: IconTile2Example },
	{ id: "c-icon-tile-3", label: "Framed", component: IconTile3Example },
	{ id: "c-icon-tile-4", label: "All Variants", component: IconTile4Example },
	{ id: "c-icon-tile-5", label: "Sizes", component: IconTile5Example },
	{ id: "c-icon-tile-6", label: "Circular", component: IconTile6Example },
	{ id: "c-icon-tile-7", label: "Custom Sizing", component: IconTile7Example },
	{ id: "c-icon-tile-8", label: "Color Tones", component: IconTile8Example },
	{ id: "c-icon-tile-9", label: "Text Content", component: IconTile9Example },
	{ id: "c-icon-tile-10", label: "List Row", component: IconTile10Example },
	{ id: "c-icon-tile-11", label: "Feature Card", component: IconTile11Example },
	{ id: "c-icon-tile-12", label: "Empty State", component: IconTile12Example },
	{ id: "c-icon-tile-13", label: "Interactive", component: IconTile13Example },
	{ id: "c-icon-tile-14", label: "Status Overlay", component: IconTile14Example },
	{ id: "c-icon-tile-15", label: "Soft Tones", component: IconTile15Example },
	{ id: "c-icon-tile-16", label: "Solid Tones", component: IconTile16Example },
	{ id: "c-icon-tile-17", label: "Brand Colors", component: IconTile17Example },
];

export function IconTileExamples(): React.JSX.Element {
	return <ExampleGrid examples={ICON_TILE_EXAMPLES} />;
}
