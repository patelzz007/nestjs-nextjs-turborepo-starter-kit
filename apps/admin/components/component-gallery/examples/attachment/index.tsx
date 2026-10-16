"use client";

// The Attachment examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Attachment1Example } from "@/components/component-gallery/examples/attachment/attachment-1";
import { Attachment2Example } from "@/components/component-gallery/examples/attachment/attachment-2";
import { Attachment3Example } from "@/components/component-gallery/examples/attachment/attachment-3";
import { Attachment4Example } from "@/components/component-gallery/examples/attachment/attachment-4";
import { Attachment5Example } from "@/components/component-gallery/examples/attachment/attachment-5";
import { Attachment6Example } from "@/components/component-gallery/examples/attachment/attachment-6";

export const ATTACHMENT_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-attachment-1", label: "Assistant Reply", component: Attachment1Example },
	{ id: "c-attachment-2", label: "Composer Tray", component: Attachment2Example },
	{ id: "c-attachment-3", label: "Image Strip", component: Attachment3Example },
	{ id: "c-attachment-4", label: "Three Sizes", component: Attachment4Example },
	{ id: "c-attachment-5", label: "Upload Queue", component: Attachment5Example },
	{ id: "c-attachment-6", label: "File Picker", component: Attachment6Example },
];

export function AttachmentExamples(): React.JSX.Element {
	return <ExampleGrid examples={ATTACHMENT_EXAMPLES} />;
}
