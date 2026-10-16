"use client";

// The FileType examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { FileType1Example } from "@/components/component-gallery/examples/file-type/file-type-1";
import { FileType2Example } from "@/components/component-gallery/examples/file-type/file-type-2";
import { FileType3Example } from "@/components/component-gallery/examples/file-type/file-type-3";
import { FileType4Example } from "@/components/component-gallery/examples/file-type/file-type-4";
import { FileType5Example } from "@/components/component-gallery/examples/file-type/file-type-5";
import { FileType7Example } from "@/components/component-gallery/examples/file-type/file-type-7";
import { FileType8Example } from "@/components/component-gallery/examples/file-type/file-type-8";
import { FileType9Example } from "@/components/component-gallery/examples/file-type/file-type-9";
import { FileType10Example } from "@/components/component-gallery/examples/file-type/file-type-10";
import { FileType11Example } from "@/components/component-gallery/examples/file-type/file-type-11";
import { FileType12Example } from "@/components/component-gallery/examples/file-type/file-type-12";
import { FileType13Example } from "@/components/component-gallery/examples/file-type/file-type-13";
import { FileType14Example } from "@/components/component-gallery/examples/file-type/file-type-14";
import { FileType15Example } from "@/components/component-gallery/examples/file-type/file-type-15";
import { FileType6Example } from "@/components/component-gallery/examples/file-type/file-type-6";

export const FILE_TYPE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-file-type-1", label: "Common Formats", component: FileType1Example },
	{ id: "c-file-type-2", label: "Variants", component: FileType2Example },
	{ id: "c-file-type-3", label: "Sizes", component: FileType3Example },
	{ id: "c-file-type-4", label: "Family Glyphs", component: FileType4Example },
	{ id: "c-file-type-5", label: "All Formats", component: FileType5Example },
	{ id: "c-file-type-7", label: "Attachment List", component: FileType7Example },
	{ id: "c-file-type-8", label: "Upload Queue", component: FileType8Example },
	{ id: "c-file-type-9", label: "Resolve From Name", component: FileType9Example },
	{ id: "c-file-type-10", label: "Custom Labels", component: FileType10Example },
	{ id: "c-file-type-11", label: "Custom Colors", component: FileType11Example },
	{ id: "c-file-type-12", label: "Format Picker", component: FileType12Example },
	{ id: "c-file-type-13", label: "Locked & Starred", component: FileType13Example },
	{ id: "c-file-type-14", label: "Restyled Labels", component: FileType14Example },
	{ id: "c-file-type-15", label: "Dotfiles & Build Names", component: FileType15Example },
	{ id: "c-file-type-6", label: "File Browser", component: FileType6Example },
];

export function FileTypeExamples(): React.JSX.Element {
	return <ExampleGrid examples={FILE_TYPE_EXAMPLES} />;
}
