"use client";

// The Autocomplete examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Autocomplete1Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-1";
import { Autocomplete2Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-2";
import { Autocomplete3Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-3";
import { Autocomplete4Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-4";
import { Autocomplete5Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-5";
import { Autocomplete6Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-6";
import { Autocomplete7Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-7";
import { Autocomplete8Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-8";
import { Autocomplete9Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-9";
import { Autocomplete10Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-10";
import { Autocomplete11Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-11";
import { Autocomplete12Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-12";

export const AUTOCOMPLETE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-autocomplete-1", label: "Basic", component: Autocomplete1Example },
	{ id: "c-autocomplete-2", label: "Disabled", component: Autocomplete2Example },
	{ id: "c-autocomplete-3", label: "Auto Highlight", component: Autocomplete3Example },
	{ id: "c-autocomplete-4", label: "Labeled", component: Autocomplete4Example },
	{ id: "c-autocomplete-5", label: "Clear Button", component: Autocomplete5Example },
	{ id: "c-autocomplete-6", label: "Trigger Button", component: Autocomplete6Example },
	{ id: "c-autocomplete-7", label: "Clear & Trigger", component: Autocomplete7Example },
	{ id: "c-autocomplete-8", label: "Groups & Labels", component: Autocomplete8Example },
	{ id: "c-autocomplete-9", label: "Search Results", component: Autocomplete9Example },
	{ id: "c-autocomplete-10", label: "Small", component: Autocomplete10Example },
	{ id: "c-autocomplete-11", label: "Large", component: Autocomplete11Example },
	{ id: "c-autocomplete-12", label: "Form Integration", component: Autocomplete12Example },
];

export function AutocompleteExamples(): React.JSX.Element {
	return <ExampleGrid examples={AUTOCOMPLETE_EXAMPLES} />;
}
