"use client";

// The Tree examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Tree1Example } from "@/components/component-gallery/examples/tree/tree-1";
import { Tree2Example } from "@/components/component-gallery/examples/tree/tree-2";
import { Tree3Example } from "@/components/component-gallery/examples/tree/tree-3";
import { Tree4Example } from "@/components/component-gallery/examples/tree/tree-4";
import { Tree5Example } from "@/components/component-gallery/examples/tree/tree-5";
import { Tree6Example } from "@/components/component-gallery/examples/tree/tree-6";
import { Tree7Example } from "@/components/component-gallery/examples/tree/tree-7";

export const TREE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-tree-1", label: "Basic", component: Tree1Example },
	{ id: "c-tree-2", label: "Indent Lines", component: Tree2Example },
	{ id: "c-tree-3", label: "Folder File Icons", component: Tree3Example },
	{ id: "c-tree-4", label: "Plus Minus Toggles", component: Tree4Example },
	{ id: "c-tree-5", label: "File Explorer", component: Tree5Example },
	{ id: "c-tree-6", label: "Org Chart", component: Tree6Example },
	{ id: "c-tree-7", label: "Permissions", component: Tree7Example },
];

export function TreeExamples(): React.JSX.Element {
	return <ExampleGrid examples={TREE_EXAMPLES} />;
}
