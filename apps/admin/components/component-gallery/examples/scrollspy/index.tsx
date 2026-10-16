"use client";

// The Scrollspy examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Scrollspy1Example } from "@/components/component-gallery/examples/scrollspy/scrollspy-1";
import { Scrollspy2Example } from "@/components/component-gallery/examples/scrollspy/scrollspy-2";

export const SCROLLSPY_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-scrollspy-1", label: "Vertical Nav", component: Scrollspy1Example },
	{ id: "c-scrollspy-2", label: "Horizontal Nav", component: Scrollspy2Example },
];

export function ScrollspyExamples(): React.JSX.Element {
	return <ExampleGrid examples={SCROLLSPY_EXAMPLES} />;
}
