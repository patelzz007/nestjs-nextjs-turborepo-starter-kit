"use client";

// The FileUpload examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { FileUpload1Example } from "@/components/component-gallery/examples/file-upload/file-upload-1";
import { FileUpload2Example } from "@/components/component-gallery/examples/file-upload/file-upload-2";
import { FileUpload3Example } from "@/components/component-gallery/examples/file-upload/file-upload-3";
import { FileUpload4Example } from "@/components/component-gallery/examples/file-upload/file-upload-4";
import { FileUpload5Example } from "@/components/component-gallery/examples/file-upload/file-upload-5";
import { FileUpload6Example } from "@/components/component-gallery/examples/file-upload/file-upload-6";
import { FileUpload7Example } from "@/components/component-gallery/examples/file-upload/file-upload-7";
import { FileUpload8Example } from "@/components/component-gallery/examples/file-upload/file-upload-8";
import { FileUpload9Example } from "@/components/component-gallery/examples/file-upload/file-upload-9";
import { FileUpload10Example } from "@/components/component-gallery/examples/file-upload/file-upload-10";

export const FILE_UPLOAD_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-file-upload-1", label: "Basic", component: FileUpload1Example },
	{ id: "c-file-upload-2", label: "Avatar", component: FileUpload2Example },
	{ id: "c-file-upload-3", label: "Drag & Drop", component: FileUpload3Example },
	{ id: "c-file-upload-4", label: "Gallery", component: FileUpload4Example },
	{ id: "c-file-upload-5", label: "Progress List", component: FileUpload5Example },
	{ id: "c-file-upload-6", label: "Table", component: FileUpload6Example },
	{ id: "c-file-upload-7", label: "Product Images", component: FileUpload7Example },
	{ id: "c-file-upload-8", label: "Sortable Images", component: FileUpload8Example },
	{ id: "c-file-upload-9", label: "Preview Cards", component: FileUpload9Example },
	{ id: "c-file-upload-10", label: "Cover Image", component: FileUpload10Example },
];

export function FileUploadExamples(): React.JSX.Element {
	return <ExampleGrid examples={FILE_UPLOAD_EXAMPLES} />;
}
